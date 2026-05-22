-- Migration 023: Finance v2 categories, imports, envelopes, and transfers

create table public.finance_categories (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text not null default 'expense'
    check (type in ('expense', 'income', 'transfer')),
  parent_id uuid references public.finance_categories(id) on delete set null,
  icon text not null default 'tag',
  color text not null default '#E04F5F',
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name, type)
);

create table public.finance_categorization_rules (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  merchant_pattern text not null,
  category text not null,
  category_id uuid references public.finance_categories(id) on delete set null,
  priority int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, merchant_pattern)
);

alter table public.finance_transactions
  add column if not exists target_account_id uuid references public.finance_accounts(id) on delete set null,
  add column if not exists is_recurring boolean not null default false,
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'ai', 'csv', 'receipt', 'bank', 'telegram')),
  add column if not exists import_hash text,
  add constraint finance_transactions_transfer_accounts_check
    check (target_account_id is null or target_account_id <> account_id);

alter table public.finance_budgets
  add column if not exists allocated_cents bigint check (allocated_cents is null or allocated_cents >= 0),
  add column if not exists rollover_cents bigint not null default 0 check (rollover_cents >= 0);

alter table public.finance_categories enable row level security;
alter table public.finance_categorization_rules enable row level security;

create policy "users_own_finance_categories" on public.finance_categories
  for all using (auth.uid() = user_id);
create policy "users_own_finance_categorization_rules" on public.finance_categorization_rules
  for all using (auth.uid() = user_id);

create index finance_categories_user_type_idx on public.finance_categories (user_id, type, is_archived);
create index finance_categories_parent_idx on public.finance_categories (parent_id);
create index finance_categorization_rules_user_idx on public.finance_categorization_rules (user_id, is_active, priority);
create index finance_transactions_user_account_idx on public.finance_transactions (user_id, account_id);
create index finance_transactions_user_target_account_idx on public.finance_transactions (user_id, target_account_id);
create unique index finance_transactions_user_import_hash_idx
  on public.finance_transactions (user_id, import_hash)
  where import_hash is not null;

create trigger set_finance_categories_updated_at
  before update on public.finance_categories
  for each row execute function public.set_updated_at();
create trigger set_finance_categorization_rules_updated_at
  before update on public.finance_categorization_rules
  for each row execute function public.set_updated_at();
