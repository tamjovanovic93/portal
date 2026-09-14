// Document.templateType values. Import these instead of retyping the strings.
export const TEMPLATE_TYPES = {
  intakeForm: "intake_form",
  initialClientForm: "initial_client_form",
  financialOffer: "financial_offer",
  projectBrief: "project_brief",
  wireframeFeedback: "wireframe_feedback",
  designFeedback: "design_feedback",
  clientProfile: "client_profile",
  strategy: "strategy",
  verificationQueue: "verification_queue",
  brandKit: "brand_kit",
} as const;

export type TemplateType = (typeof TEMPLATE_TYPES)[keyof typeof TEMPLATE_TYPES];

// Client-level onboarding documents, in flow order.
export const ONBOARDING_TEMPLATE_TYPES = [
  TEMPLATE_TYPES.initialClientForm,
  TEMPLATE_TYPES.financialOffer,
  TEMPLATE_TYPES.intakeForm,
] as const;

// Forms that use the collaborative prefill → approve/change → review flow.
export const COLLAB_FORM_TYPES: ReadonlySet<string> = new Set([
  TEMPLATE_TYPES.initialClientForm,
  TEMPLATE_TYPES.intakeForm,
]);

// Shared Client Data documents (one per client, projectId null).
export const CLIENT_DATA_TEMPLATE_TYPES = [
  TEMPLATE_TYPES.clientProfile,
  TEMPLATE_TYPES.strategy,
  TEMPLATE_TYPES.verificationQueue,
  TEMPLATE_TYPES.brandKit,
] as const;
