# Zero-Point Portal — Project Analysis

_Analysis date: 2026-09-11 · Branch `main` @ `0f3c456` · 26 commits (2026-05-28 → 2026-09-11)_

This is a read-only review of the whole codebase: architecture, data model, Supabase setup, server actions, pages, components, styling, comments, hardcoded values, performance and scalability. No code was changed. Every finding references the file (and line where useful) so you can jump straight to it.

**Target scale stated by you:** ~50 projects, ~10 team members, ~50 clients (or more). Section 12 evaluates the app specifically against that.

---

## 0. Executive summary (read this first)

The app is functionally rich for its age (~30k lines incl. templates/migrations; ~11k lines of app code) and the code is generally readable with good "why" comments. But it has grown by "phases" faster than it has been consolidated, and several things now need attention before it can safely serve 50 clients:

| # | Severity | Finding | Where |
|---|----------|---------|-------|
| 1 | **Critical (security)** | Authorization is based on `user.user_metadata.role`, which any logged-in user can rewrite themselves via the Supabase JS client (`supabase.auth.updateUser({ data: { role: "TEAM" } })`). A client can promote themselves to team. | `proxy.ts`, every `requireTeam()` in `app/actions/*`, both layouts |
| 2 | **Critical (security)** | Half of the role checks compare against lowercase `"client"` while accounts are created with `"CLIENT"`. Those checks never fire, so a real client passes as team in: file upload, file download (incl. INTERNAL files), advancing stages, deleting/toggling assets, materials ownership bypass. | `app/api/upload/route.ts:16`, `app/api/download/route.ts:33`, `app/actions/stages.ts:13,82`, `app/actions/assets.ts:15,54`, `app/actions/materials.ts:20,33`, `app/actions/projects.ts:16` |
| 3 | **High (security)** | Several client-callable actions have no ownership check at all: any authenticated user can overwrite any document's content, or record a gate approval / approve wireframes & designs on **any** project by passing its id. | `app/actions/design.ts:60-91,125`, `app/actions/wireframes.ts:17-104`, `app/actions/stages.ts:69` |
| 4 | **High (bug)** | Wireframe/design uploads are tagged with the **old** stage numbers (3 / 4) but all readers filter by the new constants (2 / 3). Uploaded wireframes and mockups never show up on the client review pages or the team stage pages. | `components/team/WireframeSection.tsx:39`, `components/team/MockupSection.tsx:61`, `components/client/DesignFeedbackForm.tsx:146` vs `lib/stages.ts:32-33` |
| 5 | **High (perf)** | The dashboard runs ~19 queries, loads every active project with all nested stages/materials/documents/cycles/tasks, plus 500 tasks, then ships them to a client component. No streaming, no `loading.tsx`, no caching. This is the main reason the app feels slow. | `app/(team)/dashboard/page.tsx` |
| 6 | **High (perf)** | Every request does 2–3 network round-trips to Supabase Auth (`getUser()` in proxy → layout → page/action) before touching the DB, and every small mutation calls `revalidatePath` + `router.refresh()` which re-renders whole 1000-line server pages. | `proxy.ts`, layouts, all actions/components |
| 7 | **High (data integrity)** | All Client Data lives in JSON blobs mutated read-modify-write with no locking. Two team members editing the same client at once will silently lose one another's changes. | `lib/intake/store.ts:84`, `app/actions/brief.ts`, `app/actions/project-brief.ts:100` |
| 8 | **High (ops)** | AI agents (up to 32k output tokens, 6 turns, web search) run synchronously inside server actions. They can take minutes, block the UI, and will hit serverless function time limits. No queue, no progress, no retry, no cost tracking. | `app/actions/intake.ts`, `suggested-projects.ts`, `project-brief.ts`, `scope.ts` |
| 9 | **Medium (maintainability)** | Two styling systems fight each other: 898 Tailwind `text-neutral-*` uses remapped by a `!important` "compatibility layer", plus 526 inline `style={{}}` props using design tokens. Very little is reusable. | `app/design.css:263-360`, everywhere |
| 10 | **Medium (docs)** | README is the untouched `create-next-app` boilerplate. No env var list, no setup steps, no architecture notes. | `README.md` |

Also: **no tests, no CI, no `.env.example`, no `loading.tsx`/`error.tsx`/`not-found.tsx`**, 6 unused components, 5 copies of `TYPE_LABELS`, 15 copies of `requireTeam()`, 7 copies of the admin Supabase client, 3 copies of `extractJson()`, 4 copies of `formatBytes()`.

---

## 1. Project overview

**Stack:** Next.js 16.2 (App Router, `proxy.ts`), React 19, Prisma 5.22 → Supabase Postgres, Supabase Auth (email/password), Supabase Storage (private bucket `project-assets`), Anthropic SDK for three AI "agents", Tailwind v4 + custom CSS design tokens.

**Shape:**
```
proxy.ts                     auth redirect middleware
app/(auth)/login             login + reset
app/(team)/*                 internal dark-theme app (dashboard, clients, projects, team, weekly, calendar, materials)
app/(client)/portal/*        client light-theme portal
app/actions/*                22 server-action files (~3.9k lines) = the whole backend
app/api/{upload,client-upload,download}   storage routes via service-role key
lib/                         prisma, supabase clients, stages, notifications, questions, intake store, templates, brief types
components/                  ~70 components (team/, client/, ui/, DocumentForm)
prisma/                      schema + 13 migrations
supabase/setup.sql           trigger + RLS + bucket
scripts/*.mjs                one-off migrations/seeds
```

**Domain model (as built):** `Profile` (TEAM | CLIENT) → `Project` (PROJECT | ONGOING mode, 7 stages) → `ProjectStage`, `Document` (JSON content, project- or client-scoped), `Approval`, `ProjectAsset`, `MaterialItem`, `Cycle` → `Task`, plus `AppEvent`, `ActivityLog`, `Notification`, `Question` (polymorphic), `SuggestedProject`.

**Git history:** 26 commits, clearly developed in "Phase N" bursts. Several phases moved concepts around (8→7 stages; onboarding & Client Data moved from project level to client level; Brand Kit moved off briefs). Each move left legacy paths behind (see §6.3).

---

