# Zero-Point Portal — Phased Implementation Plan

_Companion to `PROJECT_ANALYSIS.md` (the report). This file is the execution plan; the report stays as-is._

## Ground rules

1. **No visual changes.** Every phase must leave each screen pixel-identical (same markup output, same classes/tokens resolved to the same colors, same copy). Where a task touches presentation, the acceptance criterion is "before/after screenshots match". The only exceptions are new *states* that don't exist today (e.g. a route-level loading state) and are explicitly marked **[additive — confirm]**.
2. **Code fixes only.** No test suite, no CI. Each phase has a manual verification checklist instead.
3. **Deployed on Vercel.** Long-running work is moved to a jobs table + Vercel function/cron; no new vendors.
4. **Client Data JSON stays JSON**, protected with optimistic locking (`version` column) — not migrated to relational tables.
5. **One branch/PR per phase**, deployed in order. Phases 1–2 are the only ones that must ship immediately; the rest can be paced.
6. **Database changes** go through `prisma migrate dev` → commit → `prisma migrate deploy`. One-off data fixes go in `scripts/` with the phase number in the filename and are archived after they run in production.
7. Before Phase 1: take a Supabase DB backup and a screenshot baseline of every route (team: dashboard, clients, client stream, client data ×7 tabs, project, retainer project, stage pages 1–7, team, weekly, calendar, materials; client: portal home, document, brief, wireframes, design; auth: login, update-password).

Rough effort is given per phase in developer-days for one person familiar with the code.

---

## Phase 0 — Prep (0.5 day)

Goal: make later phases safe and mechanical.

