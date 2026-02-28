-- OMR 과제 RLS 정책 및 기본값 설정

alter table public.omr_assignments enable row level security;

alter table public.omr_assignments
  alter column created_by set default auth.uid();

drop policy if exists omr_assignments_teacher_select on public.omr_assignments;
create policy omr_assignments_teacher_select
on public.omr_assignments
for select
using (created_by = auth.uid());

drop policy if exists omr_assignments_student_select on public.omr_assignments;
create policy omr_assignments_student_select
on public.omr_assignments
for select
using (
  omr_assignments.is_published = true
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.class_id = omr_assignments.class_id
  )
);

drop policy if exists omr_assignments_insert on public.omr_assignments;
create policy omr_assignments_insert
on public.omr_assignments
for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.class_id = omr_assignments.class_id
  )
);

drop policy if exists omr_assignments_update on public.omr_assignments;
create policy omr_assignments_update
on public.omr_assignments
for update
using (created_by = auth.uid())
with check (created_by = auth.uid());

drop policy if exists omr_assignments_delete on public.omr_assignments;
create policy omr_assignments_delete
on public.omr_assignments
for delete
using (created_by = auth.uid());

select pg_notify('pgrst', 'reload schema');
