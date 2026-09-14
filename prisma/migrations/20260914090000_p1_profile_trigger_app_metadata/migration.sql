-- Phase 1: profile auto-creation reads the role from app_metadata (server-set),
-- never user_metadata (user-editable), and does not fail when a profile with the
-- same email was pre-created by the app (team members).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  select
    new.id,
    new.email,
    coalesce(new.raw_app_meta_data->>'role', 'CLIENT')::"UserRole"
  where not exists (
    select 1 from public.profiles p where p.id = new.id or p.email = new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
