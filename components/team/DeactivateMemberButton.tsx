"use client";

import { useState } from "react";
import { deactivateTeamMember } from "@/app/actions/team";

// Safe "remove" for a team member — deactivates (active=false) after a confirm.
// History/references are preserved; they just disappear from rosters/selectors.
export default function DeactivateMemberButton({
  memberId,
  memberName,
  className = "btn btn-icon",
  style,
  children,
}: {
  memberId: string;
  memberName: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (
      !confirm(
        `Remove ${memberName} from the team?\n\n` +
          "They will no longer appear in rosters or be assignable to projects. " +
          "Their past work, task assignments and approvals stay intact, and you " +
          "can re-add them later."
      )
    )
      return;
    setBusy(true);
    const result = await deactivateTeamMember(memberId);
    if (result?.error) {
      alert(result.error);
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={handleClick} disabled={busy} className={className} style={style}>
      {busy ? "Removing…" : children}
    </button>
  );
}
