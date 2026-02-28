-- 설문 게시판 스키마 및 RLS

create table if not exists public.surveys (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status text not null check (status in ('draft','open','closed')),
  start_at timestamptz,
  end_at timestamptz,
  anonymous boolean not null default true,
  one_response_per_user boolean not null default true,
  results_visible_to_students boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  position int not null default 0,
  type text not null check (type in ('single','multiple','short','long')),
  title text not null,
  description text,
  required boolean not null default false,
  allow_attachment boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.survey_choices (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.survey_questions(id) on delete cascade,
  position int not null default 0,
  label text not null
);

create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.survey_answers (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.survey_responses(id) on delete cascade,
  question_id uuid not null references public.survey_questions(id) on delete cascade,
  choice_id uuid references public.survey_choices(id) on delete set null,
  text_answer text,
  created_at timestamptz not null default now()
);

create table if not exists public.survey_attachments (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.survey_answers(id) on delete cascade,
  storage_path text not null,
  mime_type text,
  size int,
  created_at timestamptz not null default now()
);

create index if not exists surveys_class_id_idx on public.surveys(class_id);
create index if not exists survey_questions_survey_id_idx on public.survey_questions(survey_id);
create index if not exists survey_choices_question_id_idx on public.survey_choices(question_id);
create index if not exists survey_responses_survey_id_idx on public.survey_responses(survey_id);
create index if not exists survey_responses_user_id_idx on public.survey_responses(user_id);
create index if not exists survey_answers_response_id_idx on public.survey_answers(response_id);

-- Optional: one_response_per_user 를 부분 유니크 인덱스로 강제하려면
-- survey_responses에 플래그를 저장하는 컬럼을 추가한 뒤 그 컬럼으로 부분 인덱스를 생성하세요.
-- create unique index on public.survey_responses (survey_id, user_id) where one_response_per_user_snapshot is true;

alter table public.surveys enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_choices enable row level security;
alter table public.survey_responses enable row level security;
alter table public.survey_answers enable row level security;
alter table public.survey_attachments enable row level security;

-- Surveys RLS
drop policy if exists "surveys_teacher_select" on public.surveys;
drop policy if exists "surveys_teacher_insert" on public.surveys;
drop policy if exists "surveys_teacher_update" on public.surveys;
drop policy if exists "surveys_teacher_delete" on public.surveys;
drop policy if exists "surveys_student_select_open" on public.surveys;

create policy "surveys_teacher_select"
  on public.surveys
  for select
  using (
    created_by = auth.uid()
  );

create policy "surveys_teacher_insert"
  on public.surveys
  for insert
  with check (
    created_by = auth.uid()
  );

create policy "surveys_teacher_update"
  on public.surveys
  for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "surveys_teacher_delete"
  on public.surveys
  for delete
  using (created_by = auth.uid());

create policy "surveys_student_select_open"
  on public.surveys
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'student'
        and p.class_id = surveys.class_id
    )
    and surveys.status = 'open'
    and (surveys.start_at is null or surveys.start_at <= now())
    and (surveys.end_at is null or surveys.end_at >= now())
  );

-- Questions RLS
drop policy if exists "survey_questions_teacher_crud" on public.survey_questions;
drop policy if exists "survey_questions_student_select" on public.survey_questions;

create policy "survey_questions_teacher_crud"
  on public.survey_questions
  for all
  using (
    exists (
      select 1
      from public.surveys s
      where s.id = survey_questions.survey_id
        and s.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.surveys s
      where s.id = survey_questions.survey_id
        and s.created_by = auth.uid()
    )
  );

create policy "survey_questions_student_select"
  on public.survey_questions
  for select
  using (
    exists (
      select 1
      from public.surveys s
      join public.profiles p on p.id = auth.uid()
      where s.id = survey_questions.survey_id
        and p.role = 'student'
        and p.class_id = s.class_id
        and s.status = 'open'
    )
  );

-- Choices RLS
drop policy if exists "survey_choices_teacher_crud" on public.survey_choices;
drop policy if exists "survey_choices_student_select" on public.survey_choices;

create policy "survey_choices_teacher_crud"
  on public.survey_choices
  for all
  using (
    exists (
      select 1
      from public.survey_questions q
      join public.surveys s on s.id = q.survey_id
      where q.id = survey_choices.question_id
        and s.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.survey_questions q
      join public.surveys s on s.id = q.survey_id
      where q.id = survey_choices.question_id
        and s.created_by = auth.uid()
    )
  );

create policy "survey_choices_student_select"
  on public.survey_choices
  for select
  using (
    exists (
      select 1
      from public.survey_questions q
      join public.surveys s on s.id = q.survey_id
      join public.profiles p on p.id = auth.uid()
      where q.id = survey_choices.question_id
        and p.role = 'student'
        and p.class_id = s.class_id
        and s.status = 'open'
    )
  );

