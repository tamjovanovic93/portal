import type { Template } from "@/lib/templates/types";

export type FormMode = "fill" | "prefill" | "respond" | "review";

export type DocumentFormProps = {
  documentId: string;
  template: Template;
  initialContent: Record<string, unknown>;
  readOnly?: boolean;
  isTeam?: boolean;
  mode?: FormMode;
  stepped?: boolean; // respond mode: guided one-step-at-a-time wizard
};
