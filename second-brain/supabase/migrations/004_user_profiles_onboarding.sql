alter table public.user_profiles
  add column if not exists is_onboarded boolean default false;
