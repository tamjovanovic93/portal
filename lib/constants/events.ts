// Calendar event types. Manual events use the enum keys; derived entries
// (task / material / cycle) use lowercase source keys.

export const EVENT_TYPE_OPTIONS = [
  { value: "MEETING", label: "Meeting" },
  { value: "DEADLINE", label: "Deadline" },
  { value: "APPROVAL_GATE", label: "Approval Gate" },
  { value: "APPOINTMENT", label: "Appointment" },
  { value: "MILESTONE", label: "Milestone" },
];

export const EVENT_TYPE_COLORS: Record<string, string> = {
  MEETING: "bg-blue-500",
  DEADLINE: "bg-red-500",
  APPROVAL_GATE: "bg-amber-500",
  APPOINTMENT: "bg-purple-500",
  MILESTONE: "bg-green-500",
  TASK_DUE: "bg-neutral-400",
  task: "bg-neutral-400",
  material: "bg-red-400",
  cycle: "bg-blue-600",
};

export const EVENT_TYPE_LABEL: Record<string, string> = {
  MEETING: "Meeting",
  DEADLINE: "Deadline",
  APPROVAL_GATE: "Approval Gate",
  APPOINTMENT: "Appointment",
  MILESTONE: "Milestone",
  TASK_DUE: "Task Due",
  task: "Task",
  material: "Material Due",
  cycle: "Cycle Ends",
};