## 2. Security & authorization (Critical)

### 2.1 Role lives in user-editable `user_metadata`

Every authorization decision in the app reads `user.user_metadata.role`:

- `proxy.ts:37,52,60`
- `app/(team)/layout.tsx:18`, `app/(client)/layout.tsx:17`
- all 15 `requireTeam()`/`getTeamUser()`/`assertTeam()` helpers in `app/actions/*`
- `app/api/upload/route.ts:16`, `app/api/download/route.ts:33`

Supabase explicitly documents that `user_metadata` is writable by the user (`supabase.auth.updateUser({ data: {...} })` with the anon key), and that authorization data must go in `app_metadata` (server-only) or a DB table. The `profiles.role` column already exists and is the real source of truth (the RLS helpers `is_team()` use it), but the app code never consults it for authorization.

**Impact:** a client with the anon key (it is public, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) can set `role: "TEAM"` on themselves, then every team page, server action and API route treats them as staff.

**Fix direction:** put the role in `app_metadata` at user creation (`auth.admin.createUser({ app_metadata: { role } })`) **and/or** resolve the role from `profiles` once per request in a single shared `getSessionUser()` helper (see §6.1). Never trust `user_metadata`.

### 2.2 Case mismatch: `"client"` vs `"CLIENT"`

Users are created with `user_metadata: { role: "CLIENT" }` (`projects.ts:47`, `clients.ts:73`, `setup.sql:17`). Some checks lowercase before comparing; these do **not**:

| File | Line | Effect for a real client |
|------|------|--------------------------|
| `app/api/upload/route.ts` | 16 | Client can upload to **any** project as if team (INTERNAL files, any folder) |
| `app/api/download/route.ts` | 33 | `isTeam` is `true` → client can download **INTERNAL** assets on **any** project |
| `app/actions/stages.ts` | 13 | Client can `advanceStage()` on any project |
| `app/actions/stages.ts` | 82 | `isClient=false` → client can `recordApproval()` with method EMAIL/VERBAL |
| `app/actions/assets.ts` | 15, 54 | Client can toggle visibility / delete any asset (+ storage object) |
| `app/actions/materials.ts` | 20, 33 | `assertTeam` passes; `assertOwnsProject` skips the ownership check |
| `app/actions/projects.ts` | 16 | Client can `createProject()` |
| `app/actions/auth.ts:26`, `app/page.tsx:13`, `update-password/page.tsx:39` | | Redirect goes to `/dashboard` for clients (then proxy bounces them — cosmetic) |

The proxy and layouts happen to use `.toLowerCase()`, which hides this in the UI; the actions and API routes are still directly callable.

### 2.3 Missing ownership checks on client-callable actions

| Action | Problem |
|--------|---------|
| `design.ts:60 saveDesignFeedback`, `:69 submitDesignFeedback` | Only `getAuthUser()`. Any logged-in user can overwrite any document's `content` by id. |
| `wireframes.ts:17,29` | Same. |
| `design.ts:125 approveDesignAndSubmit`, `wireframes.ts:56 approveWireframesAndSubmit` | Takes `projectId` from the client; never checks the caller owns it. Any user can mark any project's gate approved and write an `Approval` row. |
| `stages.ts:69 recordApproval` | Same — no project ownership check (`approvedById` is the caller, but the project is arbitrary). |
| `documents.ts:74 saveDocument` | Correct pattern (checks `isTeam || isOwner`) — copy this. |
| `client-approvals.ts:64 assertOwnsProject` | Correct pattern. |

### 2.4 RLS is effectively decorative

`supabase/setup.sql` and three migrations define RLS policies, but the app never queries through PostgREST/supabase-js — everything goes through Prisma on `DATABASE_URL`, which (as the migration comments themselves say) bypasses RLS. That's fine as a defence-in-depth layer for the REST API, but be aware that **none** of the row-level rules protect the app's own code paths. Also `documents` "Client read own" uses `client_owns_project(project_id)`, which is `false` for client-scoped docs (`project_id` null) — the policy would block clients from their own onboarding docs if it were ever used.

### 2.5 Other security notes

- **Temporary passwords use `Math.random()`** (`clients.ts:13`, `projects.ts:341`). Use `crypto.randomInt` / `randomBytes`.
- **Service-role client is built in 7 places** (`projects.ts:354` and `clients.ts:33` even use `require()` with an eslint-disable). One `lib/supabase/admin.ts` is enough.
- **`/api/upload` and `/api/client-upload`** accept any MIME type/extension, cast `visibility` without validation, and `parseInt(stageNumber)` unvalidated. 50 MB limit is fine.
- **`<img src="/api/download?id=…">`** (wireframe/design galleries) means every image = auth round-trip + DB query + signed-URL generation + redirect. Consider returning signed URLs in the page render (batch `createSignedUrls`) instead.
- **`generateClientAccess`** (`projects.ts:275`) can silently **re-point a project to a different client id** (`:331-336`) if the profile/auth ids diverge — surprising side effect for a "get credentials" button.
- **Team members created via UI have random UUIDs and no login** (`team.ts:77`). If that person later signs up through Supabase Auth, the `handle_new_user` trigger will try to insert a second `profiles` row with the same email → unique violation → signup fails. There is no "attach login" path.
- `deleteClient` deletes the auth user only after the DB transaction; if the auth deletion fails the email stays reserved (logged, but no retry/surface).

---

## 3. Functional bugs found (beyond security)

1. **Stage-number drift after the 8→7 renumber** (commit `4a4a90a`):
   - Uploads: `WireframeSection.tsx:39` sends `stageNumber "3"`, `MockupSection.tsx:61` and `DesignFeedbackForm.tsx:146` send `"4"`.
   - Readers: `portal/wireframes/[projectId]/page.tsx:29`, `portal/design/[projectId]/page.tsx:27`, `projects/[id]/stage/[n]/page.tsx:179,230` filter on `WIREFRAME_STAGE (2)` / `DESIGN_STAGE (3)`.
   - Result: the portal home shows "Review N wireframes" (it filters by folder only, `portal/page.tsx:428`) but the review page says "No wireframes have been shared yet".
   - Also `dashboard/page.tsx:406` links wireframe feedback to `/stage/3` (should be 2), and `NewProjectButton.tsx:156` still says "Project (stages 1–8)".

