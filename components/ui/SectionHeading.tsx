// Small uppercase section label used across the team pages and the client
// portal. Same markup the pages used inline.
export default function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-3">{children}</h3>;
}
