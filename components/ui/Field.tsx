import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

// ─────────────────────────────────────────────────────────────────────────────
// Form controls. Same two-family split as Button, chosen with `variant`:
//
//   variant="plain" (default) — Tailwind utilities on the semantic colour
//     classes. The look used by forms, modals, the document editors and the
//     client portal. `size` drives padding and text size.
//
//   variant="zp" — the design-system control from app/design.css
//     (.zp-input / .zp-select / .zp-textarea): surface-2 fill, mint focus
//     border, fixed 13px text. Used by Client Data, the brief tables and the
//     verification rows. `size` does not apply.
//
// Sizes (plain only): "md" (default, the form standard), "sm" (dense rows),
// "xs" (inline table cells).
//
// Checkboxes and radios are not wrapped — they are one class (accent-*) and a
// component would only get in the way.
// ─────────────────────────────────────────────────────────────────────────────

export type FieldVariant = "plain" | "zp";
export type FieldSize = "xs" | "sm" | "md";

const SIZES: Record<FieldSize, string> = {
  xs: "px-2 py-1 text-xs rounded",
  sm: "px-3 py-1.5 text-sm rounded-md",
  md: "px-3 py-2 text-sm rounded-md",
};

// One focus treatment for every control, so tabbing through a form is uniform.
const PLAIN_BASE = "border border-line-2 focus:outline-none focus:ring-2 focus:ring-neutral-900";

function plain(size: FieldSize, fullWidth: boolean, extra?: string) {
  return cx(fullWidth && "w-full", PLAIN_BASE, SIZES[size], extra);
}

type Common = {
  variant?: FieldVariant;
  size?: FieldSize;
  /** Off for controls in a flex row that size themselves (pair with className="flex-1"). */
  fullWidth?: boolean;
  className?: string;
};

export function Input({
  variant = "plain",
  size = "md",
  fullWidth = true,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "size"> & Common) {
  return (
    <input
      className={variant === "zp" ? cx("zp-input", className) : plain(size, fullWidth, className)}
      {...rest}
    />
  );
}

export function Textarea({
  variant = "plain",
  size = "md",
  fullWidth = true,
  resize,
  className,
  ...rest
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className" | "size"> &
  Common & { resize?: "y" | "none" }) {
  const resizeCls = resize === "y" ? "resize-y" : resize === "none" ? "resize-none" : undefined;
  return (
    <textarea
      className={
        variant === "zp"
          ? cx("zp-textarea", className)
          : plain(size, fullWidth, cx(resizeCls, className))
      }
      {...rest}
    />
  );
}

export function Select({
  variant = "plain",
  size = "md",
  fullWidth = true,
  className,
  ...rest
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, "className" | "size"> & Common) {
  return (
    <select
      className={
        variant === "zp"
          ? cx("zp-select", className)
          : plain(size, fullWidth, cx("bg-surface", className))
      }
      {...rest}
    />
  );
}

// Label above a control. `zp` matches .zp-label (Client Data); the default is
// the form/modal label used everywhere else. `size="xs"` is the denser variant
// used inside tables and side panels.
export function Label({
  variant = "plain",
  size = "sm",
  htmlFor,
  className,
  children,
}: {
  variant?: FieldVariant;
  size?: "xs" | "sm";
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  if (variant === "zp") {
    return (
      <label htmlFor={htmlFor} className={cx("zp-label", className)}>
        {children}
      </label>
    );
  }
  return (
    <label
      htmlFor={htmlFor}
      className={cx(
        "block font-medium text-ink-2 mb-1",
        size === "xs" ? "text-xs" : "text-sm",
        className
      )}
    >
      {children}
    </label>
  );
}