2. **Legacy project-level pipeline passes `projectId` where `clientId` is required.** `IntakePipeline.tsx:62,100,109,129` calls `runIntakeAgent(projectId)`, `markProfileVerified(projectId)`, `runStrategyAgent(projectId)`; those actions now take a `clientId` (`intake.ts:171`). Rendered from `projects/[id]/page.tsx:557` and `RetainerView.tsx:364` when a project-scoped intake exists. Every button there fails with "No approved intake form found for this client."

3. **AI brief draft reads intake by `projectId`** (`project-brief.ts:232-233`) but intake forms are now client-scoped, so the draft gets no intake answers — only the profile's `company` block.

4. **Verification question ids collide across clients.** `Question.contextId` for VERIFICATION is the item id (`VQ_001`, `VER_002`), which restarts per client. `listForContext("VERIFICATION", "VQ_001")` would mix clients. `answerQuestion` avoids this by using `recipientId`, but the model is unsafe.

5. **Two independent "published" flags for the brief:** `Project.briefPublishedAt` (`onboarding.ts:378`) vs `brief.content.publishedAt` (`project-brief.ts:171`). `portal/brief/[projectId]/page.tsx` has to check both; `portal/page.tsx:480` checks only the first. Publishing from the Brief card does not show the "Your Brief & Strategy" link on the portal home.

6. **Two "project health" concepts:** `Project.health` enum + `setProjectHealth` + `ProjectHealthControl` (unused component) vs. a computed heuristic `healthById` in `dashboard/page.tsx:322-337`. Only the heuristic is shown.

7. **Deleting does not clean up everything:**
   - `deleteProject` / `deleteClient` never remove objects from the storage bucket → orphaned files, growing bill.
   - `deleteDocument` leaves `Question` rows (`contextType BRIEF, contextId = doc id`) and notifications pointing at the doc.
   - `deleteTask` leaves TASK questions.
   - `deleteClient` purges team notifications with `link: { contains: docId }` string matching (`projects.ts:250`) — fragile.

8. **`updateMaterialItem` / `addMaterialItem` accept any `category` string** (`materials.ts`), and `createEvent`/`updateEvent` cast `type` to the enum without validation → Prisma throws a 500 on bad input.

9. **`ensureProjectBrief()` writes during a GET render** (`projects/[id]/page.tsx:139-142`), and the client review pages create/reset feedback documents during render (`portal/wireframes:59,79`, `portal/design:57,76`). Side effects in render break caching, run twice in dev strict mode, and race under concurrent requests (the partial unique index in migration `…document_unique_feedback` exists precisely because this raced before).

10. **`RetainerView.tsx:104` backfills stages during render** — same class of problem.

11. **Date handling:** `new Date("2026-09-11")` (date-only inputs everywhere) is UTC midnight; displayed with `toLocaleDateString()` in the viewer's timezone → off-by-one day for users west of UTC. Week/month boundaries in `weekly/page.tsx` and `calendar/page.tsx` use the **server's** timezone. 50 `toLocale*` calls in server components (locales mixed: default, `en-GB`, `en-AU`) → hydration mismatches (hence the scattered `suppressHydrationWarning`).

12. **`ApprovalCard` dismisses on a single click of the whole card** with no confirmation; `BriefTable` row delete has no confirmation; `ProjectCardMenu` "Delete" permanently deletes a project behind a native `confirm()`.

13. **`update-password/page.tsx:39`** compares `role === "client"` (never true) → clients are sent to `/dashboard` and bounced.

14. **`TeamView.tsx:37`** roster grid is `repeat(5, 1fr)` — with 10 members it's fine, but on smaller viewports the fixed 5-column grid overflows; `SocialBtn` buttons (`:93`) do nothing; Topbar "Search ⌘K" (`Topbar.tsx:52`) does nothing; the sidebar reads "CLIENT PORTAL" under the wordmark in the **team** app (`AppSidebar.tsx:39`).

---

## 4. Performance — why the app is slow

### 4.1 Request pipeline overhead (every navigation)
1. `proxy.ts` → `supabase.auth.getUser()` (network call to Supabase Auth).
2. `(team)/layout.tsx` → `getUser()` again.
3. `NotificationsBell` (in the layout) → `getUser()` **again** + `profile.findUnique` + `notification.findMany`.
4. The page → often `getUser()` a fourth time (12 pages do), then its own queries.

Each `getUser()` is an HTTPS round-trip (~50–200 ms). That's 300–800 ms of latency before any data query. `getUser()` should be called once per request and memoized (`React.cache`), or replaced with `getClaims()`/local JWT verification for the middleware case.

### 4.2 Dashboard (`app/(team)/dashboard/page.tsx`)
- ~19 Prisma queries in three sequential `await` groups (`:115`, `:219`, `:227`, `:302`).
- `project.findMany` includes **all** stages, materials, documents, and every task of every active cycle for every active project (`:116-142`). At 50 projects this is thousands of rows joined into one result.
- `task.findMany take: 500` (`:229`) is serialized as props to the `MyWork` client component — hundreds of KB of RSC payload.
- `getTeamData()` loads every task assigned to any team member, then filters in JS (`lib/team.ts:57-74`).
- All "needs you / waiting on client / health" logic is computed in JS on the full dataset instead of `count`/`groupBy` queries.
- The same request also renders the `NotificationsBell` queries.

### 4.3 Project page (`app/(team)/projects/[id]/page.tsx`, 1239 lines)
- Two sequential `project.findUnique` calls (`:80`, `:89`); the second includes everything (assets, approvals, documents, all cycles with all tasks).
- Then `onboardingDocs` (legacy), `getProfile`, `getStrategy`, `getRoster`, `getProjectBrief` (+ a write), acknowledger lookup.
- `ProjectFiles` is rendered **twice** with the same props (`:888` and `:1087`).
- Every field on the Brief card saves on blur then calls `router.refresh()` (`ProjectBriefCard.tsx` ~15 places), so typing through a form re-renders this whole page 10+ times.

