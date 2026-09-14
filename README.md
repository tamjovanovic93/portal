# Zero Point Portal

Internal project-management app for the Zero Point team plus a client-facing
portal, in one Next.js codebase.

- **Team app** (`/dashboard`, `/clients`, `/projects`, `/team`, `/weekly`,
  `/materials`): dark theme. Runs client onboarding, Client Data (AI-assisted
  profile + strategy), project stages, retainer cycles, materials, approvals,
  questions and notifications.
- **Client portal** (`/portal`): light theme. Clients fill onboarding forms,
  approve offers and copy, review wireframes and designs, upload materials,
  answer questions and sign off on gated stages.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how it fits together,
`PROJECT_ANALYSIS.md` for the September 2026 code review and
`IMPLEMENTATION_PLAN.md` for the phased fixes that followed it.

## Stack

Next.js 16 (App Router, server actions, `proxy.ts` middleware), React 19,
Prisma 5 on Supabase Postgres, Supabase Auth (email/password) and Storage
(private bucket `project-assets`), Anthropic SDK for the AI agents, Tailwind v4
plus the custom design tokens in `app/design.css`.

## Roles and workflow

Two roles, stored on `profiles.role` and mirrored to Supabase `app_metadata`:
`TEAM` and `CLIENT`.

1. **Client onboarding** (client level, before any project): initial client
   form → financial offer → intake form. Forms are collaborative: the team
   pre-fills, the client approves or changes each answer, the team reviews.
2. **Client Data** (`/clients/[id]/data`): the intake agent builds a client
   profile and a verification queue from the intake form; the team verifies
   flagged fields (optionally sending them to the client as questions); the
   strategy agent then writes the strategy. Brand kit lives here too.
3. **Suggested projects** are generated from verified Client Data and approved
   into real projects.
4. **Projects** run through seven stages defined in `lib/stages.ts`:
   Strategy, Sketch (gated), Make (gated), Build, Client Review (gated),
   Launch / Delivery, Complete. Gated stages need a client sign-off in the
   portal. Sketch and Make have wireframe / design review flows.
5. **Retainers** (`mode = ONGOING`) use cycles and a task board instead of
   stages; deliverable tasks can require client approval.

## Local setup

Prerequisites: Node 20+, a Supabase project, an Anthropic API key.

1. `npm install` (runs `prisma generate`).
2. Copy `.env.example` to `.env` and fill it in. Every variable is documented
   in that file. Use `.env`, not `.env.local`: Next.js reads both, but the
   Prisma CLI only reads `.env`, so migrations would not see the database URL.
   `DATABASE_URL` must be the transaction pooler URL (port 6543);
   `DIRECT_URL` (port 5432) is used only by migrations. The Supabase dashboard
   has both under Connect → ORMs → Prisma.
3. Apply the schema: `npm run db:migrate` (`prisma migrate deploy`).
4. Run `supabase/setup.sql` in the Supabase SQL editor. It installs the
   signup trigger (creates a `profiles` row with the role from
   `app_metadata`), row-level-security policies and the storage bucket policy.
5. Create the first team login in the Supabase Auth dashboard with
   `app_metadata` set to `{"role": "TEAM"}`. Every later team member is created
   from the `/team` page, every client from the `/clients` page.
6. `npm run dev` and sign in at `/login`.

Existing databases that predate September 2026 also need the one-off scripts
under "Scripts" below, in order.

## Commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Dev server |
| `npm run build` | `prisma generate` + `next build` (what Vercel runs) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (one intentional `<img>` warning remains) |
| `npm run db:dev` | Create a migration from schema changes |
| `npm run db:migrate` | Apply migrations (production) |

## Scripts

Run with `node --env-file=.env scripts/<name>.mjs`. The `--env-file` flag is
required: a bare Node script does not load `.env` the way Next.js and the
Prisma CLI do.

| Script | Purpose |
|--------|---------|
| `diag-orphans.mjs` | Report rows whose parents are missing |
| `p1-sync-app-metadata.mjs` | Copy `profiles.role` into Supabase `app_metadata` for existing users (needed once after the auth change) |
| `p2-fix-asset-stages.mjs` | Re-tag wireframe / mockup assets with the current stage numbers |
| `p2-backfill-stages.mjs` | Backfill `stageNumber` on staged tasks |
| `p4-fanout-legacy-notifications.mjs` | Expand old team-wide notifications into per-member rows |
| `p4-verification-context-ids.mjs` | Prefix verification question ids with the client id |
| `archive/` | Scripts that already ran in production; see `scripts/archive/README.md` |

## AI jobs and cron

The four agents (intake, strategy, suggestions, brief draft) never run inside
a request. A server action inserts an `ai_jobs` row and, after the response
is sent, POSTs to `/api/ai/run` with `AI_JOB_SECRET`; that route claims the
job and executes it with a 300 s function budget. `/api/ai/sweep` (Vercel
Cron, every five minutes, protected by `CRON_SECRET`) re-dispatches jobs that
were queued but never picked up and fails jobs stuck in `running`. Pages poll
the job with `useAiJob` and refresh when it finishes.

On Vercel set `ANTHROPIC_API_KEY`, `AI_JOB_SECRET` and `CRON_SECRET`, and make
sure the plan allows the 300 s `maxDuration` used by `app/api/ai/run/route.ts`
(lower it there if not).

## Deploying on Vercel

- Environment variables: everything in `.env.example`.
- Build command is the default `npm run build`.
- `vercel.json` registers the sweep cron.
- Run `npm run db:migrate` against production before deploying a build that
  ships a new migration.

## Known limitations

- No automated tests; each change is verified by typecheck, lint, build and a
  manual pass through the affected screens.
- Row-level security exists as defence in depth only. The app talks to
  Postgres through Prisma, which bypasses RLS; authorization is enforced in
  `lib/auth`.
- The Tailwind palette remap in `app/design.css` still uses `!important`
  (see the note in that file).
- The login and password pages sit outside the themed layouts and use plain
  Tailwind colours.
