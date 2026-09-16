// Notification.type values. Plain module (no server imports) so client
// components can import it too.
export const NOTIFICATION_TYPES = {
  formSent: "form_sent",
  formCompleted: "form_completed",
  answerChanged: "answer_changed",
  questionAsked: "question_asked",
  questionConfirm: "question_confirm",
  questionAnswered: "question_answered",
  questionConfirmed: "question_confirmed",
  questionChangeRequested: "question_change_requested",
  editApproved: "edit_approved",
  offerSent: "offer_sent",
  offerQuestion: "offer_question",
  offerApproved: "offer_approved",
  briefPublished: "brief_published",
  verificationAsked: "verification_asked",
  copyApprovalRequested: "copy_approval_requested",
  teamQuestion: "team_question",
  clientQuestion: "client_question",
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

// Types that require someone to actually view the underlying item before they
// clear — merely opening the notifications dropdown must NOT dismiss them.
export const ATTENTION_TYPES = [NOTIFICATION_TYPES.offerQuestion] as const;

// Client → team activity the dashboard "From clients" feed surfaces from the
// Notification table (document submissions are derived separately).
export const FEED_NOTIFICATION_TYPES: ReadonlySet<string> = new Set([
  NOTIFICATION_TYPES.questionAnswered,
  NOTIFICATION_TYPES.questionConfirmed,
  NOTIFICATION_TYPES.questionChangeRequested,
  NOTIFICATION_TYPES.editApproved,
  NOTIFICATION_TYPES.offerQuestion,
  NOTIFICATION_TYPES.clientQuestion,
]);