### 4.4 Client Data page (`app/(team)/clients/[id]/data/page.tsx`, 999 lines)
- All 7 tabs are computed and their data derived on every request; tab switching is a full navigation (`?tab=`), re-running all queries. Client-side tabs with one data load, or Suspense per tab, would make it feel instant.

### 4.5 Cache invalidation is too broad
- `revalidatePath("/", "layout")` in `notifications.ts:24,43` and `auth.ts:25,32` invalidates the **entire app** on every bell open / "mark seen".
- Nearly every action revalidates 3–5 paths **and** the calling component also does `router.refresh()` — double work.

### 4.6 No streaming / no loading states
- There is no `loading.tsx`, `error.tsx`, `not-found.tsx` or `<Suspense>` anywhere. The browser shows nothing until the slowest query of the page resolves. Even without making queries faster, wrapping the below-the-fold sections in Suspense would cut perceived latency a lot.

### 4.7 Assets
- Four Google font families × 4 weights each = ~15 font files on first load (`app/layout.tsx:12-31`). Fredoka/Chakra Petch are used for headings/eyebrows only; 2 weights each would do.
- Team photos are 120–156 KB PNGs served as raw `<img>` (`public/team/*.png`).
- `.fade-up` animation on every section plus `backdrop-filter: blur` on sticky bars is cheap, but the dotted-grid `::before` with `mask-image` over the full viewport (`design.css:114-120`) can be expensive on large screens — worth profiling.

### 4.8 Database
- Prisma 5.22 with `new PrismaClient()` and no explicit pooling config. On serverless, `DATABASE_URL` must be the Supabase **pooler** URL (`?pgbouncer=true`), otherwise every cold start opens a direct connection and you'll exhaust connections at 10 concurrent users. Cannot be verified from the repo (no `.env.example`).
- Missing indexes for the most frequent patterns:
  - `documents (client_id, template_type)` — used by every `getDoc()` call (`lib/intake/store.ts:35`, `brand-kit.ts:32`, `onboarding.ts`, `clients.ts`, `intake.ts`).
  - `documents (template_type, status, completed_at)` — dashboard feeds.
  - `tasks (due_date)`, `tasks (stage_number)`, `tasks (source_brief_id)`.
  - `material_items (status, due_date)`, `notifications (recipient_role, read_at)`, `projects (is_archived)`, `app_events (start_at)`.
- `question.findMany` for offer questions filters `contextId` (TEXT) — indexed via `(context_type, context_id)`, OK.

---

## 5. Architecture & data model

### 5.1 What's good
- Clear separation of team vs client route groups with themed layouts.
- `lib/stages.ts` as the single source of truth for stages (mostly respected).
- `lib/questions.ts` avoids N+1 with grouped queries; `lib/notifications.ts` is best-effort and never breaks the caller.
- Prisma schema is well commented; enums are used for most statuses; FK indexes were added deliberately (migration `…tier1_fk_indexes`).
- The generalized `Question` model and the collaborative-form `_collab` metadata (`lib/forms/collab.ts`) are thoughtful designs.

### 5.2 Structural concerns
1. **"Backend in server actions" with no service layer.** 22 action files each re-implement auth, admin client, revalidation, JSON parsing. Business rules (e.g. "gate must be approved before advancing", "deliverable needs client approval") are spread across actions, pages and components. Suggest: `lib/auth.ts` (session + role), `lib/db/*` (repositories/queries), `lib/services/*` (business rules), and thin actions that validate input (zod) and call services.

2. **The `Document` table is a grab-bag.** It stores form answers, feedback, the Project Brief, Client Profile / Strategy / Verification Queue / Brand Kit JSON, and offers. `stageNumber` is required but meaningless for client-scoped docs (always 1). `status: APPROVED` means "client submitted" for forms and "client accepted" for offers — two different business meanings on one enum. Consider separate tables (or at least a discriminator + typed JSON schemas) for `ClientData` docs vs. workflow documents.

3. **`Cycle` is overloaded as "task list".** PROJECT-mode tasks require a `Cycle` (`Task.cycleId` non-null), so `syncScopeTasks` creates one cycle per scope item and stores the mapping inside the brief JSON (`content.scopeCycles`). The comment in `retainer.ts:25` admits this. A nullable `cycleId` + a `TaskList`/`scopeItemId` grouping would be cleaner and would remove the JSON-side bookkeeping.

4. **Polymorphic, un-indexed, un-constrained references:** `Question.contextId` (TEXT), `ProjectAsset.materialId/approvedById/uploadedBy`, `Approval.assetId`, `AppEvent.createdBy`, `SuggestedProject.approvedProjectId` — none are FKs. Deleting the target leaves dangling ids.

5. **JSON blobs as the primary store for Client Data** (`client_profile`, `strategy`, `verification_queue`, `brand_kit`). Pros: flexible, matches the agent templates. Cons: no concurrency control (§7 lost updates), no per-field indexing/search, no referential integrity, every edit rewrites the whole document (`mutateDoc`), and the shape is only "typed" by casts (`as ClientProfile`) with no runtime validation. At 50 clients this is workable; at 10 concurrent editors it is not, without at least an optimistic-lock `version` column.

6. **Notifications are a single shared team inbox.** `recipientRole = TEAM` rows have one `readAt` for the whole team (`notifications.ts:31` acknowledges this). With 10 members, one person opening the bell clears everyone's unread state. Needs a per-recipient read table or fan-out per member.

7. **Two parallel onboarding worlds.** Project-scoped onboarding (`OnboardingPipeline`, `IntakePipeline`, `createIntakeForm`, `createOffer`, the `stage/[n]/documents/[docId]` editor) and client-scoped onboarding (`ClientOnboardingPipeline`, `ClientIntakePipeline`, `createClient*`, `clients/[id]/documents/[docId]`) both exist. The project-scoped one is "legacy" per comments but still rendered and (see §3.2) partially broken. Pick one and delete the other.

8. **Two ways to publish a brief, two health models, two stage-pip components** (`StagePips` in `projects/page.tsx` and `clients/[id]/page.tsx`), two document editor pages that are ~90% identical.

