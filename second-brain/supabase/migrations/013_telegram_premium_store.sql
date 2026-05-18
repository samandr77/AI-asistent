-- Migration 013: Allow Telegram Stars as a premium entitlement source.

alter table public.user_premium
  drop constraint if exists user_premium_store_check;

alter table public.user_premium
  add constraint user_premium_store_check
  check (store in ('app_store', 'play_store', 'stripe', 'promotional', 'telegram_stars'));
