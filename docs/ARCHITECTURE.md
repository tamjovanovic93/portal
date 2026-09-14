# Architecture

A map of the codebase for anyone changing it. Domain workflow is in the
README; this file is about where things live and the rules they follow.

## Layout

```
proxy.ts                    auth redirect middleware (reads the JWT claims only)
app/(auth)/login            login + password reset (no theme root, plain Tailwind)
app/update-password
app/(team)/*                team app, wrapped in .theme-dark
app/(client)/portal/*       client portal, wrapped in .theme-light
app/actions/*               server actions = the whole backend
app/api/upload, client-upload, download   storage routes (service-role key)
app/api/ai/run, ai/sweep    background AI job runner + cron sweep
lib/auth                    session + access checks
lib/ai                      Anthropic client, prompts, job runner
lib/documents               template ids, optimistic-lock helper, feedback docs
lib/intake                  Client Data JSON store + types
lib/constants, lib/format   shared label tables and formatters
lib/validation              zod schemas + FormData parsing
lib/notifications, lib/questions, lib/team, lib/stages, lib/storage
components/team, client, ui, DocumentForm, ai
prisma/schema.prisma + migrations
supabase/setup.sql          trigger, RLS, bucket policy
scripts/                    one-off data scripts (archive/ for ones already run)
```

## Request and auth flow

1. `proxy.ts` calls `supabase.auth.getClaims()` and routes on
   `app_metadata.role` only (team paths vs `/portal`). It never queries the
   database.
2. Layouts and pages call `getSessionUser()` from `lib/auth/session.ts`. It is
   wrapped in React `cache`, so one request resolves the Supabase user and the
   `profiles` row (role, active flag) once, however many components ask.
3. Server actions start with `requireTeam()` or `requireUser()`, and with
   `requireProjectAccess` / `requireDocumentAccess` / `requireTaskAccess` from
   `lib/auth/access.ts` when the caller passes an id. Clients can only reach
   their own projects and documents; team can reach everything.
4. `profiles.role` is the source of truth. `app_metadata.role` is a mirror
   written when a user is created (`lib/supabase/admin.ts`) so the proxy can
   route without a DB hit. `user_metadata` is never read.
5. A session whose `profiles` row is missing or `active = false` is ended
   rather than redirected: the layouts send it to `/auth/signout`. Sending it
   to `/login` would loop, because the proxy sees a valid token and sends it
   straight back. `/auth/*` therefore bypasses the proxy's "already signed in"
   redirect — those are mechanism routes (recovery callback, sign-out), not
   pages.
6. Storage is a private bucket. Files are served through `/api/download`
   (per-file access check + signed URL) or, for galleries, signed URLs created
   in the page render with `getSignedUrls` in `lib/storage.ts`.

## Data model (Prisma)

| Model | Notes |
|-------|-------|
| `Profile` | One row per auth user. `role` TEAM or CLIENT, `active`, team copy (title, skills, accent, photo). Team roster comes from here (`lib/team.ts`). |
| `Project` | `mode` PROJECT (staged) or ONGOING (retainer), `type`, `currentStage`, `briefPublishedAt`, `isArchived`. |
| `ProjectStage` | One row per stage 1..7 with status and gate approval. |
| `Document` | JSON `content` keyed by `templateType`. Project-scoped (`projectId`) or client-scoped (`clientId`, `projectId` null). `version` drives optimistic locking. |
| `Approval` | Client sign-off on a gated stage or a deliverable task. |
| `ProjectAsset` | Uploaded file: folder, stage, visibility, storage path. |
| `MaterialItem` | Things the client must supply, with category and status. |
| `Cycle` / `Task` | Retainer cycles and their tasks; staged projects also use tasks with `stageNumber`. |
| `AppEvent`, `ActivityLog` | Calendar events and the activity feed. |
| `Notification` | One row per recipient (fan-out on write). Types in `lib/notification-types.ts`. |
| `Question` | Polymorphic question thread (project, task, brief, verification item). Helpers in `lib/questions.ts`. |
| `SuggestedProject` | AI-suggested project with a draft brief and approval status. |
| `AiJob` | Background job record: type, target, status, tokens, error. |

