-- 학생 제출 테이블 및 RLS 정책

create table if not exists public.omr_attempts (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.omr_assignments(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answers jsonb not null default '[]'::jsonb,
  attempt_no int not null default 1,
  status text not null default 'submitted' check (status in ('in_progress','submitted','completed','locked')),
  score_percent numeric not null default 0,
  correct_count int not null default 0,
  wrong_count int not null default 0,
  is_complete boolean not null default false,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, user_id)
);

create index if not exists omr_attempts_assignment_idx on public.omr_attempts(assignment_id);
create index if not exists omr_attempts_user_idx on public.omr_attempts(user_id);

alter table public.omr_attempts enable row level security;

drop policy if exists omr_attempts_owner_select on public.omr_attempts;
create policy omr_attempts_owner_select
on public.omr_attempts
for select
using (user_id = auth.uid());

drop policy if exists omr_attempts_teacher_select on public.omr_attempts;
create policy omr_attempts_teacher_select
on public.omr_attempts
for select
using (
  exists (
    select 1
    from public.omr_assignments a
    where a.id = omr_attempts.assignment_id
      and a.created_by = auth.uid()
  )
);

drop policy if exists omr_attempts_owner_insert on public.omr_attempts;
create policy omr_attempts_owner_insert
on public.omr_attempts
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.class_id = omr_attempts.class_id
  )
);

drop policy if exists omr_attempts_owner_update on public.omr_attempts;
create policy omr_attempts_owner_update
on public.omr_attempts
for update
using (user_id = auth.uid() and is_complete = false)
with check (user_id = auth.uid() and is_complete = false);

select pg_notify('pgrst', 'reload schema');
