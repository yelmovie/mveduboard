-- Students table (MVP)
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  name text not null,
  gender text,
  student_no int,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.students
  add column if not exists gender text;

create index if not exists students_class_id_idx on public.students(class_id);

alter table public.students enable row level security;

drop policy if exists "students_select_own" on public.students;
drop policy if exists "students_insert_own" on public.students;
drop policy if exists "students_update_own" on public.students;
drop policy if exists "students_delete_own" on public.students;

create policy "students_select_own"
  on public.students
  for select
  to authenticated
  using (created_by = auth.uid());

create policy "students_insert_own"
  on public.students
  for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "students_update_own"
  on public.students
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "students_delete_own"
  on public.students
  for delete
  to authenticated
  using (created_by = auth.uid());

-- Refresh PostgREST schema cache
select pg_notify('pgrst', 'reload schema');