Migrations live in `prisma/migrations`; the last five (`p1`…`p7`) belong to the
September 2026 optimization pass.

## Documents

`lib/documents/types.ts` lists every `templateType`:

- onboarding, client-scoped: `initial_client_form`, `financial_offer`, `intake_form`
- Client Data, client-scoped: `client_profile`, `strategy`, `verification_queue`, `brand_kit`
- project-scoped: `project_brief`, `wireframe_feedback`, `design_feedback`

Collaborative forms (`COLLAB_FORM_TYPES`) carry per-field collab state
(`lib/forms/collab.ts`): team prefill, client approve/replace, team edits and
questions.

Every JSON mutation goes through `mutateDocumentContent` in
`lib/documents/mutate.ts`: read, apply the function, `updateMany` guarded by
`version`, retry up to four times, then throw `ConcurrentUpdateError`.
`lib/intake/store.ts` (Client Data), `app/actions/brand-kit.ts`,
`project-brief.ts`, `onboarding.ts` and `documents.ts` all use it. Client Data
for one client is loaded in a single query with `getClientData`.

## Questions and notifications

- A `Question` has a context (`PROJECT`, `TASK`, `BRIEF`, `VERIFICATION`), a
  kind (`ANSWER` or `CONFIRM`) and a status ladder OPEN → WAITING_* →
  ANSWERED / RESOLVED. Verification questions use `clientId:itemId` as the
  context id.
- `lib/notifications.ts` writes one `Notification` per recipient (`notifyTeam`
  fans out to every active team member). Reads and unread counts are per user.
  `ATTENTION_TYPES` only clear when the underlying item is opened.

## AI jobs

```
server action ──enqueueAiJob()──▶ ai_jobs (queued)
      │ after() the response
      └──POST /api/ai/run (x-ai-job-secret)──▶ claimJob → executeJob (maxDuration 300)
/api/ai/sweep (cron */5) ──▶ re-dispatch queued > 60 s, fail running > 15 min
useAiJob (client hook) ──▶ getAiJob() every 4 s → router.refresh() when done
```

Job types: `intake` (client profile + verification queue), `strategy`,
`suggestions`, `brief_draft`. Each has a `run*Job` and a `check*Preconditions`
in `lib/ai/jobs/`. Prompts are in `lib/ai/prompts/`, model ids in
`lib/ai/models.ts` (overridable with `AI_MODEL_DEEP` / `AI_MODEL_FAST`).
Pages pass the active job (`findActiveJob`) to the UI so a reload keeps
showing progress.

## Dashboard

`app/(team)/dashboard/queries.ts` loads everything with aggregates
(`groupBy` for materials, documents and tasks per project; per-member workload
counts) and `derive.ts` turns that into health, tiles, rails and the feed with
no I/O. The page ships only the signed-in member's tasks; other members'
tasks load on demand through `listWorkTasks`.

## Styling

- `app/design.css` defines the two themes (`.theme-dark`, `.theme-light`) as
  CSS variables plus component classes (`.card`, `.pill`, `.btn`, `.zp-input`,
  `.eyebrow`, …). `components/ui/kit.tsx` wraps the common ones.
- Pages written with Tailwind-style utilities use the semantic classes from
  the same file instead of palette names:

  | Class | Resolves to |
  |-------|-------------|
  | `bg-surface` | `--surface` |
  | `bg-page` | dark `--surface`, light `--bg` |
  | `bg-inset` | dark `--surface-2`, light `--surface-3` |
  | `border-line`, `border-line-2`, `hover:border-line-3`, `divide-line` | `--border`, `--border-2`, `--border-3` |
  | `text-ink`, `text-ink-2`, `text-ink-3`, `text-ink-4` | `--text` … `--text-4` |
  | `hover:bg-surface-2`, `hover:text-ink` | `--surface-2`, `--text` |
  | `bg-mint-fill` / `text-mint`, `bg-amber-fill` / `text-amber`, `bg-rose-fill` / `text-rose`, `bg-blue-fill` / `text-blue`, `bg-purple-fill` / `text-purple` | accent fill / accent colour |
  | `border-l-blue` | blue at 45 % (dark) / 50 % (light) |

  A few palette classes are remapped only in the dark app and keep their
  Tailwind names (`bg-neutral-200`, `bg-neutral-900`, `border-neutral-400`,
  `border-green/amber/red/blue-*`, `text-red-500`, `bg-violet-100`). These
  rules are unlayered and `!important` on purpose; see the comment in
  `design.css` before changing that.
