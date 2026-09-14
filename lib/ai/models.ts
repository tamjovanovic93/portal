// Model ids in one place, overridable per environment without a deploy.
export const MODELS = {
  // Long-form reasoning with web research (intake, strategy, suggestions, brief draft).
  deep: process.env.AI_MODEL_DEEP ?? "claude-opus-4-8",
  // Fast structured JSON (scope → task breakdown).
  fast: process.env.AI_MODEL_FAST ?? "claude-sonnet-4-6",
} as const;

export const WEB_SEARCH_TOOL = process.env.AI_WEB_SEARCH_TOOL ?? "web_search_20260209";
