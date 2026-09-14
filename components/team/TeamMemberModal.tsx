"use client";

import { useState } from "react";
import { createTeamMember, updateTeamMember } from "@/app/actions/team";
import { ACCENTS } from "@/lib/constants/ui";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Field";

// Add / edit a team member. Same modal pattern as NewProjectButton. When
// `member` is provided it edits; otherwise it creates. Fields mirror the
// existing Team Member structure (lib/team.ts / Profile).
type MemberInitial = {
  id: string;
  name: string;
  email: string;
  title: string;
  skills: string[];
  bio: string;
  photo?: string;
  accent: string;
  availability: { hours: string; tz: string; note: string };
};

export default function TeamMemberModal({
  member,
  triggerClassName = "btn btn-primary",
  triggerChildren,
}: {
  member?: MemberInitial;
  triggerClassName?: string;
  triggerChildren: React.ReactNode;
}) {
  const isEdit = !!member;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const result = isEdit
      ? await updateTeamMember(member!.id, fd)
      : await createTeamMember(fd);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setLoading(false);
    setOpen(false);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        {triggerChildren}
      </button>

      <Modal open={open} cardClassName="bg-surface rounded-lg shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-base font-semibold text-ink mb-5">
          {isEdit ? "Edit team member" : "Add team member"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input name="name" type="text" defaultValue={member?.name ?? ""} placeholder="e.g. Alex Rivera" />
          </div>

          <div>
            <Label>Email</Label>
            {isEdit ? (
              <Input type="email" value={member!.email} readOnly disabled className="bg-inset text-ink-3" />
            ) : (
              <Input name="email" type="email" required placeholder="alex@zeropoint.studio" />
            )}
          </div>

          <div>
            <Label>Title / role</Label>
            <Input name="title" type="text" defaultValue={member?.title ?? ""} placeholder="e.g. UI Designer" />
          </div>

          <div>
            <Label>Skills</Label>
            <Input name="skills" type="text" defaultValue={member?.skills.join(", ") ?? ""} placeholder="Comma separated — e.g. Figma, UX, Prototyping" />
          </div>

          <div>
            <Label>Bio</Label>
            <Textarea name="bio" rows={3} defaultValue={member?.bio ?? ""} placeholder="Short overview" />
          </div>

          <div>
            <Label>Accent colour</Label>
            <Select name="accent" defaultValue={member?.accent ?? "mint"}>
              {ACCENTS.map((a) => (
                <option key={a} value={a}>{a[0].toUpperCase() + a.slice(1)}</option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Working hours</Label>
              <Input name="availHours" type="text" defaultValue={member?.availability.hours ?? ""} placeholder="Mon–Fri · 9:00–18:00" />
            </div>
            <div>
              <Label>Timezone</Label>
              <Input name="availTz" type="text" defaultValue={member?.availability.tz ?? ""} placeholder="CET" />
            </div>
          </div>

          <div>
            <Label>Availability note</Label>
            <Input name="availNote" type="text" defaultValue={member?.availability.note ?? ""} placeholder="Optional" />
          </div>

          <div>
            <Label>Photo URL</Label>
            <Input name="photoUrl" type="url" defaultValue={member?.photo ?? ""} placeholder="https://…" />
          </div>

          {error && <p className="text-sm text-rose">{error}</p>}

          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              size="block"
              className="flex-1"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" size="block" className="flex-1" disabled={loading}>
              {loading ? "Saving…" : isEdit ? "Save changes" : "Add member"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
