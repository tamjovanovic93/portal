export type FieldType =
  | "text"
  | "textarea"
  | "date"
  | "select"
  | "radio"
  | "checkbox"
  | "checkboxGroup"
  | "checklistItem"   // pass / fail / n/a  + optional note
  | "repeatable"      // array of row objects (sub-fields defined in columns)
  | "signature";      // printed name + date

export type FieldOption = { value: string; label: string };

// Conditional visibility: show the field/section only when another field's
// value matches. `equals` may be a single value or a list (match any).
export type ShowIf = { field: string; equals: string | string[] };

export type Field = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  rows?: number;
  options?: FieldOption[];
  columns?: Field[];   // for "repeatable" type
  defaultRows?: number;
  showIf?: ShowIf;     // conditional visibility (e.g. B2B / B2C branching)
};

export type Section = {
  key: string;
  title: string;
  description?: string;
  teamOnly?: boolean;  // hidden from client view
  showIf?: ShowIf;     // conditional visibility
  fields: Field[];
};

export type Template = {
  id: string;
  title: string;
  stage: number;
  audience: "client" | "team";
  description: string;
  sections: Section[];
};
