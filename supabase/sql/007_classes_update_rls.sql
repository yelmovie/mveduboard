-- Ensure teachers can update only their own classes (join_code rotation)
-- Rerunnable

alter table public.classes enable row level security;

drop policy if exists "classes_teacher_update_own" on public.classes;

create policy "classes_teacher_update_own"
  on public.classes
  for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());
