import { prisma } from "@/lib/prisma";
import { hashAccent, type Accent } from "@/components/ui/kit";

// Phase 2 "derive + stub": team members are TEAM profiles; capacity and current
// projects are derived from assigned retainer tasks; profile copy (title, skills,
// availability, quote) is stubbed for editing in a later phase.

const CAPACITY_THRESHOLD = 6; // open assigned tasks that reads as "fully loaded"

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
  title: string;
  skills: string[];
  overview: string;
  quote: string;
  capacity: number; // 0..1
  openTasks: number;
  availability: { hours: string; tz: string; note: string };
  projects: MemberProject[];
};

const STUB = {
  title: "Team member",
  skills: ["Strategy", "Delivery", "Client comms"],
  overview:
    "Profile bio is a placeholder — add real overview, role, and focus areas in a later phase.",
  quote: "",
  availability: {
    hours: "Mon–Fri · 9:00–18:00",
    tz: "Local time",
    note: "Availability is a placeholder — wire real working hours in a later phase.",
  },
};

export async function getTeamData(): Promise<TeamMember[]> {
  const profiles = await prisma.profile.findMany({
    where: { role: "TEAM" },
    orderBy: [{ name: "asc" }, { email: "asc" }],
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

    const name = p.name ?? p.email.split("@")[0];
    return {
      id: p.id,
      name,
      email: p.email,
      color: hashAccent(name),
      title: STUB.title,
      skills: STUB.skills,
      overview: STUB.overview,
      quote: STUB.quote,
      capacity: Math.min(1, open.length / CAPACITY_THRESHOLD),
      openTasks: open.length,
      availability: STUB.availability,
      projects: [...projMap.values()],
    };
  });
}

export function capacityColor(v: number): Accent {
  return v > 0.85 ? "rose" : v > 0.7 ? "amber" : "mint";
}

export function capacityLabel(v: number): string {
  return v > 0.85 ? "At capacity" : v > 0.7 ? "Busy" : "Has room";
}
