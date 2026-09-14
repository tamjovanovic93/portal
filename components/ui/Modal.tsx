"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Portal-rendered modal shell shared by the create/edit dialogs. The class
// strings are exactly the ones each dialog used inline, so nothing moves.
const DEFAULT_OVERLAY = "theme-dark fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4";
const DEFAULT_CARD = "bg-white rounded-lg shadow-xl w-full max-w-md p-6";

const subscribeNoop = () => () => {};

export default function Modal({
  open,
  children,
  overlayClassName = DEFAULT_OVERLAY,
  cardClassName = DEFAULT_CARD,
}: {
  open: boolean;
  children: ReactNode;
  overlayClassName?: string;
  cardClassName?: string;
}) {
  // Portal target only exists in the browser; false during SSR/hydration.
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  if (!open || !mounted) return null;
  return createPortal(
    <div className={overlayClassName}>
      <div className={cardClassName}>{children}</div>
    </div>,
    document.body
  );
}
