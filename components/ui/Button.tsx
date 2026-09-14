import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

// ─────────────────────────────────────────────────────────────────────────────
// The one button. The app genuinely has two looks, so both live here and the
// variant name says which — there is never a guess at the call site.
//
// DESIGN-SYSTEM family — the .btn* classes in app/design.css, driven by theme
// tokens. Fixed height (36px, or 30px at size="sm"), mint primary with glow.
// Use it in team-app chrome: page headers, toolbars, card actions, anything
// sitting next to a .card or .pill.
//
//   variant       renders           looks like
//   "primary"     btn btn-primary   mint fill, dark text, glow
//   "secondary"   btn               surface fill, bordered
//   "ghost"       btn btn-ghost     transparent until hover
//
//   size: "sm" (30px) | "md" (36px, default). `icon` makes it square.
//
// FORM family — Tailwind utilities on the semantic colour classes. Height comes
// from padding. Use it inside forms, modals, the document editors and the
// client portal, where controls sit in a vertical rhythm.
//
//   variant       use it for
//   "solid"       the confirm action (mint in the dark app, near-black in the portal)
//   "outline"     the secondary action — the Cancel beside a solid
//   "danger"      a destructive action that still needs a box
//   "success"     a green confirm; approval flows only
//   "quiet"       a low-emphasis action that keeps a button's padding
//   "dashed"      the "+ Add" affordance
//
//   size: "xs" | "sm" | "md" | "lg" (default) | "xl" | "block".
//   "block" drops horizontal padding — pair it with className="flex-1" or
//   "w-full" for the stacked buttons at the bottom of a modal.
//
// BARE TEXT — no padding, no box. For inline actions inside a dense row.
//
//   variant       use it for
//   "link"        an inline text action (ink-3, ink on hover)
//   "link-danger" an inline delete / remove action (red)
//
//   size sets only the text size.
//
// Rules
//  - Never pass padding, text-size, border-colour, background or text-colour
//    through `className`: it would collide with the variant's own class and CSS
//    order, not class order, decides the winner. Pick the size that fits, or
//    add a size here if the app really needs a new step.
//  - `className` is for layout only: w-full, flex-1, ml-auto, shrink-0, mt-*.
//  - A "button" that is really a clickable row or card stays a plain <button>.
// ─────────────────────────────────────────────────────────────────────────────

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "solid"
  | "outline"
  | "danger"
  | "success"
  | "quiet"
  | "dashed"
  | "link"
  | "link-danger";

export type ButtonSize = "xs" | "sm" | "md" | "lg" | "xl" | "block";

const DS_VARIANTS: Partial<Record<ButtonVariant, string>> = {
  primary: "btn-primary",
  secondary: "",
  ghost: "btn-ghost",
};

// Padding / text / radius for the form family — the steps the app actually
// uses, so no call site has to fight a wrong default.
const SIZES: Record<ButtonSize, string> = {
  xs: "text-xs px-2 py-1 rounded",
  sm: "text-xs px-3 py-1.5 rounded-md",
  md: "text-sm px-3 py-1.5 rounded-md",
  lg: "text-sm px-4 py-2 rounded-md",
  xl: "text-sm px-5 py-2 rounded-md",
  block: "text-sm py-2 rounded-md",
};

// Bare text buttons take the text size only.
const TEXT_SIZES: Record<ButtonSize, string> = {
  xs: "text-xs",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-sm",
  xl: "text-sm",
  block: "text-sm",
};

const TONES: Partial<Record<ButtonVariant, string>> = {
  solid: "bg-neutral-900 text-white hover:bg-neutral-700",
  outline: "border border-line-2 text-ink-2 hover:bg-surface-2",
  danger: "border border-red-200 text-rose hover:bg-red-50",
  success: "bg-green-700 text-white hover:bg-green-800",
  dashed: "border border-dashed border-line-2 text-ink-3 hover:text-ink hover:border-line-3",
  quiet: "text-ink-2 hover:text-ink",
  link: "text-ink-3 hover:text-ink",
  "link-danger": "text-red-500 hover:text-red-700",
};

const BARE = new Set<ButtonVariant>(["link", "link-danger"]);
const FORM_BASE = "font-medium transition-colors disabled:opacity-50";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Design-system family only: square icon button. */
  icon?: boolean;
  /** Layout classes only — see the rules above. */
  className?: string;
  children?: ReactNode;
};

export default function Button({
  variant = "solid",
  size,
  icon = false,
  className,
  type = "button",
  ...rest
}: Props) {
  const ds = DS_VARIANTS[variant];
  let classes: string;
  if (ds !== undefined) {
    classes = cx("btn", icon && "btn-icon", size === "sm" && "btn-sm", ds, className);
  } else if (BARE.has(variant)) {
    classes = cx("transition-colors disabled:opacity-50", TEXT_SIZES[size ?? "md"], TONES[variant], className);
  } else {
    classes = cx(FORM_BASE, SIZES[size ?? "lg"], TONES[variant], className);
  }
  return <button type={type} className={classes} {...rest} />;
}