| # | Task | Details |
|---|------|---------|
| 0.1 | `.env.example` | List the 6 vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL`, `ANTHROPIC_API_KEY`) with comments. Confirm on Vercel that `DATABASE_URL` is the **pooler** URL (`…pooler.supabase.com:6543/…?pgbouncer=true&connection_limit=1`) and `DIRECT_URL` the direct one. |
| 0.2 | `package.json` scripts | Add `"typecheck": "tsc --noEmit"`, `"db:migrate": "prisma migrate deploy"`, `"db:dev": "prisma migrate dev"`. Run `typecheck` + `lint` at the end of every phase. |
| 0.3 | Screenshot baseline | Capture the route list from the ground rules at 1440px (team) / 1024px (client). Store outside the repo. |
| 0.4 | Shared folders | Create empty `lib/auth/`, `lib/constants/`, `lib/validation/`, `lib/ai/`, `lib/format.ts`, `lib/supabase/admin.ts` so later phases have a home. |

---

## Phase 1 — Security & authorization (2–3 days) — SHIP FIRST

Goal: authorization derived from the DB role, consistent everywhere, ownership enforced on every client-callable mutation.

### 1.1 Single session helper — `lib/auth/session.ts`
```ts
import { cache } from "react";
export type SessionUser = { id: string; email: string; role: "TEAM" | "CLIENT" };

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();                 // lib/supabase/server
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const profile = await prisma.profile.findUnique({ where: { id: user.id }, select: { role: true, email: true, active: true } });
  if (!profile) return null;
  return { id: user.id, email: profile.email, role: profile.role };
});
export async function requireUser() { const u = await getSessionUser(); if (!u) throw new Error("Unauthorized"); return u; }
export async function requireTeam() { const u = await requireUser(); if (u.role !== "TEAM") throw new Error("Unauthorized"); return u; }
```
- `React.cache` dedupes across proxy-excluded layers: layout + `NotificationsBell` + page + any action in the same request now share one `getUser()` and one `profile` read.
- Add `lib/auth/access.ts` with ownership guards (all return the loaded entity so callers don't re-query):
  - `requireProjectAccess(projectId)` — team, or `project.clientId === user.id`.
  - `requireDocumentAccess(documentId)` — team, or doc owner via `doc.clientId ?? doc.project.clientId` (this logic already exists in `app/actions/documents.ts:35 ownerClientId` — move it here).
  - `requireTaskAccess(taskId)` — via `task.cycle.project.clientId` (pattern from `client-approvals.ts:142`).

### 1.2 Replace all local auth helpers
Delete every `requireTeam / getTeamUser / assertTeam / requireUser / getAuthUser / getClientProfile` defined inside `app/actions/*` (15 + 6 copies) and import from `lib/auth`. Keep the existing return contract of each action (some `throw`, some `return { error }`) so the UI doesn't change — wrap with a tiny `try { await requireTeam() } catch { return { error: "Unauthorized" } }` where the action currently returns an error object (`projects.ts`, `assets.ts`, `stages.ts`, `events.ts`, `materials.ts`, `notifications.ts`).

This automatically fixes every lowercase `"client"` comparison in actions. Then fix the remaining non-action sites:
- `app/api/upload/route.ts:16`, `app/api/download/route.ts:33`, `app/api/client-upload/route.ts:19` → use `getSessionUser()`.
- `app/page.tsx:13`, `app/actions/auth.ts:24-26`, `app/update-password/page.tsx:38-39` → decide destination from `role === "CLIENT"` (from `getSessionUser`, or `app_metadata` in the client-side page).
- `app/(team)/layout.tsx`, `app/(client)/layout.tsx` → `getSessionUser()`.

### 1.3 Add ownership checks where missing
| Action | Guard to add |
|--------|--------------|
| `design.ts` `saveDesignFeedback`, `submitDesignFeedback` | `requireDocumentAccess(documentId)` |
| `design.ts` `approveDesignAndSubmit`, `wireframes.ts` `approveWireframesAndSubmit` | `requireDocumentAccess(documentId)` **and** assert `doc.projectId === projectId`; take `projectId` from the doc instead of trusting the argument |
| `wireframes.ts` `saveWireframeFeedback`, `submitWireframeFeedback` | `requireDocumentAccess` |
| `stages.ts` `recordApproval` | `requireProjectAccess(projectId)`; clients limited to `method === "PORTAL"` (existing rule, now actually enforced) |
| `stages.ts` `advanceStage` | `requireTeam` (via 1.2) |
| `materials.ts` `updateMaterialStatus` | `requireProjectAccess(item.projectId)` (replaces `assertOwnsProject`) |
| `questions.ts` `answerQuestion`, `respondConfirm` | keep logic but base it on `SessionUser.role` |
| `client-approvals.ts` `acknowledgeApprovalItem` | `requireTeam` (currently any user) |
| `documents.ts` `saveDocument`, `submitDocument` | switch to `requireDocumentAccess` (same behavior) |
| `api/upload` | team only; `api/client-upload` → `requireProjectAccess`; `api/download` → team, or owner **and** `visibility === "SHARED"` |

### 1.4 Role in `app_metadata` (for the proxy)
The proxy cannot cheaply hit Prisma, so mirror the role into the JWT:
- `clients.ts createClientAccount`, `projects.ts createProject/generateClientAccess`: `auth.admin.createUser({ …, app_metadata: { role: "CLIENT" }, user_metadata: {} })`.
- One-off `scripts/p1-sync-app-metadata.mjs`: for every `profiles` row, `auth.admin.updateUserById(id, { app_metadata: { role } })` (skip ids without an auth user).
- `proxy.ts`: replace `supabase.auth.getUser()` with `supabase.auth.getClaims()` (local JWT verification, no network round-trip; available in `@supabase/supabase-js` ≥ 2.5x — already ^2.106) and read `claims.app_metadata.role`. Keep the same redirect rules. The proxy only routes; real authorization happens in 1.1–1.3.
- `supabase/setup.sql` `handle_new_user`: read `raw_app_meta_data->>'role'` (fallback `raw_user_meta_data` for old users), and guard the insert with `where not exists (select 1 from public.profiles where id = new.id or email = new.email)` so a team member who was pre-created by email doesn't break signup. Apply the same change as a Prisma migration (`--create-only`, paste SQL) so it's versioned.

### 1.5 Team member logins
`team.ts createTeamMember` currently inserts a profile with `crypto.randomUUID()` and no login. Change to: `auth.admin.createUser({ email, email_confirm: true, app_metadata: { role: "TEAM" } })` and use `user.id` as the profile id (same fields as today). The member signs in via the existing "Forgot password" flow. No UI change (the modal already collects the email). `updateTeamMember`/`deactivateTeamMember` unchanged; when deactivating also `auth.admin.updateUserById(id, { ban_duration: "876000h" })` so a deactivated member can't log in (optional; no UI impact).

### 1.6 Misc hardening
- `lib/supabase/admin.ts` → `createAdminClient()`; replace the 7 inline constructions (and the two `require()` calls in `projects.ts:354`, `clients.ts:33`).
- Temp passwords: `crypto.randomInt` over the existing alphabet (`clients.ts:10`); delete `projects.ts generateClientAccess` + `components/team/project/ClientLoginLink.tsx` **only if** you accept losing the "Get client credentials" button on the project header — otherwise keep the button and make it call `resetClientPassword(project.clientId)`. (Recommended: keep button, reroute.)
- `api/upload`, `api/client-upload`: validate `visibility` against the `Visibility` enum, `stageNumber` as int 1–7, and add an extension/MIME allowlist (images, pdf, office docs, zip, txt/md/csv, common design formats). Return 400 on violation.

### Verification (manual)
- As a client: call `supabase.auth.updateUser({ data: { role: "TEAM" } })` from the browser console, reload → still redirected to `/portal`; `/dashboard` still redirects; `fetch("/api/download?id=<internal asset>")` → 403.
- As a client: `POST /api/upload` → 401; approve/wireframe actions with a foreign `documentId` → error.
- As team: everything works as before; new team member created via modal can log in after password reset.
- `npm run typecheck && npm run lint` clean.

---

## Phase 2 — Functional bugs (2 days)

### 2.1 Stage-number drift
- Replace literals with constants: `components/team/WireframeSection.tsx:39` → `String(WIREFRAME_STAGE)`; `components/team/MockupSection.tsx:61` and `components/client/DesignFeedbackForm.tsx:146` → `String(DESIGN_STAGE)`; `app/(team)/dashboard/page.tsx:406` → `` `/projects/${id}/stage/${WIREFRAME_STAGE}` ``.
- `scripts/p2-fix-asset-stages.mjs` (idempotent):
  ```sql
  update project_assets set stage_number = 2 where folder = 'wireframes' and stage_number = 3;
  update project_assets set stage_number = 3 where folder in ('mockup','design-feedback') and stage_number = 4;
  update documents set stage_number = 2 where template_type = 'wireframe_feedback' and stage_number = 3;
  update documents set stage_number = 3 where template_type = 'design_feedback' and stage_number = 4;
  ```
- Text-only: `NewProjectButton.tsx:156` "stages 1–8" → "stages 1–7" **[copy fix — confirm]**.

### 2.2 Remove the legacy project-scoped onboarding pipeline
- Delete `components/team/project/IntakePipeline.tsx`, `OnboardingPipeline.tsx`; remove their render blocks in `app/(team)/projects/[id]/page.tsx:497-567` (keep the "Project setup — completed" card? It only renders when `setupComplete`; keep it, it's harmless) and `RetainerView.tsx:347-371`.
- Delete `onboarding.ts` `createIntakeForm`, `createOffer` (`:334-376`) and the `onboardingDocs` query in the project page (`:119-130`) plus derived vars `initialFormDoc/offerDoc/intakeDoc/intakeSubmitted/intakeApproved`.
- Keep `stage/[n]/documents/[docId]/page.tsx` for real stage documents (QA, handoff, sign-off); legacy project-scoped intake/offer docs still open there read-only.
- `project-brief.ts generateBriefDraft:231-235`: read `intake_form`/`initial_client_form` by `clientId: project.clientId` instead of `projectId`.

### 2.3 One "published" flag for the brief
- Source of truth: `Project.briefPublishedAt`.
- `project-brief.ts publishBrief/unpublishBrief` set/clear `Project.briefPublishedAt` (keep writing `content.publishedAt` as a mirror for the card's "Published" chip, or read the chip from the project — pass `publishedAt={project.briefPublishedAt}` from the page). Delete `onboarding.ts publishBrief/unpublishBrief` (only used by the removed pipeline).
- `portal/brief/[projectId]/page.tsx`: `publishedBriefs` filter uses `project.briefPublishedAt` (all briefs of a published project).

### 2.4 One "health" concept
- Delete `ProjectHealthControl.tsx`, `setProjectHealth` in `projects.ts`. Leave the `health` column for now (drop in Phase 7 cleanup migration). Dashboard heuristic stays as the only health.

### 2.5 No writes during render
- `projects/[id]/page.tsx:138-142`: remove `ensureProjectBrief` fallback; `BriefsSection` already renders "Preparing this project's brief…" when null. Both creation paths (`createProject`, `approveSuggestion`) already create the brief.
- Wireframe/design feedback docs: move find-or-create into the actions. Add `getOrCreateFeedbackDoc(projectId, templateType)` in `lib/documents/feedback.ts` using `upsert`-like `findFirst → create` inside a `$transaction` (the partial unique index already prevents duplicates). Call it from `saveWireframeFeedback`, `submitWireframeFeedback`, `approveWireframesAndSubmit` (and design equivalents) — the client components currently receive `documentId` from the page; change props to `projectId` and have the actions resolve the doc. Pages become read-only (`findFirst`; if null → `content = {}`, `isSubmitted = false`).
- Reset-on-new-uploads (`portal/wireframes:74-84`, `portal/design:71-81`): move to `api/upload` — after a successful upload with `folder in ('wireframes','mockup')`, if the matching feedback doc is `APPROVED` and older than now, reset it there (team upload = mutation context). Same behavior, no render side effect.
- `RetainerView.tsx:103-112` stage backfill: move to `scripts/p2-backfill-stages.mjs`, run once, delete the block.

### 2.6 Cleanup on delete
- `lib/storage.ts`: `removeStorageObjects(paths: string[])` — chunks of 100, best-effort, logs failures.
- `deleteProject`, `deleteClient`: select `storagePath` of all affected `project_assets` **before** the transaction, run the transaction, then call `removeStorageObjects`.
- `deleteDocument`: inside a transaction also `question.deleteMany({ where: { contextType: "BRIEF", contextId: documentId } })` and `notification.deleteMany({ where: { link: { contains: documentId } } })`.
- `deleteTask`: also `question.deleteMany({ where: { contextType: "TASK", contextId: taskId } })`.
- `deleteAsset`/`deleteDesignAsset`: already remove the object; make the DB delete + storage remove order consistent (DB first, storage after, log on failure).

### 2.7 Input validation at the boundary
- `lib/validation/*.ts` with zod schemas per action family (materials, events, retainer tasks/cycles, team member, client, project). `parseForm(schema, formData)` returns `{ data } | { error: string }`; actions return the error string in the same shape they use today (`{ error }`), so the UI shows it in its existing error slot.
- Validate `category` (5 values), `status` enums, `EventType`, dates (`!isNaN(Date.parse(x))`), `stageNumber` 1–7, emails.

### 2.8 Small bugs
- `update-password/page.tsx:39` → compare against `"CLIENT"` from `user.app_metadata?.role`.
- `dashboard/page.tsx:406` (done in 2.1).
- `ProjectFiles` rendered twice in `projects/[id]/page.tsx` (`:888` and `:1087`): the second is inside the "Files" tab which is the default tab → both are visible today. **Keep both** (visual constraint) but render from one shared `assets` mapping variable to avoid the duplicated `.map`.

### Verification
- Upload a wireframe → it appears in `/portal/wireframes/[id]` and stage 2 page; same for mockups → stage 3 / `/portal/design`.
- Project page renders with no DB writes (check Prisma query log in dev).
- Delete a project → its storage folder is gone; delete a doc with offer questions → questions gone.
- Publish brief from the card → portal home shows "Your Brief & Strategy".

---

## Phase 3 — Performance quick wins (2 days)

### 3.1 Auth round-trips
- Done structurally by `getSessionUser` (Phase 1). Additionally: `NotificationsBell.tsx` takes `user` from the layout as props instead of calling Supabase again; `proxy.ts` uses `getClaims()`.

### 3.2 Revalidation hygiene
- Replace `revalidatePath("/", "layout")` (`auth.ts:25,32`, `notifications.ts:24,43`) with the narrow paths: notifications → `/dashboard` and `/portal`; login/logout keep `layout` (rare).
- Remove `router.refresh()` calls that follow a server action which already calls `revalidatePath` for the current route (Next refreshes the router from the action response). Grep `router.refresh()` (≈35 sites: `ProjectBriefCard`, `BrandKitCard`, `QuestionsPanel`, `SuggestedProjectsPanel`, `ProjectFiles`, `MockupSection`, `WireframeSection`, `MarkReviewedButton`, `ClientInbox`, `Notifications`, `EditClientButton`, `ClientUploadAction`, `AnswerQuestions`…). Keep `router.refresh()` only after `fetch("/api/upload")` (API routes don't revalidate) and after `router.push`.
- Actions that revalidate 4–5 paths: trim to the paths that actually render the data (e.g. `updateTaskNotes` only needs `/projects/[id]`, not `/dashboard`).

### 3.3 Route-level streaming **[additive — confirm]**
- Add `app/(team)/loading.tsx` and `app/(client)/loading.tsx` that render the themed root with nothing inside (same background as the page — visually "blank until loaded", which is what users see today, but navigation becomes instant and the sidebar/topbar stay interactive).
- Wrap the heavy, below-the-fold sections in `<Suspense fallback={<div style={{ minHeight: N }} />}>` where `N` matches the section's typical height: dashboard "Recent activity", project page "Latest uploads / Activity / Tabs", client data tables. Fallback is an empty spacer of the same height → no layout shift, no visual difference once loaded.

### 3.4 Indexes (migration `p3_indexes`)
```sql
create index documents_client_id_template_type_idx on documents (client_id, template_type);
create index documents_project_id_template_type_idx on documents (project_id, template_type);
create index documents_status_completed_at_idx on documents (status, completed_at);
create index tasks_due_date_idx on tasks (due_date);
create index tasks_stage_number_idx on tasks (stage_number);
create index tasks_source_brief_id_idx on tasks (source_brief_id);
create index material_items_status_due_date_idx on material_items (status, due_date);
create index notifications_recipient_role_read_at_idx on notifications (recipient_role, read_at);
create index notifications_recipient_id_read_at_idx on notifications (recipient_id, read_at);
create index projects_is_archived_idx on projects (is_archived);
create index app_events_start_at_idx on app_events (start_at);
```
Mirror them as `@@index` in `schema.prisma`.

### 3.5 Image galleries
- `lib/storage.ts getSignedUrls(paths, ttl)` using `createSignedUrls` (one call). In `portal/wireframes`, `portal/design`, `stage/[n]` pass `url` per asset to `WireframeFeedbackForm` / `DesignFeedbackForm` / `MockupSection`; `<img src={url}>`. Keep `/api/download` for explicit download links. Rendering is identical; each image no longer costs an auth + DB + redirect.

### 3.6 Fonts
- `app/layout.tsx`: audit weights actually used (`design.css`: page-title 600, eyebrow/figure 600–700, body 400–600, mono 400–600). Load Fredoka `["600"]`, Chakra `["600","700"]`, Plex Sans `["400","500","600","700"]`, Plex Mono `["400","500","600"]`. Only drop a weight if grep confirms no `font-weight`/`fontWeight` uses it → zero visual change.

### 3.7 Project page duplicate query
- `projects/[id]/page.tsx:80-87` + `:89-114`: fold the `mode` check into the main query (`select` includes `mode`; if `ONGOING` return `<RetainerView>` after the single fetch, or have `RetainerView` accept the loaded project). Saves one round-trip per project view.

### Verification
- Chrome DevTools → Network: dashboard TTFB before/after; count of `auth/v1/user` calls per navigation = 1 (or 0 with claims in proxy).
- Screenshots match baseline.

---

## Phase 4 — Data integrity & concurrency (2 days)

### 4.1 Optimistic locking on `documents`
- Migration: `alter table documents add column version integer not null default 0;` + `version Int @default(0)` in schema.
- `lib/intake/store.ts mutateDoc`: read `{ id, content, version }`; apply `fn`; `updateMany({ where: { id, version }, data: { content, version: { increment: 1 } } })`; if `count === 0` re-read and retry (max 3, then throw). Because all mutators are pure functions of the content, retries are transparent to the user.
- Apply the same helper to `project-brief.ts mutateBrief`, `brand-kit.ts mutate`, `onboarding.ts persistContent` (change `changeAnswer/askQuestion/approveEdit/answerQuestion` to use a `mutateContent(documentId, fn)` wrapper), `design.ts updateRevisionStatus`, `brief.ts` (already on `mutateDoc`).
- `documents.ts saveDocument` (full-content save from forms): merge instead of replace — `mutateContent(id, latest => ({ ...latest, ...clientValues, _collab: mergeCollab(latest._collab, clientValues._collab), _config: clientValues._config ?? latest._config }))`. Prevents a form save from clobbering `_collab` edits made concurrently by the other party.

### 4.2 Transactions
- `scope.ts syncScopeTasks`: wrap cycle creation + task upserts + deletions + brief `scopeCycles` write in one `$transaction(async tx => …)` (interactive; keep the AI call **outside** the transaction).
- `suggested-projects.ts approveSuggestion`: project create + suggestion update in one transaction.
- `clients.ts createClientAccount`: if profile/doc creation fails after `auth.admin.createUser`, call `auth.admin.deleteUser` (compensating action) and return the error.
- `project-brief.ts renameBrief`, `brief.ts resolveVerificationItem` (two docs): transaction.

### 4.3 Per-recipient notifications
- `lib/notifications.ts notifyTeam`: fan out — `profile.findMany({ where: { role: "TEAM", active: true } })` → `notification.createMany` with `recipientId` per member (keep `recipientRole: "TEAM"` on the rows for filtering). `listNotifications`/`unreadCount`/`markNotificationsRead` for TEAM users filter by `recipientId = userId` (plus legacy rows `recipientId null AND recipientRole = 'TEAM'` until `scripts/p4-fanout-legacy-notifications.mjs` copies them per member and deletes the originals).
- `markNotificationSeen`: `where: { id, recipientId: userId }`.
- `deleteClient` notification purge: `link contains docId` still works (rows now per member).
- Behavior change (not visual): "Mark seen" clears for the current member only. Update the comment in `notifications.ts:28-30` and `ClientInbox.tsx` (dead component — delete in Phase 7).

### 4.4 Typed notification & template ids
- `lib/notifications.ts`: `export const NOTIFICATION_TYPES = { formSent: "form_sent", … } as const; type NotificationType = …`; `ATTENTION_TYPES` derived from it; `components/Notifications.tsx:19` imports it instead of redefining.
- `lib/documents/types.ts`: `TEMPLATE_TYPES` const (`intake_form`, `initial_client_form`, `financial_offer`, `project_brief`, `wireframe_feedback`, `design_feedback`, `client_profile`, `strategy`, `verification_queue`, `brand_kit`, …), `COLLAB_FORMS`, `ONBOARDING_TYPES`, `CLIENT_DATA_TYPES`. Replace the ~40 raw strings (grep `templateType: "` and `templateType === "`).

### 4.5 Verification-question context ids
- `brief.ts sendVerificationToClient`: use `contextId = \`${clientId}:${itemId}\`` (and parse it back in `questions.ts answerQuestion:138-152` / `lib/questions.ts`). One-off script to rewrite existing VERIFICATION rows (`contextId → recipientId + ":" + contextId`).

### Verification
- Two browser sessions editing the same client profile table (add rows in each) → both rows persist.
- Two team users: one opens the bell → the other's unread count is unchanged.

---

## Phase 5 — AI pipeline off the request path (3 days)

Goal: identical buttons/labels; work runs in a Vercel function bounded by `maxDuration`, tracked in a jobs table, resumable by cron.

### 5.1 `lib/ai/`
- `lib/ai/models.ts`: `MODELS = { deep: process.env.AI_MODEL_DEEP ?? "claude-opus-4-8", fast: process.env.AI_MODEL_FAST ?? "claude-sonnet-4-6" }`, `WEB_SEARCH_TOOL = process.env.AI_WEB_SEARCH_TOOL ?? "web_search_20260209"`. Remove the 4 `MODEL` consts.
- `lib/ai/client.ts`: one `runAgent({ prompt, model, maxTokens, webSearch, thinking })` (the loop from `intake.ts callAgent` incl. `pause_turn` handling and the web-search fallback), and `parseJson<T>(text, schema: ZodSchema<T>)` replacing the 3 `extractJson` copies — brace-slice then **zod-validate** before persisting. Record `message.usage` → `ai_jobs.inputTokens/outputTokens`.
- `lib/ai/prompts/{intake,strategy,suggestions,briefDraft,scopeBreakdown}.ts`: move the template literals out of the actions (pure functions of their inputs). The stage-breakdown prompt is shared with `scripts/migrate-task-stages.mjs` (archive that script instead).

### 5.2 Jobs table
```prisma
model AiJob {
  id        String   @id @default(uuid()) @db.Uuid
  type      String   // intake | strategy | suggestions | brief_draft | scope_sync
  targetId  String   @db.Uuid   // clientId or documentId
  status    String   @default("queued") // queued | running | done | failed
  error     String?
  result    Json?
  createdBy String   @db.Uuid
  startedAt DateTime? ; finishedAt DateTime? ; inputTokens Int? ; outputTokens Int?
  createdAt DateTime @default(now()) ; updatedAt DateTime @updatedAt
  @@index([status, createdAt]) @@index([targetId, type])
}
```

### 5.3 Execution on Vercel
- `app/api/ai/run/route.ts`: `export const maxDuration = 300;` (check the Vercel plan limit; Hobby is lower — if on Hobby, upgrade or split the intake agent into 2 jobs: profile, then verification queue). Body `{ jobId, secret }` where `secret = process.env.AI_JOB_SECRET`. Claims the job (`updateMany where status='queued'` → `running`), runs the existing agent code (moved from the actions into `lib/ai/jobs/*.ts`), writes results with the same `upsertIntakeDoc`/`mutateBrief` calls as today, marks `done/failed`, and `revalidatePath` for the affected client/project pages.
- Actions become: `runIntakeAgent(clientId)` → precondition checks (same error messages) → create `AiJob` → `after(() => fetch(runUrl, { method: "POST", body }))` (`after` from `next/server`, keeps the action fast) → return `{ jobId }`.
- `vercel.json` cron: `/api/ai/sweep` every 2 minutes — re-dispatches `queued` jobs older than 1 min and marks `running` jobs older than `maxDuration` as `failed` (so a killed function never leaves a job stuck).
- `getAiJob(jobId)` server action for polling.

### 5.4 UI (no visual change)
- `ClientIntakePipeline`, `SuggestedProjectsPanel`, `ProjectBriefCard` (generate draft), `ScopeSyncBar`: replace `await action()` with `const { jobId } = await action(); poll getAiJob(jobId) every 4 s until done/failed`, then the same `setError`/refresh handling as now. Button text stays "Running…/Generating…/Syncing…" during polling. A page reload while a job runs: on mount, look up the latest `running` job for the target (pass it from the page as a prop) and resume polling — so the button shows "Running…" instead of appearing idle.
- `syncScopeTasks`: the DB part stays synchronous (fast); only the AI `breakdown()` moves to a job when `useAi` is true. Simplest: keep the existing 20 s timeout path for now and treat scope sync as a Phase 5b follow-up if it proves slow.

### Verification
- Run intake on a test client: action returns in < 1 s; job row goes queued → running → done; profile/verification docs written; page revalidated; bell/dashboard unaffected. Kill the function mid-run (deploy) → sweep marks it failed and the UI shows the error text.

---

## Phase 6 — Dashboard & heavy pages (3 days)

Goal: same rendered output, a fraction of the rows.

### 6.1 Dashboard (`app/(team)/dashboard/page.tsx`)
- Split into `app/(team)/dashboard/{queries.ts, derive.ts, page.tsx}` + section components (`StatTilesSection`, `ProjectsGrid`, `RightRail`, `RecentActivity`) each an async server component under its own `<Suspense>` (Phase 3.3 spacer fallback).
- Replace the mega `project.findMany … include everything` with:
  - projects: `select` only scalar fields + `client` + `stages (stageNumber,status,gateApproved)`.
  - counts via `groupBy`: materials by `(projectId, status)` and overdue materials by `projectId`; documents `DRAFT` count by `projectId`; tasks `groupBy(projectId? — via cycle)` → use a raw SQL view or `task.groupBy({ by: ["cycleId"] })` + cycle→project map; blockers/overdue/awaiting via three small `groupBy` queries with `where` filters.
  - `healthById` computed from those counts (same formula, same numbers).
- `MyWork` data: query only tasks for `currentUserId` by default (`assigneeId = me`), and lazily load "Everyone"/other member via a server action `listWorkTasks({ assigneeId })` when the user changes the select (component already has the `who` state). Payload drops from 500 tasks to the user's own.
- `getTeamData()` (used for the capacity rail): replace the "load all team tasks" with `task.groupBy({ by: ["assigneeId"], where: { status: { not: "DONE" } }, _count })` + a small query for each member's project list (`findMany distinct` on cycle.project, `take 10`). Same `capacity` numbers.
- Feeds (`recentApprovals`, `recentUploads`, …) already use `take`; keep.

### 6.2 Project page (`projects/[id]/page.tsx`)
- Split into `queries.ts` / `derive.ts` / section components: `ProjectHeader`, `StatusSummary`, `SetupCard`, `AttentionSection`, `WaitingSection`, `CompletedSection`, `MaterialsChecklist`, `UploadsAndActivity`, `ProjectTabs`. Pure move of JSX; identical output.
- Replace the single giant `include` with per-section queries inside their Suspense boundaries (assets `take 50`, approvals `take 50`, cycles/tasks only for the task board).
- Brief card autosave: `ProjectBriefCard` sub-editors call actions on blur then `router.refresh()`; with Phase 3.2 the refresh is gone, and the action's `revalidatePath` only refreshes the project route once per save. Additionally debounce list `commit()` calls in `ScopeList`/`EditableList`/`SitemapEditor` (300 ms) so typing a date doesn't save per keystroke.

### 6.3 Client Data page (`clients/[id]/data/page.tsx`)
- Keep `?tab=` URLs (bookmarkable, same look) but stop computing every tab: read `tab` first, run only that tab's derivations, and load `suggestedProject` rows only for `tab === "projects"`, `brandKit/logos` only for `brand`, `verification` only for `verify` (the tab **counts** in the nav need light queries: `count`/JSON `length` from the profile you already loaded — profile/strategy are needed for counts anyway; suggestions count via `suggestedProject.count`).
- Extract the ~30 `BriefTable` column definitions to `lib/constants/clientDataTables.ts` (pure data) and the 7 tab bodies into `components/team/data/tabs/*.tsx`.

### 6.4 Portal home (`(client)/portal/page.tsx`)
- Move `MiniDashboard` and `OnboardingForms` out of the render function into `components/client/`.
- Replace `include: { cycles: { tasks: … } }` with tasks filtered server-side (`type != INTERNAL`, active cycles) — the page already filters INTERNAL in JS.

### Verification
- Dashboard numbers (tiles, health %, rail counts) identical to before on the same data; Prisma query log shows no query returning > 200 rows.

---

## Phase 7 — Code consolidation & dead code (3 days)

All changes are refactors with identical output.

### 7.1 Constants — `lib/constants/`
| File | Contents | Replaces |
|------|----------|----------|
| `projects.ts` | `PROJECT_TYPE_LABELS` (5 copies), `PROJECT_TYPE_OPTIONS` (`NewProjectButton`) | dashboard, projects, projects/[id], RetainerView, clients/[id] |
| `materials.ts` | `MATERIAL_CATEGORIES`, `MATERIAL_CATEGORY_OPTIONS`, `MATERIAL_STATUS_LABEL`, `MATERIAL_STATUS_STYLE` (two variants exist: the project page's text classes and the materials page's pill colors — keep both, named) | 5 files |
| `tasks.ts` | `TASK_STATUSES`, `INTERNAL_STATUSES`, `KANBAN_COLUMNS`, `TASK_TYPE_LABEL/CLASS`, `STAGE_CHOICES` (derive from `STAGE_COUNT`: `[2..STAGE_COUNT]`) | CycleBoard, StageTasks |
| `events.ts` | `EVENT_TYPE_OPTIONS`, `TYPE_COLORS`, `TYPE_LABEL` | CalendarView, NewEventModal |
| `approvals.ts` | `APPROVAL_METHOD_LABEL`, `MESSAGE_TYPE_LABELS` | projects/[id], BriefApprovalItem |
| `documents.ts` | `DOC_STATUS_LABEL`, `DOC_STATUS_CLASS`, `COLLAB_FORMS` (+ Phase 4.4 template ids) | both document pages, stage page, portal doc page |
| `ui.ts` | `ACCENTS` list (lib/team.ts, team.ts action, TeamMemberModal) | 3 |

### 7.2 Helpers — `lib/format.ts`
`formatBytes` (4 copies), `timeAgo`, `formatUpcomingDate`, `labelFromFilename` (2), `toDateInput` (3 variants in CycleBoard/StageTasks/BlockerUnblockControl), `formatWhen`. Keep each function's exact output format so text doesn't change; where two copies differ (`formatBytes` with/without the `B` branch), keep both behaviors under two names and map call sites 1:1.

### 7.3 Components
- `components/ui/Modal.tsx`: the portal + `theme-dark fixed inset-0 …` overlay + `bg-white rounded-lg shadow-xl …` card markup from `NewProjectButton`/`NewClientButton`/`TeamMemberModal`/`EditClientButton`, parameterized by `maxWidth` class and `scroll` (TeamMemberModal has `max-h-[90vh] overflow-y-auto`). Same classes → same pixels.
- `components/team/PipelineStep.tsx`: the `Step` component duplicated 4× (two variants: with/without `desc`, with/without `disabled` — one component with optional props).
- `components/team/StagePips.tsx`: the two `StagePips` (projects list uses Tailwind classes, client stream uses tokens + glow — they **look different**; keep both variants as `variant="list" | "stream"` in one file).
- `components/team/project/OnboardingDocView.tsx`: the shared body of `clients/[id]/documents/[docId]/page.tsx` and `projects/[id]/stage/[n]/documents/[docId]/page.tsx` (status label, collab banners, offer/intake/form branching). Pages keep their own breadcrumbs/headers.
- `components/DocumentForm/`: split into `fields/*.tsx` (the 9 renderers + `FieldRenderer` + `displayValue`), `EditableForm.tsx`, `RespondForm.tsx`, `ReviewForm.tsx`, `index.tsx` (dispatcher). No behavior change.
- `ProjectBriefCard.tsx`: remove the `Router = any` prop threading — sub-components call `useRouter()` themselves (or, after Phase 3.2, don't need it).

### 7.4 Delete dead code
`components/team/ComingSoon.tsx`, `FileList.tsx`, `FileUploader.tsx`, `ClientInbox.tsx`, `project/FolderView.tsx`, `client/ProjectHealthControl.tsx`; `StatusPill`, `AvatarStack` in `ui/kit.tsx`; `app/(team)/projects/[id]/retainer/page.tsx` and `…/brief/page.tsx` redirect stubs (grep for links to them first — `ProjectFiles.tsx:185` links to `/brief`; repoint it to `/clients/${clientId}/data`, passing `clientId` as a prop); `Project.onboardingStep` write in `createProject`; `briefReviewed` variable; `public/next.svg, vercel.svg, globe.svg, file.svg, window.svg`.
Cleanup migration: drop `projects.health`, `projects.onboarding_step`, `projects.brief_reviewed_at` (+ enum `ProjectHealth`) once confirmed unused.

### 7.5 Scripts
Move executed one-offs (`migrate-client-data`, `migrate-brandkit`, `migrate-task-stages`, `seed-team`) to `scripts/archive/` with a README line each ("ran on <date>"). Keep `diag-orphans.mjs`. `seed-team.mjs`: strip the personal roster to a JSON file that is git-ignored (`scripts/seed/team.local.json`), the script reads it.

### Verification
- `typecheck`/`lint` clean; screenshots match; grep confirms no remaining copies of the consolidated constants.

---

## Phase 8 — Styling system consolidation, zero visual change (3–4 days)

Goal: remove the `!important` Tailwind remap and the ad-hoc inline styles **without changing a single computed style**. The trick: the compat layer is a lookup table (Tailwind class → token per theme); we turn that table into named semantic tokens, then rename classes 1:1.

### 8.1 Semantic tokens (from the compat table in `app/design.css:271-360`)
Add to `.theme-dark` / `.theme-light` blocks exactly what the overrides resolve to today:

| New token | `.theme-dark` value | `.theme-light` value | Replaces classes |
|-----------|--------------------|----------------------|------------------|
| `--c-bg-card` | `var(--surface)` | `var(--surface)` | `bg-white` |
| `--c-bg-page` | `var(--surface)` | `var(--bg)` | `bg-neutral-50` |
| `--c-bg-inset` | `var(--surface-2)` | `var(--surface-3)` | `bg-neutral-100` |
| `--c-bg-inset-2` | `var(--surface-3)` | _(unmapped today → Tailwind neutral-200)_ | `bg-neutral-200` |
| `--c-bg-strong` | `var(--mint)` (+ text `#04130F`) | _(unmapped → neutral-900)_ | `bg-neutral-900` |
| `--c-border` / `--c-border-2` / `--c-border-3` | border / border-2 / border-3 | same | `border-neutral-100/200`, `-300`, `-400` |
| `--c-text-1` … `--c-text-4` | text … text-4 | same | `text-neutral-900/800`, `700/600`, `500`, `400/300` |
| `--c-bg-hover` | `var(--surface-2)` | `var(--surface-2)` | `hover:bg-neutral-50/100` |
| accent fills/texts/borders (`green→mint`, `amber`, `red→rose`, `blue`, `violet/purple`) | per table | per table (note light lacks `border-green-*`, `border-amber-*`, `border-red-*`, `border-blue-200` mappings → those stay raw Tailwind in light) | `bg-green-50/100`, `text-green-700/800`, … |

Where the two themes map a class **differently** (`bg-neutral-50`, `bg-neutral-100`) the semantic token carries that difference, so shared components keep rendering differently per theme exactly as now. Where a class is mapped in dark but not light (`bg-neutral-900`, `border-green-200`), define the light value as the literal Tailwind color (`#171717`, `#bbf7d0`…) so nothing moves.

Expose them to Tailwind in `globals.css` `@theme inline`: `--color-card: var(--c-bg-card); --color-page: var(--c-bg-page); --color-ink-1: var(--c-text-1); …` → utilities `bg-card`, `text-ink-2`, `border-line-2`, `bg-mint-fill`, etc.

### 8.2 Mechanical rename
- Scripted find/replace per class (one commit per class group so diffs are reviewable): `text-neutral-900` → `text-ink-1`, `text-neutral-700` → `text-ink-2`, `bg-white` → `bg-card`, `hover:bg-neutral-50` → `hover:bg-hover`, …, including the no-op `hover:text-neutral-700` on `text-neutral-700` (rename both to `text-ink-2` and drop the redundant hover).
- **Exclusions:** the login/update-password pages have no `.theme-*` root, so their `neutral-*` classes render true Tailwind grey today. Leave them as-is (or wrap them in `.theme-light` only if the screenshots still match — they won't, so leave them).
- After every group: `typecheck`, build, screenshot diff.
- When the grep shows zero remaining mapped classes, delete `design.css:263-360` (the two compatibility layers) **and** the `input/textarea/select` fallbacks at `:314-321`/`:353-360` only after inputs use `.zp-input`/`Input` component (8.4).

### 8.3 `<style jsx>` and inline hex
- `.btn-mini`, `.chip`, `.chip-amber`, `.chip-green` from `OnboardingPipeline`/`ClientOnboardingPipeline`/`ClientCredentials` → one definition in `design.css` with the **same hex values** (they are literal colors today on both themes; keep them literal). Delete the three `<style jsx>` blocks (Phase 2 already deleted the project-level pipeline, so it's two).
- `AppSidebar` `#04130F`, `(client)/layout` `#fff` — leave (brand marks).

### 8.4 Inline `style={{}}` → classes with identical values
- Extract the repeated inline objects into utility classes in `design.css` (names, not values, change): `.page-wrap` (`padding: 28px 32px 60px; max-width: 1320px; margin: 0 auto` — with `.page-wrap-xl` 1440 and `.page-wrap-md` 1100), `.card-18` (`padding: 18px`), `.stat-figure` (`font-size: 26px; line-height: 1`), `.dot-7` (7px round dot), `.row-7-8` (`padding: 7px 8px; border-radius: var(--r-md)`), `.grid-main-rail` (`grid-template-columns: minmax(0,1fr) 340px`) etc. Only extract patterns that occur ≥ 3 times; one-offs stay inline.
- Build primitives that emit the exact existing markup: `components/ui/Button.tsx` (`className="btn btn-sm btn-primary …"` composition), `Input/Select/Textarea` (`zp-input`/`zp-select`/`zp-textarea` vs the Tailwind `w-full rounded-md border …` variant — the two look different, so expose `variant="zp" | "plain"` and keep each call site on the variant it uses today), `Card`, `SectionHeading` (the `text-xs font-semibold … uppercase tracking-wider` label used ~40×).

### 8.5 Fonts/weights — done in Phase 3.6.

### Verification
- Pixel diff of every baseline screenshot (any diff = revert that rename group and investigate).
- `grep -c "!important" app/design.css` → 0; `grep -rc "text-neutral-" app components` → 0 outside auth pages.

---

## Phase 9 — Documentation & comments (1 day)

- `README.md`: rewrite per §13.1 of the report (what/roles/workflow, env vars, setup order incl. `setup.sql` + bucket + team login, scripts, AI jobs & cron, Vercel notes: pooler URL, `maxDuration`, `AI_JOB_SECRET`, known limitations).
- `docs/ARCHITECTURE.md`: route groups, data model summary, document types, question/notification models, jobs pipeline, the semantic token table from Phase 8.
- `CLAUDE.md`: keep `@AGENTS.md`, add a short project context block (domain terms, conventions: use `lib/auth`, `lib/constants`, no raw template strings, no `router.refresh()` after revalidating actions, no writes in render).
- Fix stale comments: `projects/[id]/page.tsx` "8-stage"; `stage/[n]/page.tsx` "Stage 3/4"; `schema.prisma:218,265`; `lib/team.ts:2`; `ClientIntakePipeline.tsx:141`; `next.config.ts` path note.
- Text-only UI corrections, each **[copy fix — confirm]**: `NewProjectButton` "stages 1–8"; `AppSidebar` "CLIENT PORTAL" subtitle in the team app; Topbar "Search ⌘K" and `TeamView` social buttons are non-functional — either leave (visual) or wire later; not touched in this plan.

---

## Sequencing & dependencies

```
Phase 0 ─▶ Phase 1 (security) ─▶ Phase 2 (bugs) ─▶ deploy
                                   │
                                   ├─▶ Phase 3 (perf quick wins) ─▶ Phase 6 (dashboard/pages)
                                   ├─▶ Phase 4 (integrity) ─▶ Phase 5 (AI jobs)
                                   └─▶ Phase 7 (consolidation) ─▶ Phase 8 (styling) ─▶ Phase 9 (docs)
```
- 1 → 2 are strictly ordered and should be one deploy each.
- 3, 4, 7 are independent of each other after 2.
- 6 builds on 3.2/3.3; 5 builds on 4.1 (locking) and 4.4 (template ids); 8 builds on 7 (fewer files to touch).
- Total: ~20 developer-days.

## Per-phase definition of done
1. `npm run typecheck && npm run lint && npm run build` pass.
2. Manual checklist for the phase passes on a preview deployment.
3. Screenshot set matches the baseline (except items marked additive/copy-fix that were confirmed).
4. Migrations (if any) applied to production with `prisma migrate deploy`; one-off scripts run and moved to `scripts/archive/`.
5. `PROJECT_ANALYSIS.md` untouched; this file's phase gets a "✅ done <date>" mark.
