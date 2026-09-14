@AGENTS.md

# Project context

Zero Point Portal: a Next.js 16 team app (dark theme, `app/(team)`) plus a
client portal (light theme, `app/(client)`). Prisma on Supabase Postgres,
Supabase Auth and Storage, Anthropic agents run as background jobs. Read
`docs/ARCHITECTURE.md` before larger changes; `README.md` covers setup.

Domain terms: Client Data (client-level profile / strategy / verification
queue / brand kit JSON documents), onboarding forms (initial form, offer,
intake), stages 1..7 from `lib/stages.ts` (Sketch and Make have wireframe /
design reviews; Sketch, Make and Client Review are gated), retainers (ONGOING
projects with cycles and tasks), suggested projects.

Conventions that must hold:

- Auth through `lib/auth` (`getSessionUser`, `requireTeam`,
  `requireProjectAccess`, …). Never read `user_metadata`, never add a local
  role check.
- Shared tables and ids: `lib/constants`, `lib/documents/types.ts`,
  `lib/notification-types.ts`, `lib/stages.ts`. No retyped template strings,
  stage numbers or label maps.
- JSON document writes go through `mutateDocumentContent`
  (`lib/documents/mutate.ts`) so the `version` lock is respected.
- Validate FormData / input with `lib/validation` schemas.
- Server actions `revalidatePath`; do not add `router.refresh()` after them.
- No database writes in render. AI work is enqueued (`lib/ai/jobs.ts`), never
  awaited in a request.
- Styling: semantic classes from `app/design.css` (`bg-surface`, `text-ink-2`,
  `border-line`, `bg-mint-fill`, …) and the components in `components/ui`.
  No visual changes without the user asking; keep class strings identical
  when refactoring.
- Buttons and form controls go through `components/ui/Button.tsx` and
  `components/ui/Field.tsx` (`Input`, `Textarea`, `Select`, `Label`). Pick a
  `variant` and `size`; never pass padding, text size or colour through
  `className` (it collides with the variant's class and CSS order decides the
  winner). `className` is layout only. See the tables in `docs/ARCHITECTURE.md`.
  Clickable rows, tabs and state-driven toggles stay plain elements.
- Verify with `npm run typecheck`, `npm run lint`, `npx next build`.