- `.page-wrap` + `.page-wrap-md|lg|xl` is the page container;
  `SectionHeading` is the uppercase section label; `Modal` is the portal
  dialog shell; `PipelineStep` and `StagePips` are the shared pipeline /
  progress pieces.

### Button

`components/ui/Button.tsx` is the only button. Pick by `variant`; the name
says both the role and which of the app's two looks it uses.

| variant | family | use it for |
|---------|--------|------------|
| `primary` | design system (`.btn btn-primary`) | the main action in team-app chrome: page headers, toolbars, card actions |
| `secondary` | design system (`.btn`) | a neutral action beside a primary |
| `ghost` | design system (`.btn btn-ghost`) | a low-emphasis chrome action; transparent until hover |
| `solid` (default) | form | the confirm action in a form, modal or the portal |
| `outline` | form | the secondary action — the Cancel beside a solid |
| `danger` | form | a destructive action that still needs a box |
| `success` | form | a green confirm; approval flows only |
| `quiet` | form | low emphasis, but keeps a button's padding |
| `dashed` | form | the "+ Add" affordance |
| `link` | bare text | an inline text action in a dense row |
| `link-danger` | bare text | an inline delete / remove |

`size` is `sm`/`md` for the design-system family (30px / 36px) and
`xs`/`sm`/`md`/`lg` (default)/`xl`/`block` for the rest. `block` drops
horizontal padding for the stacked buttons at the foot of a modal — pair it
with `className="flex-1"` or `"w-full"`. `icon` makes a design-system button
square.

**Never pass padding, text size, colour, background or border colour through
`className`.** Those collide with the variant's own class and CSS order, not
class order, picks the winner. Choose the size that fits, or add a step to
`SIZES`. `className` is for layout only: `w-full`, `flex-1`, `ml-auto`,
`shrink-0`, `mt-*`.

A control that is really a clickable row, a tab, or a toggle whose classes
depend on state stays a plain `<button>` — roughly 130 of those remain and
that is correct.

### Input, Textarea, Select, Label

`components/ui/Field.tsx`, same two-family split:

- `variant="plain"` (default) — the form/modal/portal look. `size` is `md`
  (default), `sm` (dense rows) or `xs` (inline table cells). `fullWidth`
  defaults to true; turn it off for a control in a flex row and pass
  `className="flex-1"`.
- `variant="zp"` — the design-system control (`.zp-input`, `.zp-select`,
  `.zp-textarea`) used by Client Data, the brief tables and verification rows.
  `size` does not apply.

`Textarea` takes `resize="y" | "none"`. `Label` takes `size="sm"` (default) or
`"xs"`, and `variant="zp"` for `.zp-label`. Checkboxes and radios stay plain
`<input>` — they are a single `accent-*` class and a wrapper would only get in
the way.
- Login and password pages have no theme root and use plain Tailwind.

## Conventions

- Auth: `lib/auth` only. No local `requireTeam` copies, no `user_metadata`.
- Labels, options and class tables: `lib/constants`. Template ids:
  `lib/documents/types.ts`. Notification types: `lib/notification-types.ts`.
  Stage numbers: `lib/stages.ts`. Never retype these strings.
- Formatting helpers: `lib/format.ts`.
- Form input is parsed with the zod schemas in `lib/validation/schemas.ts`
  through `parseForm` / `parseInput`.
- Server actions call `revalidatePath` themselves; client components do not
  add `router.refresh()` on top (the AI job hook is the one exception, it
  refreshes when a background job finishes).
- No database writes during render. Find-or-create happens in actions or in
  explicit loaders.
- Long work (AI) is a job, never awaited in a request.
- Prefer `Promise.all` and `groupBy` / `count` over nested includes on list
  pages.
