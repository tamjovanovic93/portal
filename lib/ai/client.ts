import Anthropic from "@anthropic-ai/sdk";
import type { ZodTypeAny, z } from "zod";
import { MODELS, WEB_SEARCH_TOOL } from "./models";

export type AgentUsage = { inputTokens: number; outputTokens: number };

export type RunAgentOptions = {
  model?: string;
  maxTokens: number;
  webSearch?: boolean;
  thinking?: boolean;
  effort?: "low" | "medium" | "high";
  // Hard cap on wall-clock time; the stream is aborted when exceeded.
  timeoutMs?: number;
  // Upper bound on server-tool continuation turns (pause_turn).
  maxTurns?: number;
};

export class AgentTimeoutError extends Error {
  constructor() {
    super("The AI request timed out.");
    this.name = "AgentTimeoutError";
  }
}

// One agent conversation. Streams (outputs are large), optionally enables web
// search, and resumes automatically on `pause_turn` (server-tool loop limit).
// Returns the concatenated text and the token usage across all turns.
export async function runAgent(
  prompt: string,
  options: RunAgentOptions
): Promise<{ text: string; usage: AgentUsage }> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const tools = options.webSearch
    ? [{ type: WEB_SEARCH_TOOL as "web_search_20260209", name: "web_search" as const }]
    : [];
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
  const usage: AgentUsage = { inputTokens: 0, outputTokens: 0 };
  const maxTurns = options.maxTurns ?? 6;
  const deadline = options.timeoutMs ? Date.now() + options.timeoutMs : null;

  for (let turn = 0; turn < maxTurns; turn++) {
    const stream = anthropic.messages.stream({
      model: options.model ?? MODELS.deep,
      max_tokens: options.maxTokens,
      ...(options.thinking ? { thinking: { type: "adaptive" as const } } : {}),
      ...(options.effort ? { output_config: { effort: options.effort } } : {}),
      tools,
      messages,
    });

    let timer: ReturnType<typeof setTimeout> | undefined;
    const message = await Promise.race([
      stream.finalMessage(),
      new Promise<never>((_, reject) => {
        if (!deadline) return;
        const remaining = deadline - Date.now();
        timer = setTimeout(() => {
          try { stream.abort(); } catch {}
          reject(new AgentTimeoutError());
        }, Math.max(0, remaining));
      }),
    ]).finally(() => { if (timer) clearTimeout(timer); });

    usage.inputTokens += message.usage?.input_tokens ?? 0;
    usage.outputTokens += message.usage?.output_tokens ?? 0;
    messages.push({ role: "assistant", content: message.content });
    if (message.stop_reason === "pause_turn") continue;

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return { text, usage };
  }
  throw new Error("Agent did not finish within the allotted turns.");
}

// Web search not enabled / unsupported on this key — retry without it.
export async function runAgentWithSearchFallback(prompt: string, options: RunAgentOptions) {
  try {
    return await runAgent(prompt, { ...options, webSearch: true });
  } catch (err) {
    const msg = (err as Error).message ?? "";
    if (!(err instanceof AgentTimeoutError) && /web_search|tool|permission|not.*enabled/i.test(msg)) {
      return runAgent(prompt, { ...options, webSearch: false });
    }
    throw err;
  }
}

// Models can wrap JSON in prose or code fences; extract the outermost object
// and (optionally) validate it before anything is persisted.
export function parseJsonResponse<S extends ZodTypeAny>(text: string, schema: S): z.infer<S>;
export function parseJsonResponse<T = unknown>(text: string): T;
export function parseJsonResponse(text: string, schema?: ZodTypeAny): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model response.");
  const parsed = JSON.parse(text.slice(start, end + 1));
  if (!schema) return parsed;
  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`Model response failed validation at ${issue?.path?.join(".") || "root"}: ${issue?.message}`);
  }
  return result.data;
}
