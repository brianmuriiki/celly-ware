create table if not exists public.kv_store_f5814922 (
  key text primary key not null,
  value jsonb not null
);

alter table public.kv_store_f5814922 enable row level security;

revoke all on table public.kv_store_f5814922 from anon, authenticated;
grant all on table public.kv_store_f5814922 to service_role;