### 5.3 Schema nits
- `Project.onboardingStep` is written once (`projects.ts:75`) and never read. `Project.briefReviewedAt` is read into `briefReviewed` (`projects/[id]/page.tsx:190`) which is never used.
- `Profile.accent`, `Profile.availability` are free-form; `TaskOwnerRole` duplicates concept with `Profile.title`.
- `ProjectStage.stageNumber // 1–8` and `Approval.stageNumber // 3, 4, or 6` comments are stale (7 stages; gates are 2, 3, 5).
- `MaterialItem.category` is a free string with a 5-value contract enforced only in UI.

---

## 6. Server actions & backend code quality

### 6.1 Duplication (counts from grep)
| Pattern | Copies | Files |
|---------|--------|-------|
| `requireTeam` / `getTeamUser` / `assertTeam` (3 slightly different semantics: throw vs return `{error}`; lowercase vs not) | 15 | all of `app/actions/*` |
| `requireUser` / `getAuthUser` / `getClientProfile` | 6 | onboarding, questions, documents, design, wireframes, client-approvals |
| Service-role Supabase client construction | 7 | projects, clients, assets, design, 3 API routes |
| `extractJson()` | 3 | intake, project-brief, suggested-projects |
| `MODEL = "claude-…"` constants | 4 (+1 script) | intake, project-brief, suggested-projects, scope, migrate-task-stages |
| Anthropic streaming call + text extraction | 4 | same |
| Stage placement prompt text (2–7 list) | 2 | `scope.ts:57`, `scripts/migrate-task-stages.mjs:21` |
| `TYPE_LABELS` (project type → label) | 5 | dashboard, projects, projects/[id], RetainerView, clients/[id] |
| `MATERIAL_CATEGORIES` / `STATUS_LABEL` / `STATUS_STYLE` for materials | 5 | projects/[id], RetainerView, materials page, AddMaterialForm, MaterialRow |
| `formatBytes()` | 4 | projects/[id], FileList, FolderView, ProjectFiles |
| `COLLAB_FORMS` set | 3 | both document pages, portal document page |
| `labelFromFilename()` | 2 | stage page, WireframeFeedbackForm |
| Kanban `COLUMNS`/`STATUSES` | 2 | CycleBoard, StageTasks |
| `Step` sub-component | 4 | IntakePipeline, ClientIntakePipeline, OnboardingPipeline, ClientOnboardingPipeline |
| Modal shell (portal + overlay + white card) | 4 | NewProjectButton, NewClientButton, TeamMemberModal, EditClientButton |

### 6.2 Input validation
- Actions take `FormData` and cast with `as string` / `as ProjectType` / `as EventType`. Nothing is validated at the boundary; malformed input surfaces as Prisma exceptions (500s) rather than user errors. A thin zod schema per action would fix this and also document the contract.
- Free-text → `new Date(x)` without checking `isNaN`.
- `ProjectBrief`, `ClientProfile`, `Strategy` etc. from the AI are `JSON.parse`d and cast; a malformed agent response is persisted as-is.

### 6.3 Dead / legacy code
- Components with **zero importers:** `ComingSoon`, `FileList`, `FolderView`, `FileUploader`, `ClientInbox`, `ProjectHealthControl`, plus `StatusPill` and `AvatarStack` in `ui/kit.tsx`.
- Legacy actions still exported: `createIntakeForm`, `createOffer` (project-scoped, `onboarding.ts:334-376`), `createProject`'s `onboardingStep`, `generateClientAccess` (superseded by `resetClientPassword`).
- Routes that only redirect: `projects/[id]/brief`, `projects/[id]/retainer`.
- `lib/team.ts:2` comment references `lib/team-static.ts` which no longer exists; `scripts/seed-team.mjs` hardcodes the whole roster with real names/emails/photos.
- `public/next.svg`, `vercel.svg`, `globe.svg`, `file.svg`, `window.svg` — create-next-app leftovers.

### 6.4 Transactions & consistency
- Good: `deleteProject`, `deleteClient`, `respondToDeliverableTask`, `approveDesignAndSubmit`, `setRetainerStage`, `advanceStage` use `$transaction`.
- Missing: `syncScopeTasks` (N sequential creates/updates, partial failure leaves half-synced tasks), `approveSuggestion` (project + suggestion update not atomic), `createClientAccount` (auth user created, then profile, then doc — no rollback of the auth user on failure), `renameBrief` (two writes), `resolveVerificationItem` (two `mutateDoc`s).
- `mutateDoc` / `mutateBrief` / brand-kit `mutate` are read-modify-write with no `version`/`updatedAt` guard → lost updates.

### 6.5 Error handling & logging
- Actions inconsistently `throw new Error("Unauthorized")` (becomes an opaque Next.js error page) vs `return { error }`. Components then sometimes `alert()` the message.
- `console.error` only; no structured logging, no error reporting (Sentry etc.).
- Notification failures are swallowed by design (fine), but AI failures return `{ error }` with the raw exception message to the UI.

---

## 7. Frontend: pages, components, reusability

### 7.1 Page files are doing too much
- `projects/[id]/page.tsx` — 1239 lines: data loading, ~20 derived flags, business rules ("most urgent"), 10+ sections of JSX, tables, inline SVGs.
- `clients/[id]/data/page.tsx` — 999 lines: 7 tabs of JSX with ~30 inline column definitions.
- `dashboard/page.tsx` — 798 lines: queries + health heuristics + 3 feed builders + JSX.
- `(client)/portal/page.tsx` — 744 lines, with two components (`MiniDashboard`, `OnboardingForms`) **defined inside the render function** (`:145`, `:187`) — recreated every render.

Splitting each into `queries.ts` (data), `derive.ts` (pure logic, testable) and small section components would make them reviewable and cacheable per section.

### 7.2 Component reuse is low
- `ui/kit.tsx` and `ui/Icon.tsx` are a good start (Pill, Avatar, Health, StageBar, Eyebrow) but are used in only part of the app; the other part hand-rolls the same things with Tailwind classes and inline SVG paths (project page, stage page, portal, forms).
- There is no shared `Button`, `Input`, `Select`, `Modal`, `Card`, `Badge`, `EmptyState`, `Confirm` component. The result: the same `className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"` string appears ~60 times.
- Two near-identical pairs of pipeline components (see §5.2.7) and two near-identical document pages.
- `DocumentForm/index.tsx` (1315 lines) contains three form modes + 9 field renderers + wizard logic in one file. The field renderers are reusable and should be their own module; the three modes should be three files.

