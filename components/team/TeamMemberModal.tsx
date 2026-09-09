"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { createTeamMember, updateTeamMember } from "@/app/actions/team";

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

const ACCENTS = ["mint", "blue", "amber", "rose", "purple"];

const inputCls =
  "w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900";

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
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

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

      {open &&
        mounted &&
        createPortal(
          <div className="theme-dark fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-base font-semibold text-neutral-900 mb-5">
                {isEdit ? "Edit team member" : "Add team member"}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Name</label>
                  <input name="name" type="text" defaultValue={member?.name ?? ""} placeholder="e.g. Alex Rivera" className={inputCls} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
                  {isEdit ? (
                    <input type="email" value={member!.email} readOnly disabled className={`${inputCls} bg-neutral-100 text-neutral-500`} />
                  ) : (
                    <input name="email" type="email" required placeholder="alex@zeropoint.studio" className={inputCls} />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Title / role</label>
                  <input name="title" type="text" defaultValue={member?.title ?? ""} placeholder="e.g. UI Designer" className={inputCls} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Skills</label>
                  <input name="skills" type="text" defaultValue={member?.skills.join(", ") ?? ""} placeholder="Comma separated — e.g. Figma, UX, Prototyping" className={inputCls} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Bio</label>
                  <textarea name="bio" rows={3} defaultValue={member?.bio ?? ""} placeholder="Short overview" className={inputCls} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Accent colour</label>
                  <select name="accent" defaultValue={member?.accent ?? "mint"} className={`${inputCls} bg-white`}>
                    {ACCENTS.map((a) => (
                      <option key={a} value={a}>{a[0].toUpperCase() + a.slice(1)}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Working hours</label>
                    <input name="availHours" type="text" defaultValue={member?.availability.hours ?? ""} placeholder="Mon–Fri · 9:00–18:00" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Timezone</label>
                    <input name="availTz" type="text" defaultValue={member?.availability.tz ?? ""} placeholder="CET" className={inputCls} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Availability note</label>
                  <input name="availNote" type="text" defaultValue={member?.availability.note ?? ""} placeholder="Optional" className={inputCls} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Photo URL</label>
                  <input name="photoUrl" type="url" defaultValue={member?.photo ?? ""} placeholder="https://…" className={inputCls} />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setError(null);
                    }}
                    className="flex-1 py-2 border border-neutral-300 text-sm rounded-md hover:bg-neutral-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2 bg-neutral-900 text-white text-sm rounded-md hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                  >
                    {loading ? "Saving…" : isEdit ? "Save changes" : "Add member"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
