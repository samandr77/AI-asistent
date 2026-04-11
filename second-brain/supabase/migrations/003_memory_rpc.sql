create or replace function match_memories(
  user_id_input uuid,
  query_embedding halfvec(1536),
  match_count int default 5,
  match_threshold float default 0.7
)
returns table (content text, similarity float)
language sql stable as $$
  select
    content,
    1 - (embedding <=> query_embedding) as similarity
  from public.memory_embeddings
  where
    user_id = user_id_input
    and auth.uid() = user_id_input
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;
