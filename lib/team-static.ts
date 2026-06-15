import type { Accent } from "@/components/ui/kit";

// Static team data from the Claude Design bundle (data.jsx → teamProfiles,
// contentTeam, streamProjects). The four core members + their photos, with each
// member's "currently working on" computed from project membership.

export type MemberProject = { name: string; client: string; isRetainer: boolean; owner: boolean };

export type StaticMember = {
  id: string;
  name: string;
  photo: string;
  cat: string;
  catColor: Accent;
  title: string;
  overview: string;
  skills: string[];
  capacity: number;
  availability: { tz: string; hours: string; note: string };
  quote: string;
  projects: MemberProject[];
};

export type ContentMember = { id: string; name: string; role: string };
export type ContentTeam = {
  title: string;
  lead: string;
  overview: string;
  skills: string[];
  members: ContentMember[];
};

const CLIENT_NAME: Record<string, string> = {
  lumen: "Lumen Health",
  bg: "BG Diplomat",
  atlas: "Atlas Logistics",
  vela: "Vela Robotics",
  bloom: "Bloom Botanicals",
  northwind: "Northwind Capital",
  mesa: "Mesa Outdoor",
  pinecrest: "Pinecrest Schools",
};

type SP = { name: string; client: string; type: "PROJECT" | "ONGOING"; owner: string; team: string[] };
const STREAM_PROJECTS: SP[] = [
  { name: "Website & Brand System", client: "lumen", type: "PROJECT", owner: "tam", team: ["tam", "mo", "ma"] },
  { name: "Patient Mobile App", client: "lumen", type: "PROJECT", owner: "vik", team: ["vik", "tam"] },
  { name: "Provider CRM", client: "lumen", type: "PROJECT", owner: "mo", team: ["mo", "ma"] },
  { name: "Growth Retainer", client: "lumen", type: "ONGOING", owner: "du", team: ["du", "al"] },
  { name: "Website", client: "bg", type: "PROJECT", owner: "tam", team: ["tam", "mo"] },
  { name: "CRM Integration", client: "bg", type: "PROJECT", owner: "mo", team: ["mo", "vik"] },
  { name: "Social Media", client: "bg", type: "ONGOING", owner: "du", team: ["du", "al"] },
  { name: "Growth Retainer", client: "atlas", type: "ONGOING", owner: "ma", team: ["ma", "du", "al"] },
  { name: "Fleet Tracking Microsite", client: "atlas", type: "PROJECT", owner: "ma", team: ["ma", "tam"] },
  { name: "Product Design Sprint", client: "vela", type: "PROJECT", owner: "tam", team: ["tam", "vik"] },
  { name: "E-commerce Rebuild", client: "bloom", type: "PROJECT", owner: "vik", team: ["vik", "mo", "du"] },
  { name: "Brand Strategy", client: "northwind", type: "PROJECT", owner: "ma", team: ["ma", "tam"] },
  { name: "Marketing Retainer", client: "mesa", type: "ONGOING", owner: "du", team: ["du", "al", "ma"] },
  { name: "Website", client: "pinecrest", type: "PROJECT", owner: "mi", team: ["mi", "tam"] },
];

function projectsFor(id: string): MemberProject[] {
  return STREAM_PROJECTS.filter((p) => p.team.includes(id)).map((p) => ({
    name: p.name,
    client: CLIENT_NAME[p.client] ?? p.client,
    isRetainer: p.type === "ONGOING",
    owner: p.owner === id,
  }));
}

const PROFILES: Omit<StaticMember, "projects">[] = [
  {
    id: "mo", name: "Mo", photo: "/team/mo.png", cat: "TECHNICAL", catColor: "mint", title: "Technical Lead",
    overview: "Architects systems, leads development, and keeps the codebase healthy. Mainly dev & backend — makes sure everything actually works.",
    skills: ["Full-stack development", "System architecture", "AI integration", "DevOps"],
    capacity: 0.61,
    availability: { tz: "GMT+1", hours: "Mon–Fri · 10:00–18:00", note: "Async-friendly · deep-work mornings" },
    quote: "Technology should disappear into the background. The best systems are the ones users never have to think about — they just work, beautifully and reliably.",
  },
  {
    id: "vik", name: "Vik", photo: "/team/vik.png", cat: "TECHNICAL", catColor: "mint", title: "Technical · Data & Platform",
    overview: "Focuses on data, integrations, and platform reliability. Turns complex requirements into clean, maintainable systems.",
    skills: ["Data engineering", "API design", "Cloud infrastructure", "Security"],
    capacity: 0.68,
    availability: { tz: "GMT+1", hours: "Mon–Fri · 09:00–17:00", note: "Heads-down on integrations" },
    quote: "Good systems are invisible. When everything just connects and the data flows where it should, we've done our job.",
  },
  {
    id: "ma", name: "Ma", photo: "/team/ma.png", cat: "STRATEGY", catColor: "mint", title: "Project Lead & Strategy",
    overview: "Runs projects end-to-end and shapes brand positioning, creative direction, and market strategy. The point of contact who sees across everything.",
    skills: ["Project management", "Brand strategy", "Digital marketing", "UX research", "Growth strategy"],
    capacity: 0.74,
    availability: { tz: "GMT+1", hours: "Mon–Fri · 08:00–18:00", note: "Available for client calls · fastest to reply" },
    quote: "Every brand has a story worth telling. My job is to find that truth and craft it into something that resonates — not just looks good, but actually connects.",
  },
  {
    id: "tam", name: "Tam", photo: "/team/tam.png", cat: "CREATIVE", catColor: "blue", title: "Creative · Design & UX",
    overview: "Leads UX and visual design. Turns user research and strategy into interfaces and experiences that convert and delight.",
    skills: ["UX/UI design", "Design systems", "Prototyping", "Accessibility"],
    capacity: 0.92,
    availability: { tz: "GMT+1", hours: "Mon–Thu · 10:00–19:00", note: "At capacity this cycle — route new asks via Ma" },
    quote: "Design is how we close the gap between what a product does and what people need. Clarity first, beauty second.",
  },
];

export const TEAM_MEMBERS: StaticMember[] = PROFILES.map((p) => ({ ...p, projects: projectsFor(p.id) }));

export const CONTENT_TEAM: ContentTeam = {
  title: "Content Team",
  lead: "Mla",
  overview:
    "Produces all content — social, blog, video, photography, and campaign assets — led by Mla. They don't use the portal yet, but their work ships through the retainers.",
  skills: ["Copywriting", "Social media", "Video & motion", "Photography", "Campaigns"],
  members: [
    { id: "mla", name: "Mla", role: "Team lead" },
    { id: "al", name: "Al", role: "Content" },
    { id: "du", name: "Du", role: "Content" },
    { id: "da", name: "Da", role: "Content" },
    { id: "le", name: "Le", role: "Content" },
  ],
};
