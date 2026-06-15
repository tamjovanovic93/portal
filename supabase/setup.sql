-- ═══════════════════════════════════════════════════════════════
-- Zero-Point Portal — Supabase setup
-- Run this in your Supabase SQL editor after running prisma migrate
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. Auto-create profile row on Supabase Auth signup ─────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'CLIENT')::"UserRole"
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ─── 2. Row Level Security ────────────────────────────────────────
-- Enable RLS on all tables
alter table public.profiles         enable row level security;
alter table public.projects         enable row level security;
alter table public.project_stages   enable row level security;
alter table public.documents        enable row level security;
alter table public.approvals        enable row level security;
alter table public.project_assets   enable row level security;
alter table public.material_items   enable row level security;
alter table public.cycles           enable row level security;
alter table public.tasks            enable row level security;

-- Client data (profile / verification queue / strategy) now lives in JSON
-- Document rows, so there are no separate client-data tables to secure here.


-- ─── 3. Helper — get role of current user ─────────────────────────
create or replace function public.current_user_role()
returns text
language sql stable
security definer
as $$
  select role::text from public.profiles where id = auth.uid();
$$;

create or replace function public.is_team()
returns boolean
language sql stable
security definer
as $$
  select current_user_role() = 'TEAM';
$$;


-- ─── 4. Policies — profiles ───────────────────────────────────────
create policy "Team can see all profiles"
  on public.profiles for select
  using (is_team());

create policy "Client can see own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Team can update profiles"
  on public.profiles for update
  using (is_team());


-- ─── 5. Policies — projects ───────────────────────────────────────
create policy "Team sees all projects"
  on public.projects for all
  using (is_team());

create policy "Client sees own projects"
  on public.projects for select
  using (client_id = auth.uid());


-- ─── 6. Policies — project-scoped tables ─────────────────────────
-- For every table with a project_id FK, team sees all, client sees own.
-- Rather than repeat for all tables, we use a helper that checks project ownership.

create or replace function public.client_owns_project(pid uuid)
returns boolean
language sql stable
security definer
as $$
  select exists (
    select 1 from public.projects
    where id = pid and client_id = auth.uid()
  );
$$;

-- project_stages
create policy "Team all" on public.project_stages for all using (is_team());
create policy "Client read own" on public.project_stages for select using (client_owns_project(project_id));

-- documents
create policy "Team all" on public.documents for all using (is_team());
create policy "Client read own" on public.documents for select using (client_owns_project(project_id));

-- approvals
create policy "Team all" on public.approvals for all using (is_team());
create policy "Client read own" on public.approvals for select using (client_owns_project(project_id));
create policy "Client insert own" on public.approvals for insert with check (client_owns_project(project_id) and approved_by_id = auth.uid());

-- project_assets — clients only see SHARED assets
create policy "Team all" on public.project_assets for all using (is_team());
create policy "Client read shared" on public.project_assets for select
  using (client_owns_project(project_id) and visibility = 'SHARED');

-- material_items
create policy "Team all" on public.material_items for all using (is_team());
create policy "Client read own" on public.material_items for select using (client_owns_project(project_id));
create policy "Client update own" on public.material_items for update using (client_owns_project(project_id));

-- cycles / tasks (ongoing)
create policy "Team all" on public.cycles for all using (is_team());
create policy "Client read own" on public.cycles for select using (client_owns_project(project_id));
create policy "Team all" on public.tasks for all using (is_team());

-- Client data (profile / verification queue / strategy) is stored as JSON in the
-- documents table — already covered by the documents policies above.


-- ─── 7. Storage bucket ───────────────────────────────────────────
-- Run this separately or via the Supabase dashboard:
-- Storage > New bucket > Name: project-assets > Private (NOT public)
--
-- The SQL equivalent (requires storage extension):
insert into storage.buckets (id, name, public)
values ('project-assets', 'project-assets', false)
on conflict (id) do nothing;

-- Storage RLS: only service role key can read/write (all uploads go through API routes)
-- No additional policies needed — the bucket is private and our API routes use the admin client.
