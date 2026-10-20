create table if not exists public.beta_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  event_name text not null,
  created_at timestamptz not null default now()
);

alter table public.beta_events enable row level security;

create policy "beta_events_owner_read"
  on public.beta_events
  for select
  using (auth.uid() = user_id);

create policy "beta_events_owner_write"
  on public.beta_events
  for insert
  with check (auth.uid() = user_id);

-- Explicit Data API privileges; table grants do not bypass existing RLS.
grant select, insert on table public.beta_events to authenticated;
