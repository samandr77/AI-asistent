-- halfvec = half-precision: 2x less storage than vector(1536)
create table public.memory_embeddings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  embedding halfvec(1536),
  metadata jsonb default '{}',
  created_at timestamptz default now()
);
alter table public.memory_embeddings enable row level security;
create policy "users_own_memory" on public.memory_embeddings
  for all using (auth.uid() = user_id);

-- HNSW index: better recall than ivfflat, no vacuum needed
create index memory_hnsw_idx on public.memory_embeddings
  using hnsw (embedding halfvec_cosine_ops)
  with (m = 16, ef_construction = 64);
