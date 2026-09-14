// Numbered step row used by the client onboarding / intake pipelines.
// `desc` adds the description line (and the larger control gap); `disabled`
// dims the row.
export default function PipelineStep({
  n,
  title,
  desc,
  done,
  disabled,
  children,
}: {
  n: number;
  title: string;
  desc?: string;
  done: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const hasDesc = desc !== undefined;
  return (
    <li className={`flex items-start gap-3 ${disabled ? "opacity-60" : ""}`}>
      <span
        className={`mt-0.5 shrink-0 w-5 h-5 rounded-full text-[11px] font-semibold flex items-center justify-center ${
          done ? "bg-green-600 text-white" : "bg-neutral-200 text-ink-2"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink">{title}</p>
        {hasDesc && <p className="text-xs text-ink-2 mt-0.5">{desc}</p>}
        <div className={`flex items-center gap-2 ${hasDesc ? "mt-2" : "mt-1"}`}>{children}</div>
      </div>
    </li>
  );
}
