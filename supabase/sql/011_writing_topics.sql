-- 주제글쓰기 주제 목록 테이블
create table if not exists public.writing_topics (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  topic text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (category, sort_order)
);

create index if not exists writing_topics_month_sort_idx
  on public.writing_topics (category, sort_order);

alter table public.writing_topics enable row level security;

-- 정책은 중복 실행 시 오류가 날 수 있습니다. 필요 시 drop 후 재생성하세요.
-- drop policy if exists "writing_topics_read_active" on public.writing_topics;
-- drop policy if exists "writing_topics_teacher_write" on public.writing_topics;
-- drop policy if exists "writing_topics_teacher_update" on public.writing_topics;
-- drop policy if exists "writing_topics_teacher_delete" on public.writing_topics;
-- drop policy if exists "writing_topics_read_active_anon" on public.writing_topics;

create policy "writing_topics_read_active"
  on public.writing_topics
  for select
  to authenticated
  using (is_active = true);

create policy "writing_topics_read_active_anon"
  on public.writing_topics
  for select
  to anon
  using (is_active = true);

create policy "writing_topics_teacher_write"
  on public.writing_topics
  for insert
  with check (auth.role() = 'authenticated');

create policy "writing_topics_teacher_update"
  on public.writing_topics
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "writing_topics_teacher_delete"
  on public.writing_topics
  for delete
  using (auth.role() = 'authenticated');

grant select on public.writing_topics to anon, authenticated;

select pg_notify('pgrst', 'reload schema');