### 7.3 Client/server boundary
- Large client components receive huge props: `MyWork` (≤500 tasks), `ProjectStageTasks`/`StageTasks` (all tasks), `CycleBoard` (all tasks with questions), `CalendarView` (all events). Fine at today's size; at 50 projects use server-side filtering and pass only the visible slice.
- Pattern "server action → `router.refresh()`" is used everywhere instead of returning updated data or using optimistic updates; each refresh re-renders the full server page.
- `ProjectBriefCard` types the router as `any` (`:52`) and threads it through every sub-component; `useRouter` can be called where needed.

### 7.4 UX/accessibility
- Native `confirm()` / `alert()` / `prompt()` for destructive and rename flows.
- Modals: no focus trap, no Escape handling, no `role="dialog"`; overlay click closes only in `NewEventModal`.
- Clickable `<div onClick>` in `CalendarView` grid (no keyboard access); many `<button>`s without `type="button"` inside forms (`CycleBoard`, `SuggestedProjectsPanel`, `RevisionTracker`, `MaterialRow`…) — they will submit the enclosing form.
- No responsive layout in the team app: fixed `--sidebar-w`, `gridTemplateColumns: "minmax(0,1fr) 340px"`, `repeat(5, 1fr)`, `h-screen` + `overflow-hidden`. Unusable on tablets/phones.
- No empty/loading/error states at the route level (§4.6).

---

## 8. Styling

### 8.1 Two systems, one `!important` bridge
- `app/design.css` defines a proper token system (`--bg`, `--surface`, `--mint`, radii, shadows) with `.theme-dark` / `.theme-light`, plus a small set of component classes (`.card`, `.btn`, `.pill`, `.zp-input`, `.zp-table`, `.eyebrow`).
- But most of the app was written with raw Tailwind neutral/accent utilities (`text-neutral-700`, `bg-white`, `border-neutral-200`, `bg-green-50` …): **898** `text-neutral-*` occurrences vs **204** design-token class uses.
- To make those pages look dark, `design.css:263-360` remaps ~60 Tailwind utilities with `!important` inside `.theme-dark`/`.theme-light`. This means:
  - A class like `text-neutral-900` does not mean what it says anywhere in the app.
  - Modals add `className="theme-dark"` to the overlay so the `bg-white` card gets re-themed (`NewProjectButton.tsx:63`), a subtle dependency nobody will remember.
  - Any new Tailwind color not in the map renders wrong (e.g. `bg-neutral-900` becomes mint by rule `design.css:275`).
  - Sign of automated find/replace: `hover:text-neutral-700` on `text-neutral-700` (no-op) appears dozens of times; `hover:text-neutral-600` on `text-neutral-600` too.
- **526** inline `style={{ … }}` props carry design-token values (`fontSize: 13.5`, `padding: "28px 32px 60px"`, `color: "var(--text-3)"`). Inline styles can't be themed/overridden, bloat the RSC payload and are impossible to lint.
- `<style jsx>` blocks with hardcoded hex colors that ignore the theme (`#171717`, `#fef3c7`, `#92400e`, `#dcfce7`, `#166534`) in `OnboardingPipeline`, `ClientOnboardingPipeline`, `ClientCredentials`.
- The login page uses neither system (`bg-neutral-50`, no `.theme-*` root).

**Recommendation:** decide on one approach — either (a) map the tokens into Tailwind's `@theme` (`--color-surface`, `--color-text-2`, …) and write `bg-surface text-text-2`, or (b) keep tokens in CSS and build 8–10 primitive components (`Button`, `Card`, `Input`, `Pill`, `Modal`…). Then delete the `!important` compatibility layer. Either way, stop mixing raw `neutral-*` with tokens.

### 8.2 Smaller styling notes
- Fonts: 4 families (§4.7). `--font-plex-sans` is also set as Tailwind `--font-sans` — fine.
- Inconsistent spelling: "colour" vs "color" in UI strings; `en-GB` / `en-AU` / default locale for dates.
- Page paddings vary (`p-8`, `px-6 py-10`, `28px 32px 60px`) — no layout primitive.
- Stylized zeros in eyebrows ("0VERVIEW", "MY W0RK", "PR0JECTS") are a brand choice but are hardcoded strings repeated by hand; a helper would keep them consistent.

---

## 9. AI integration

Files: `app/actions/intake.ts` (Agent 1 profile+verification, Agent 2 strategy), `suggested-projects.ts`, `project-brief.ts` (draft), `scope.ts` (task breakdown).

- **Model ids hardcoded** in 4 files + 1 script (`claude-opus-4-8`, `claude-sonnet-4-6`); web-search tool version `web_search_20260209` hardcoded. Centralize in `lib/ai/models.ts` and read from env so you can swap without a deploy.
- **Synchronous & long-running:** `callAgent` streams up to 32k tokens, adaptive thinking, effort high, up to 6 turns with web search. Realistically 1–5 minutes per run. The user's button sits on "Running…" the whole time; a tab close loses the result; serverless platforms will kill the function (Vercel default limits are far below this). Needs a job table + background worker (Supabase Edge Function / queue / cron) with status polling, or at minimum `maxDuration` configuration and idempotent re-runs.
- **No cost/usage tracking, no rate limiting, no per-client budget.** `generateSuggestedProjects` sends the whole profile + strategy + brand kit as JSON in the prompt each time; `runIntakeAgent` embeds the full templates. Token usage will be large; nothing records it.
- **Prompt text lives inline in TS template literals** (200+ lines). Move to `lib/ai/prompts/*.md` or a versioned prompt registry so prompt changes are reviewable and testable.
- **Output handling:** `extractJson` finds first `{` … last `}` and `JSON.parse`s — brittle. Use structured outputs / tool-use JSON schema so the model is forced into the shape, then validate with zod before persisting.
- **`scope.ts` timeout race** (`:80-88`) is a pragmatic guard, but `runWithFallback`'s regex-based error detection (`intake.ts:121`) will silently drop web search on unrelated errors that happen to contain "tool" or "permission".
- The same stage-placement prompt is duplicated in `scripts/migrate-task-stages.mjs`.

