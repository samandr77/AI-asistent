-- Migration 014: Personal finance module

create table public.finance_accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text not null default 'cash'
    check (type in ('cash', 'card', 'checking', 'savings', 'investment', 'loan', 'other')),
  currency char(3) not null default 'RUB',
  balance_cents bigint not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.finance_transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  account_id uuid references public.finance_accounts(id) on delete set null,
  occurred_on date not null,
  type text not null default 'expense'
    check (type in ('expense', 'income', 'transfer')),
  amount_cents bigint not null check (amount_cents > 0),
  currency char(3) not null default 'RUB',
  category text not null,
  merchant text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.finance_budgets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  category text not null,
  period text not null default 'monthly'
    check (period in ('monthly', 'weekly')),
  limit_cents bigint not null check (limit_cents > 0),
  rollover_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category, period)
);

create table public.finance_goals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  target_amount_cents bigint not null check (target_amount_cents > 0),
  saved_amount_cents bigint not null default 0 check (saved_amount_cents >= 0),
  target_date date,
  linked_account_id uuid references public.finance_accounts(id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'paused', 'achieved', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (saved_amount_cents <= target_amount_cents)
);

create table public.finance_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency char(3) not null default 'RUB',
  next_charge_date date not null,
  category text not null default 'subscriptions',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.finance_debts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text not null default 'other'
    check (type in ('credit_card', 'loan', 'mortgage', 'installment', 'personal', 'other')),
  balance_cents bigint not null check (balance_cents >= 0),
  interest_rate_percent numeric(6,3),
  monthly_payment_cents bigint check (monthly_payment_cents is null or monthly_payment_cents >= 0),
  next_payment_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.finance_assets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text not null default 'other'
    check (type in ('cash', 'brokerage', 'retirement', 'real_estate', 'vehicle', 'other')),
  current_value_cents bigint not null check (current_value_cents >= 0),
  currency char(3) not null default 'RUB',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.finance_income (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  source text not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency char(3) not null default 'RUB',
  received_on date not null,
  category text not null default 'income',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.finance_tax_events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  due_date date not null,
  amount_cents bigint,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.finance_documents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  kind text not null default 'receipt',
  storage_path text,
  linked_transaction_id uuid references public.finance_transactions(id) on delete set null,
  extracted_total_cents bigint,
  extracted_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.finance_accounts enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.finance_budgets enable row level security;
alter table public.finance_goals enable row level security;
alter table public.finance_subscriptions enable row level security;
alter table public.finance_debts enable row level security;
alter table public.finance_assets enable row level security;
alter table public.finance_income enable row level security;
alter table public.finance_tax_events enable row level security;
alter table public.finance_documents enable row level security;

create policy "users_own_finance_accounts" on public.finance_accounts
  for all using (auth.uid() = user_id);
create policy "users_own_finance_transactions" on public.finance_transactions
  for all using (auth.uid() = user_id);
create policy "users_own_finance_budgets" on public.finance_budgets
  for all using (auth.uid() = user_id);
create policy "users_own_finance_goals" on public.finance_goals
  for all using (auth.uid() = user_id);
create policy "users_own_finance_subscriptions" on public.finance_subscriptions
  for all using (auth.uid() = user_id);
create policy "users_own_finance_debts" on public.finance_debts
  for all using (auth.uid() = user_id);
create policy "users_own_finance_assets" on public.finance_assets
  for all using (auth.uid() = user_id);
create policy "users_own_finance_income" on public.finance_income
  for all using (auth.uid() = user_id);
create policy "users_own_finance_tax_events" on public.finance_tax_events
  for all using (auth.uid() = user_id);
create policy "users_own_finance_documents" on public.finance_documents
  for all using (auth.uid() = user_id);

create index finance_accounts_user_idx on public.finance_accounts (user_id, is_archived);
create index finance_transactions_user_date_idx on public.finance_transactions (user_id, occurred_on desc);
create index finance_transactions_user_category_idx on public.finance_transactions (user_id, category);
create index finance_budgets_user_idx on public.finance_budgets (user_id, period, category);
create index finance_goals_user_status_idx on public.finance_goals (user_id, status);
create index finance_subscriptions_user_next_charge_idx on public.finance_subscriptions (user_id, next_charge_date);
create index finance_debts_user_idx on public.finance_debts (user_id);
create index finance_assets_user_idx on public.finance_assets (user_id);
create index finance_income_user_date_idx on public.finance_income (user_id, received_on desc);
create index finance_tax_events_user_due_idx on public.finance_tax_events (user_id, due_date);
create index finance_documents_user_idx on public.finance_documents (user_id, kind);

create trigger set_finance_accounts_updated_at
  before update on public.finance_accounts
  for each row execute function public.set_updated_at();
create trigger set_finance_transactions_updated_at
  before update on public.finance_transactions
  for each row execute function public.set_updated_at();
create trigger set_finance_budgets_updated_at
  before update on public.finance_budgets
  for each row execute function public.set_updated_at();
create trigger set_finance_goals_updated_at
  before update on public.finance_goals
  for each row execute function public.set_updated_at();
create trigger set_finance_subscriptions_updated_at
  before update on public.finance_subscriptions
  for each row execute function public.set_updated_at();
create trigger set_finance_debts_updated_at
  before update on public.finance_debts
  for each row execute function public.set_updated_at();
create trigger set_finance_assets_updated_at
  before update on public.finance_assets
  for each row execute function public.set_updated_at();
create trigger set_finance_income_updated_at
  before update on public.finance_income
  for each row execute function public.set_updated_at();
create trigger set_finance_tax_events_updated_at
  before update on public.finance_tax_events
  for each row execute function public.set_updated_at();
create trigger set_finance_documents_updated_at
  before update on public.finance_documents
  for each row execute function public.set_updated_at();
