# Archived one-off scripts

Each of these ran once against production and is kept for reference only.
Do not re-run without checking the current schema first.

| Script | Purpose | Ran |
|--------|---------|-----|
| `migrate-task-stages.mjs` | Distribute existing scope tasks into stages | before 2026-09-14 (pre-optimization) |
| `migrate-client-data.mjs` | Move client profile / strategy / verification into JSON Documents | before 2026-09-14 (pre-optimization) |
| `migrate-brandkit.mjs` | Move brand kit into a `brand_kit` Document | before 2026-09-14 (pre-optimization) |
| `seed-team.mjs` | Seed TEAM Profiles from `scripts/seed/team.local.json` and remap brief owner/team ids | before 2026-09-14 (pre-optimization) |

Live scripts stay in `scripts/` (`diag-orphans.mjs`, and the `p1-…p4-` phase
scripts from the optimization plan).