---

## 10. Supabase setup, migrations, scripts

### 10.1 `supabase/setup.sql`
- Manual step ("run in SQL editor after prisma migrate") that is not idempotent for policies (`create policy` without `if not exists`/drop → fails on re-run). Later migrations moved some RLS into Prisma migrations; the split makes it unclear what's applied where.
- `handle_new_user` inserts `role` from `raw_user_meta_data->>'role'` defaulting to `CLIENT`; for team members created via the UI (random id) a later real signup collides on `email` (§2.5).
- Storage policies: none, by design (service key only). OK as long as the API routes are correct (they are not, §2.2).

### 10.2 Migrations
- 13 migrations, mostly small and well-commented. `init` created 27 relational client-data tables that were dropped 2 weeks later (`…drop_client_data_tables`) — history is fine but the `init` file still contains ~500 lines of dead DDL; consider squashing before more environments exist.
- Hand-written migrations (`…tier1_*`, `…retainer_*`) are not reflected 1:1 in `schema.prisma` comments (e.g. partial unique index on feedback docs is DB-only; Prisma doesn't know about it). Document such DB-only constraints in the schema.
- `migration_lock.toml` present; no `prisma migrate` command in `package.json` scripts and no note on how to run them.

### 10.3 Scripts
- `scripts/*.mjs` are one-off data migrations (client data re-keying, brand kit, task stages, team seed) plus a diagnostics script. They instantiate their own `PrismaClient`, are not referenced from `package.json`, and `seed-team.mjs` hardcodes personal names/emails/bios/photos. Once run in production they should be archived (or moved under `scripts/archive/`) and the seed data should come from a non-committed file.

### 10.4 Environment & tooling
- No `.env.example`. Required variables inferred from code: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL`, `ANTHROPIC_API_KEY`.
- `package.json` scripts: only `dev/build/start/lint`. No `typecheck`, `test`, `db:migrate`, `db:seed`.
- Prisma **5.22** is two majors behind (6.x/7.x); Next 16 + React 19 are current. Upgrading Prisma later will be easier before more custom SQL accumulates.
- `next.config.ts` pins `turbopack.root` with a comment about a Mac home-directory path (harmless, but confusing on this Windows machine).
- No CI, no lint-on-commit, no tests of any kind.

---

## 11. Hardcoded values inventory

| Category | Value | Where |
|----------|-------|-------|
| AI models | `claude-opus-4-8`, `claude-sonnet-4-6` | `intake.ts:29`, `project-brief.ts:22`, `suggested-projects.ts:21`, `scope.ts:12`, `scripts/migrate-task-stages.mjs:10` |
| AI tool version | `web_search_20260209` | `intake.ts:81` |
| AI limits | `max_tokens` 32000/16000/8000/4000, 6 turns, 20 s timeout | same files |
| Stage numbers (stale) | upload `stageNumber "3"`/`"4"`, link `/stage/3`, "stages 1–8", `STAGE_CHOICES=[2..7]`, `clampStage` 2–7, prompt text "2 = wireframe … 7 = complete" | `WireframeSection:39`, `MockupSection:61`, `DesignFeedbackForm:146`, `dashboard:406`, `NewProjectButton:156`, `StageTasks:40`, `scope.ts:41-58` |
| Stage semantics | gate stages hardcoded in comments (`3, 4, or 6`) | `schema.prisma:265` |
| Storage | bucket `"project-assets"`, 50 MB, 1 h signed URL | 3 API routes, `assets.ts:8` |
| Business thresholds | capacity `6` open tasks = 100 %, health weights `0.3/0.12/0.05/0.15/0.08`, stale `>5d`/`>7d`, due-soon `3d`, upcoming `14d`, feeds `7d` | `lib/team.ts:8`, `dashboard/page.tsx:98-101,322-337`, `MyWork.tsx:47` |
| Take limits | 500 tasks, 100 questions, 30 docs, 20 notifications, 40 tile items | dashboard, `StatTiles:78`, `MyWork:196` |
| Labels/enums duplicated in UI | project types, material categories/statuses, task statuses, event types, approval methods, message types, offer currencies (EUR/USD/RSD) | see §6.1; `lib/offer.ts:6` |
| Team roster | names, emails, titles, bios, photo paths | `scripts/seed-team.mjs`, `public/team/*.png` |
| Branding | "ZER0 P0INT", "Zero-Point", "CLIENT PORTAL", locale `en-GB`/`en-AU`, default password reset host fallback `localhost:3000` | `AppSidebar`, `(client)/layout`, `auth.ts:41` |
| Colors | hex values in `<style jsx>`, `#04130F`, `#fff` | `OnboardingPipeline`, `ClientOnboardingPipeline`, `ClientCredentials`, `AppSidebar:32`, `design.css` |
| Layout | `--sidebar-w 248px`, `340px` rail, `repeat(5, 1fr)`, `maxWidth 1440/1320/1100`, `padding "28px 32px 60px"` | layouts/pages |
| Notification types | ~20 string literals (`"offer_question"`, `"form_sent"`, …) with no union type; `ATTENTION_TYPES` duplicated in `lib/notifications.ts:72` and `components/Notifications.tsx:19` | actions |
| Template type ids | `"intake_form"`, `"project_brief"`, `"financial_offer"`, `"wireframe_feedback"`, … as raw strings in ~40 places (constants exist only for the 3 intake docs + brief + brand kit) | everywhere |

---

## 12. Fit for 50 projects / 10 team members / 50 clients

| Area | Today | At target scale | Verdict |
|------|-------|-----------------|---------|
| Dashboard | loads everything, ~19 queries | 50 projects × (7 stages + ~20 docs + ~30 tasks + materials) ≈ 3–5k rows per view + 500 tasks to the client | **Will be slow (multi-second).** Needs aggregate queries, per-section Suspense, and a "my projects" default instead of "all". |
| Clients list | 1 query, all clients | 50 rows | Fine. Needs search/sort soon. |
| Project page | 1 giant include + 6 more queries + write-on-read | per project, OK | Acceptable; fix write-on-read and duplicate render. |
| Client Data page | all JSON docs per request, tab = navigation | JSON docs 50–200 KB each | Acceptable per page, but tab switching will feel sluggish; make tabs client-side. |
| Concurrency on JSON docs | none | 10 members editing → lost updates | **Not safe.** Add `version` column + compare-and-set in `mutateDoc`, or move hot data to rows. |
| Notifications | shared team inbox, global read | 10 members | **Wrong model.** Per-recipient read state. |
| Auth latency | 2–4 `getUser()` per request | 10 concurrent users | Noticeable. Memoize per request; verify JWT locally in proxy. |
| DB connections | unknown pooling | 10 users + AI actions | Verify pooler URL; otherwise connection exhaustion. |
| AI runs | synchronous in request | 50 clients onboarding | **Will time out / block.** Background jobs. |
| Storage | no cleanup | 50 projects × files | Slow leak; add cleanup on delete. |
| Search / pagination | none | 50+50 entities | Needed (Topbar search is a stub). |
| Authorization | metadata-based, inconsistent | any client | **Must fix before more clients** (§2). |
| Team logins | UI creates non-login profiles | 10 members need real logins | Needs an invite/attach-login flow. |
| Observability | `console.error` only | | Add error reporting + basic request timing before scaling. |
| Tests | none | | At least action-level tests for auth/ownership and stage transitions. |

---

## 13. Comments & documentation

- **Code comments are above average**: most explain *why* (e.g. `lib/forms/collab.ts`, `lib/questions.ts`, `retainer.ts:25`, `projects.ts:174`). Keep that.
- **Stale comments** (should be fixed or they will mislead): `projects/[id]/page.tsx:79` "8-stage path"; `stage/[n]/page.tsx:166,209` "Stage 3: wireframe", "Stage 4: design"; `schema.prisma:218,265`; `lib/team.ts:2` (`team-static.ts`); `NewProjectButton.tsx:156`; `ClientIntakePipeline.tsx:141` "(next phase)" — the phase shipped.
- **Over-commented spots** restate the code (`// Delete from storage`, `// Save metadata to DB`, `// Header`) — harmless, but they add noise in 1000-line files.
- `CLAUDE.md` just includes `AGENTS.md` (generic Next.js note). There is no project-level context for AI tools or new developers (domain terms: Client Stream, Client Data, gate, cycle, verification queue, retainer…).

### 13.1 README vs. project state
`README.md` is the unmodified `create-next-app` template ("This is a Next.js project bootstrapped with…", "Deploy on Vercel"). It is **0 % in sync** with the project. It should at least cover:
1. What the portal is (team app + client portal), the two roles, the 7-stage workflow, PROJECT vs ONGOING.
2. Environment variables (6) and where each comes from.
3. Setup order: `npm i` → `prisma migrate deploy` → run `supabase/setup.sql` → create storage bucket → seed team → create first team login (and how a team login is linked to a `profiles` row).
4. Scripts folder purpose and which ones are one-off.
5. AI agents: which models, what they cost, prerequisites (`ANTHROPIC_API_KEY`, web-search enabled).
6. Deployment notes (function timeouts for AI actions, pooler URL).
7. Known limitations (single team inbox, JSON client data, no tests).

---

## 14. Prioritized action plan

### P0 — Security (do before onboarding more clients)
1. Move role to `app_metadata` **and** derive it from `profiles.role` in one `lib/auth.ts` helper (`getSession()` with `React.cache`). Replace all 21 local auth helpers with it. Delete every `user_metadata.role` read.
2. Fix all lowercase `"client"` comparisons (§2.2) — or better, they disappear with step 1.
3. Add ownership checks to `design.ts`, `wireframes.ts`, `stages.ts:recordApproval` (copy the `saveDocument` pattern).
4. `crypto.randomInt` for temp passwords; single `lib/supabase/admin.ts`.
5. Validate upload MIME/extension and enum fields in API routes/actions (zod).

### P1 — Bugs
6. Replace hardcoded upload stage numbers with `WIREFRAME_STAGE`/`DESIGN_STAGE`; fix `dashboard:406` link; run a one-off script to re-tag existing assets.
7. Remove the project-scoped onboarding/intake path (or fix its `clientId` arguments) — §3.2, §5.2.7.
8. Make brief "published" a single flag; make project health a single concept.
9. Move write-on-read (`ensureProjectBrief`, feedback doc creation, stage backfill) into explicit actions or creation-time code.
10. Storage/Question cleanup on delete.

### P2 — Performance
11. One `getUser()` per request (memoized); consider local JWT verification in `proxy.ts`.
12. Dashboard: replace nested includes with `count`/`groupBy` aggregates; default to "my work"; wrap sections in `<Suspense>`; add `loading.tsx`.
13. Stop `revalidatePath("/", "layout")`; revalidate the narrowest path; drop redundant `router.refresh()` where the action already revalidates.
14. Add the missing composite indexes (§4.8); confirm pooler URL.
15. Signed URLs in bulk for image galleries instead of `<img src="/api/download">`.
16. Trim fonts to the weights actually used.

### P3 — Architecture / maintainability
17. Introduce `lib/services/*` and typed repositories; actions become thin (validate → service → revalidate).
18. Optimistic locking (`version`) on JSON documents; or promote Client Data hot paths to relational tables.
19. Per-recipient notification read state; typed notification `type` union.
20. Background job model for AI runs (status, progress, retries, cost logging); centralize model ids/prompts.
21. Consolidate duplicated constants/labels into `lib/constants/*` (project types, material categories/statuses, task statuses, template ids).
22. Split the four 700–1300-line pages; extract `DocumentForm` field renderers; build the 8–10 UI primitives and delete the `!important` Tailwind compatibility layer.
23. Delete dead components/routes/actions (§6.3) and boilerplate assets.
24. Add `.env.example`, `typecheck`/`test`/`db:*` scripts, a minimal test suite (auth/ownership, stage transitions, collab mutators, `applyConfig`), and CI.

### P4 — Polish
25. Rewrite README + a short `docs/ARCHITECTURE.md` (and give `CLAUDE.md` real project context).
26. Fix stale comments, locale/spelling consistency, non-functional UI stubs (Search, social buttons, "CLIENT PORTAL" label).
27. Accessible modals/confirm dialogs, `type="button"`, responsive team layout.

---

_End of report._
