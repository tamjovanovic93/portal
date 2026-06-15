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
};

export type Section = {
  key: string;
  title: string;
  description?: string;
  teamOnly?: boolean;  // hidden from client view
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