-- Responses RLS
drop policy if exists "survey_responses_teacher_select" on public.survey_responses;
drop policy if exists "survey_responses_student_select_own" on public.survey_responses;
drop policy if exists "survey_responses_student_insert" on public.survey_responses;
drop policy if exists "survey_responses_student_select_results" on public.survey_responses;

create policy "survey_responses_teacher_select"
  on public.survey_responses
  for select
  using (
    exists (
      select 1
      from public.surveys s
      where s.id = survey_responses.survey_id
        and s.created_by = auth.uid()
    )
  );

create policy "survey_responses_student_select_own"
  on public.survey_responses
  for select
  using (user_id = auth.uid());

create policy "survey_responses_student_insert"
  on public.survey_responses
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.surveys s
      join public.profiles p on p.id = auth.uid()
      where s.id = survey_responses.survey_id
        and p.role = 'student'
        and p.class_id = s.class_id
        and s.status = 'open'
        and (s.start_at is null or s.start_at <= now())
        and (s.end_at is null or s.end_at >= now())
    )
  );

create policy "survey_responses_student_select_results"
  on public.survey_responses
  for select
  using (
    exists (
      select 1
      from public.surveys s
      join public.profiles p on p.id = auth.uid()
      where s.id = survey_responses.survey_id
        and p.role = 'student'
        and p.class_id = s.class_id
        and s.results_visible_to_students = true
    )
  );

-- Answers RLS
drop policy if exists "survey_answers_teacher_select" on public.survey_answers;
drop policy if exists "survey_answers_student_select_own" on public.survey_answers;
drop policy if exists "survey_answers_student_select_results" on public.survey_answers;
drop policy if exists "survey_answers_student_insert" on public.survey_answers;

create policy "survey_answers_teacher_select"
  on public.survey_answers
  for select
  using (
    exists (
      select 1
      from public.survey_responses r
      join public.surveys s on s.id = r.survey_id
      where r.id = survey_answers.response_id
        and s.created_by = auth.uid()
    )
  );

create policy "survey_answers_student_select_own"
  on public.survey_answers
  for select
  using (
    exists (
      select 1
      from public.survey_responses r
      where r.id = survey_answers.response_id
        and r.user_id = auth.uid()
    )
  );

create policy "survey_answers_student_select_results"
  on public.survey_answers
  for select
  using (
    exists (
      select 1
      from public.survey_responses r
      join public.surveys s on s.id = r.survey_id
      join public.profiles p on p.id = auth.uid()
      where r.id = survey_answers.response_id
        and p.role = 'student'
        and p.class_id = s.class_id
        and s.results_visible_to_students = true
    )
  );

create policy "survey_answers_student_insert"
  on public.survey_answers
  for insert
  with check (
    exists (
      select 1
      from public.survey_responses r
      where r.id = survey_answers.response_id
        and r.user_id = auth.uid()
    )
  );

-- Attachments RLS
drop policy if exists "survey_attachments_teacher_select" on public.survey_attachments;
drop policy if exists "survey_attachments_student_select_own" on public.survey_attachments;
drop policy if exists "survey_attachments_student_select_results" on public.survey_attachments;
drop policy if exists "survey_attachments_student_insert" on public.survey_attachments;

create policy "survey_attachments_teacher_select"
  on public.survey_attachments
  for select
  using (
    exists (
      select 1
      from public.survey_answers a
      join public.survey_responses r on r.id = a.response_id
      join public.surveys s on s.id = r.survey_id
      where a.id = survey_attachments.answer_id
        and s.created_by = auth.uid()
    )
  );

create policy "survey_attachments_student_select_own"
  on public.survey_attachments
  for select
  using (
    exists (
      select 1
      from public.survey_answers a
      join public.survey_responses r on r.id = a.response_id
      where a.id = survey_attachments.answer_id
        and r.user_id = auth.uid()
    )
  );

create policy "survey_attachments_student_select_results"
  on public.survey_attachments
  for select
  using (
    exists (
      select 1
      from public.survey_answers a
      join public.survey_responses r on r.id = a.response_id
      join public.surveys s on s.id = r.survey_id
      join public.profiles p on p.id = auth.uid()
      where a.id = survey_attachments.answer_id
        and p.role = 'student'
        and p.class_id = s.class_id
        and s.results_visible_to_students = true
    )
  );

create policy "survey_attachments_student_insert"
  on public.survey_attachments
  for insert
  with check (
    exists (
      select 1
      from public.survey_answers a
      join public.survey_responses r on r.id = a.response_id
      where a.id = survey_attachments.answer_id
        and r.user_id = auth.uid()
    )
  );

select pg_notify('pgrst', 'reload schema');
