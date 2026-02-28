create table if not exists public.upload_quota_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  day date not null,
  count int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, day)
);

alter table public.upload_quota_daily enable row level security;

create policy "quota_owner_read"
  on public.upload_quota_daily
  for select
  using (auth.uid() = user_id);

create policy "quota_owner_write"
  on public.upload_quota_daily
  for insert
  with check (auth.uid() = user_id);

create policy "quota_owner_update"
  on public.upload_quota_daily
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
