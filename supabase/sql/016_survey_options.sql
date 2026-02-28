-- survey_options 테이블 추가 및 마이그레이션 (survey_choices -> survey_options)

create table if not exists public.survey_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.survey_questions(id) on delete cascade,
  position int not null default 0,
  label text not null
);

create index if not exists survey_options_question_id_idx on public.survey_options(question_id);

alter table public.survey_options enable row level security;

drop policy if exists "survey_options_teacher_crud" on public.survey_options;
drop policy if exists "survey_options_student_select" on public.survey_options;

create policy "survey_options_teacher_crud"
  on public.survey_options
  for all
  using (
    exists (
      select 1
      from public.survey_questions q
      join public.surveys s on s.id = q.survey_id
      where q.id = survey_options.question_id
        and s.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.survey_questions q
      join public.surveys s on s.id = q.survey_id
      where q.id = survey_options.question_id
        and s.created_by = auth.uid()
    )
  );

create policy "survey_options_student_select"
  on public.survey_options
  for select
  using (
    exists (
      select 1
      from public.survey_questions q
      join public.surveys s on s.id = q.survey_id
      join public.profiles p on p.id = auth.uid()
      where q.id = survey_options.question_id
        and p.role = 'student'
        and p.class_id = s.class_id
        and s.status = 'open'
    )
  );

do $$
begin
  if to_regclass('public.survey_choices') is not null then
    insert into public.survey_options (id, question_id, position, label)
    select id, question_id, position, label
    from public.survey_choices
    on conflict (id) do nothing;
  end if;
end $$;

select pg_notify('pgrst', 'reload schema');
