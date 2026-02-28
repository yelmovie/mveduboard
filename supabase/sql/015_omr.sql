-- OMR 답안지 스키마 및 RLS

create table if not exists public.omr_assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  subject text,
  answer_format text not null check (answer_format in ('1-5','A-E')),
  question_count int not null check (question_count between 1 and 200),
  require_all_correct boolean not null default true,
  feedback_mode text not null default 'wrong_numbers' check (feedback_mode in ('wrong_numbers','wrong_count','none')),
  max_attempts int,
  due_at timestamptz,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.omr_answer_keys (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.omr_assignments(id) on delete cascade,
  q_no int not null,
  correct_choice text not null,
  unique (assignment_id, q_no)
);

create table if not exists public.omr_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.omr_assignments(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_no int not null default 1,
  status text not null default 'in_progress' check (status in ('in_progress','submitted','completed','locked')),
  score_percent numeric not null default 0,
  correct_count int not null default 0,
  wrong_count int not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.omr_submission_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.omr_submissions(id) on delete cascade,
  assignment_id uuid not null references public.omr_assignments(id) on delete cascade,
  q_no int not null,
  chosen_choice text not null,
  is_correct boolean not null,
  unique (submission_id, q_no)
);

create table if not exists public.omr_overrides (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.omr_assignments(id) on delete cascade,
  student_user_id uuid not null references auth.users(id) on delete cascade,
  overridden_by uuid not null references auth.users(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique (assignment_id, student_user_id)
);

create index if not exists omr_assignments_class_idx on public.omr_assignments(class_id, created_at desc);
create index if not exists omr_submissions_assignment_idx on public.omr_submissions(assignment_id, user_id, created_at desc);
create index if not exists omr_submission_answers_idx on public.omr_submission_answers(assignment_id, q_no, is_correct);

alter table public.omr_assignments enable row level security;
alter table public.omr_answer_keys enable row level security;
alter table public.omr_submissions enable row level security;
alter table public.omr_submission_answers enable row level security;
alter table public.omr_overrides enable row level security;

drop policy if exists "omr_assignments_teacher_crud" on public.omr_assignments;
drop policy if exists "omr_assignments_student_select" on public.omr_assignments;

create policy "omr_assignments_teacher_crud"
  on public.omr_assignments
  for all
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "omr_assignments_student_select"
  on public.omr_assignments
  for select
  using (
    is_published = true
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'student'
        and p.class_id = omr_assignments.class_id
    )
  );

drop policy if exists "omr_answer_keys_teacher_crud" on public.omr_answer_keys;

create policy "omr_answer_keys_teacher_crud"
  on public.omr_answer_keys
  for all
  using (
    exists (
      select 1
      from public.omr_assignments a
      where a.id = omr_answer_keys.assignment_id
        and a.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.omr_assignments a
      where a.id = omr_answer_keys.assignment_id
        and a.created_by = auth.uid()
    )
  );

drop policy if exists "omr_submissions_teacher_select" on public.omr_submissions;
drop policy if exists "omr_submissions_student_select_own" on public.omr_submissions;

create policy "omr_submissions_teacher_select"
  on public.omr_submissions
  for select
  using (
    exists (
      select 1
      from public.omr_assignments a
      where a.id = omr_submissions.assignment_id
        and a.created_by = auth.uid()
    )
  );

create policy "omr_submissions_student_select_own"
  on public.omr_submissions
  for select
  using (user_id = auth.uid());

drop policy if exists "omr_submission_answers_teacher_select" on public.omr_submission_answers;
drop policy if exists "omr_submission_answers_student_select_own" on public.omr_submission_answers;

create policy "omr_submission_answers_teacher_select"
  on public.omr_submission_answers
  for select
  using (
    exists (
      select 1
      from public.omr_assignments a
      where a.id = omr_submission_answers.assignment_id
        and a.created_by = auth.uid()
    )
  );

