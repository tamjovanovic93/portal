import { prisma } from "@/lib/prisma";
import { hashAccent, type Accent } from "@/components/ui/kit";

// Team members are TEAM Profiles — the single source of truth (replaces the old
// static roster). Profile copy (title, skills, bio, availability, accent, photo)
// lives on the row; capacity and current projects are derived from assigned tasks.

const CAPACITY_THRESHOLD = 6; // open assigned tasks that reads as "fully loaded"

const ACCENTS: Accent[] = ["mint", "blue", "amber", "rose", "purple"];
function toAccent(value: string | null, fallbackSeed: string): Accent {
  if (value && (ACCENTS as string[]).includes(value)) return value as Accent;
  return hashAccent(fallbackSeed);
}

export type MemberProject = {
  id: string;
  name: string;
  clientName: string;
  isRetainer: boolean;
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  color: Accent;
  photo?: string;
  title: string;
  skills: string[];
  overview: string;
  quote: string;
  capacity: number; // 0..1
  openTasks: number;
  availability: { hours: string; tz: string; note: string };
  projects: MemberProject[];
};

// Lightweight roster entry for assignment pickers (brief owner/team, task assignee).
export type RosterMember = { id: string; name: string; photo?: string; title: string; accent: Accent };

type Availability = { hours?: string; tz?: string; note?: string } | null;

const DEFAULT_AVAILABILITY = { hours: "Mon–Fri · 9:00–18:00", tz: "Local time", note: "" };

function memberName(p: { name: string | null; email: string }): string {
  return p.name ?? p.email.split("@")[0];
}

export async function getTeamData(): Promise<TeamMember[]> {
  const profiles = await prisma.profile.findMany({
    where: { role: "TEAM", active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { email: "asc" }],
  });
  if (profiles.length === 0) return [];

  const tasks = await prisma.task.findMany({
    where: { assigneeId: { in: profiles.map((p) => p.id) } },
    select: {
      assigneeId: true,
      status: true,
      cycle: {
        select: {
          project: {
            select: { id: true, name: true, mode: true, client: { select: { name: true, email: true } } },
          },
        },
      },
    },
  });

  return profiles.map((p) => {
    const mine = tasks.filter((t) => t.assigneeId === p.id);
    const open = mine.filter((t) => t.status !== "DONE");

    const projMap = new Map<string, MemberProject>();
    for (const t of open) {
      const proj = t.cycle.project;
      if (!projMap.has(proj.id)) {
        projMap.set(proj.id, {
          id: proj.id,
          name: proj.name,
          clientName: proj.client.name ?? proj.client.email,
          isRetainer: proj.mode === "ONGOING",
        });
      }
    }

    const name = memberName(p);
    const avail = (p.availability as Availability) ?? null;
    return {
      id: p.id,
      name,
      email: p.email,
      color: toAccent(p.accent, name),
      photo: p.photoUrl ?? undefined,
      title: p.title ?? "Team member",
      skills: p.skills ?? [],
      overview: p.bio ?? "",
      quote: "",
      capacity: Math.min(1, open.length / CAPACITY_THRESHOLD),
      openTasks: open.length,
      availability: {
        hours: avail?.hours ?? DEFAULT_AVAILABILITY.hours,
        tz: avail?.tz ?? DEFAULT_AVAILABILITY.tz,
        note: avail?.note ?? DEFAULT_AVAILABILITY.note,
      },
      projects: [...projMap.values()],
    };
  });
}

// Roster for assignment pickers — the single selectable list of team members.
export async function getRoster(): Promise<RosterMember[]> {
  const profiles = await prisma.profile.findMany({
    where: { role: "TEAM", active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { email: "asc" }],
    select: { id: true, name: true, email: true, photoUrl: true, title: true, accent: true },
  });
  return profiles.map((p) => {
    const name = memberName(p);
    return {
      id: p.id,
      name,
      photo: p.photoUrl ?? undefined,
      title: p.title ?? "Team member",
      accent: toAccent(p.accent, name),
    };
  });
}

export function capacityColor(v: number): Accent {
  return v > 0.85 ? "rose" : v > 0.7 ? "amber" : "mint";
}

export function capacityLabel(v: number): string {
  return v > 0.85 ? "At capacity" : v > 0.7 ? "Busy" : "Has room";
}
