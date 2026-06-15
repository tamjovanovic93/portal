import Icon, { type IconName } from "@/components/ui/Icon";
import { Eyebrow } from "@/components/ui/kit";

export default function ComingSoon({
  title,
  eyebrow,
  icon,
  note,
  phase,
}: {
  title: string;
  eyebrow: string;
  icon: IconName;
  note: string;
  phase: string;
}) {
  return (
    <div style={{ padding: "28px 32px 60px", maxWidth: 1320, margin: "0 auto" }}>
      <div className="fade-up">
        <Eyebrow style={{ marginBottom: 10 }}>{eyebrow}</Eyebrow>
        <h1 className="page-title" style={{ fontSize: 32 }}>{title}</h1>
      </div>
      <div
        className="card fade-up"
        style={{ marginTop: 28, padding: "60px 40px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}
      >
        <div
          style={{ width: 56, height: 56, borderRadius: 14, background: "var(--mint-fill)", color: "var(--mint)" }}
          className="flex items-center justify-center"
        >
          <Icon name={icon} size={26} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Coming in {phase}</div>
        <p className="muted" style={{ fontSize: 13.5, maxWidth: 440, lineHeight: 1.6 }}>{note}</p>
      </div>
    </div>
  );
}
