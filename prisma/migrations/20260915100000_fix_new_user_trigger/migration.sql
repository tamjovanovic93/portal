-- handle_new_user() omitted profiles.updated_at, which is NOT NULL with no
-- database default (Prisma applies @updatedAt client-side). Every insert into
-- auth.users therefore failed with
--   null value in column "updated_at" violates not-null constraint
-- which surfaced as "Database error creating new user" and broke both
-- "New client" and "Add team member".
--
-- Two changes:
--  1. The trigger sets updated_at, and profiles.updated_at gains a database
--     default so any non-Prisma writer is safe.
--  2. A profile is created only for users given a role by an admin
--     (app_metadata.role). A self-service signup now yields an auth user with
--     no profile, which lib/auth/session.ts treats as no access. Public signup
--     should still be turned off in the dashboard; this is defence in depth.
ALTER TABLE "profiles" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
begin
  insert into public.profiles (id, email, role, updated_at)
  select
    new.id,
    new.email,
    (new.raw_app_meta_data->>'role')::"UserRole",
    now()
  where new.raw_app_meta_data->>'role' is not null
    and not exists (
      select 1 from public.profiles p where p.id = new.id or p.email = new.email
    );
  return new;
end;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
