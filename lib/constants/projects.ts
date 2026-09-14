import type { ProjectType } from "@prisma/client";

// Human labels for Project.type. One table — the dashboard, project lists and
// project pages all read from here.
export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  WEBSITE: "Website",
  BRANDING: "Branding",
  MARKETING: "Marketing",
  SOFTWARE_CRM: "Software / CRM",
  OTHER: "Other",
};

// <select> options in declaration order.
export const PROJECT_TYPE_OPTIONS = (Object.keys(PROJECT_TYPE_LABELS) as ProjectType[]).map((value) => ({
  value,
  label: PROJECT_TYPE_LABELS[value],
}));
