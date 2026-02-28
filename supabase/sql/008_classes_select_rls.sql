-- Ensure teachers can read only their own classes
-- Rerunnable

alter table public.classes enable row level security;

drop policy if exists "classes_teacher_select_own" on public.classes;

create policy "classes_teacher_select_own"
  on public.classes
  for select
  using (created_by = auth.uid());