create policy "omr_submission_answers_student_select_own"
  on public.omr_submission_answers
  for select
  using (
    exists (
      select 1
      from public.omr_submissions s
      where s.id = omr_submission_answers.submission_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "omr_overrides_teacher_crud" on public.omr_overrides;

create policy "omr_overrides_teacher_crud"
  on public.omr_overrides
  for all
  using (overridden_by = auth.uid())
  with check (overridden_by = auth.uid());

create or replace function public.omr_submit_answers(
  p_assignment_id uuid,
  p_answers text[]
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_class_id uuid;
  v_assignment public.omr_assignments%rowtype;
  v_answer_count int;
  v_attempt_no int;
  v_correct_count int := 0;
  v_wrong_count int := 0;
  v_score numeric := 0;
  v_completed boolean := false;
  v_wrong_numbers int[] := '{}';
  v_response_id uuid;
  v_key record;
  v_choice text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'unauthorized';
  end if;

  select class_id into v_class_id from public.profiles where id = v_user_id;
  if v_class_id is null then
    raise exception 'profile_missing';
  end if;

  select * into v_assignment from public.omr_assignments where id = p_assignment_id;
  if v_assignment.id is null then
    raise exception 'assignment_not_found';
  end if;

  if v_assignment.class_id <> v_class_id then
    raise exception 'forbidden';
  end if;

  if v_assignment.is_published = false then
    raise exception 'not_published';
  end if;

  if v_assignment.due_at is not null and v_assignment.due_at < now() then
    raise exception 'due_passed';
  end if;

  v_answer_count := array_length(p_answers, 1);
  if v_answer_count is null or v_answer_count <> v_assignment.question_count then
    raise exception 'invalid_answer_count';
  end if;

  select count(*) + 1 into v_attempt_no
  from public.omr_submissions
  where assignment_id = p_assignment_id and user_id = v_user_id;

  if v_assignment.max_attempts is not null and v_attempt_no > v_assignment.max_attempts then
    return jsonb_build_object(
      'status','locked',
      'message','제출 횟수를 초과했습니다.',
      'attempt_no', v_attempt_no
    );
  end if;

  insert into public.omr_submissions (
    assignment_id, class_id, user_id, attempt_no, status, score_percent, correct_count, wrong_count
  ) values (
    p_assignment_id, v_class_id, v_user_id, v_attempt_no, 'submitted', 0, 0, 0
  ) returning id into v_response_id;

  for v_key in
    select q_no, correct_choice
    from public.omr_answer_keys
    where assignment_id = p_assignment_id
    order by q_no
  loop
    v_choice := p_answers[v_key.q_no];
    if v_choice = v_key.correct_choice then
      v_correct_count := v_correct_count + 1;
      insert into public.omr_submission_answers (
        submission_id, assignment_id, q_no, chosen_choice, is_correct
      ) values (
        v_response_id, p_assignment_id, v_key.q_no, v_choice, true
      );
    else
      v_wrong_count := v_wrong_count + 1;
      v_wrong_numbers := array_append(v_wrong_numbers, v_key.q_no);
      insert into public.omr_submission_answers (
        submission_id, assignment_id, q_no, chosen_choice, is_correct
      ) values (
        v_response_id, p_assignment_id, v_key.q_no, v_choice, false
      );
    end if;
  end loop;

  v_score := round((v_correct_count::numeric / v_assignment.question_count::numeric) * 100, 2);
  if v_assignment.require_all_correct and v_wrong_count = 0 then
    v_completed := true;
  end if;

  update public.omr_submissions
    set score_percent = v_score,
        correct_count = v_correct_count,
        wrong_count = v_wrong_count,
        status = case when v_completed then 'completed' else 'submitted' end,
        completed_at = case when v_completed then now() else null end,
        updated_at = now()
  where id = v_response_id;

  return jsonb_build_object(
    'status', case when v_completed then 'completed' else 'submitted' end,
    'attempt_no', v_attempt_no,
    'correct_count', v_correct_count,
    'wrong_count', v_wrong_count,
    'score_percent', v_score,
    'mode', v_assignment.feedback_mode,
    'wrong_numbers', case when v_assignment.feedback_mode = 'wrong_numbers' then v_wrong_numbers else null end,
    'wrong_count', case when v_assignment.feedback_mode = 'wrong_count' then v_wrong_count else null end,
    'message', case
      when v_completed then '학습완료'
      when v_assignment.feedback_mode = 'wrong_numbers' then '틀린 번호를 확인해주세요.'
      when v_assignment.feedback_mode = 'wrong_count' then '틀린 개수를 확인해주세요.'
      else '다시 확인해주세요.'
    end
  );
end;
$$;

select pg_notify('pgrst', 'reload schema');
