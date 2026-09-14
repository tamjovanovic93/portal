"use client";

import EditableForm from "./EditableForm";
import RespondForm from "./RespondForm";
import ReviewForm from "./ReviewForm";
import type { DocumentFormProps, FormMode } from "./types";

export type { FormMode, DocumentFormProps } from "./types";

// Template-driven document form. Picks the renderer for the requested mode:
//   fill / prefill — plain editable form (EditableForm)
//   respond        — client approves/changes pre-filled answers (RespondForm)
//   review         — team reviews a completed form (ReviewForm)
export default function DocumentForm(props: DocumentFormProps) {
  const mode: FormMode = props.mode ?? "fill";
  if (mode === "respond") return <RespondForm {...props} />;
  if (mode === "review") return <ReviewForm {...props} />;
  return <EditableForm {...props} mode={mode} />;
}
