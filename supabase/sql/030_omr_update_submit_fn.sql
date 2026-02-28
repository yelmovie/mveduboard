-- OMR 채점 함수 업데이트 (answer_key: type=choice|short, answer 필드)

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
  v_attempt_id uuid;
  v_key jsonb;
  v_no int;
  v_type text;
  v_choice text;
  v_expected_choice int;
  v_expected_choices int[] := '{}';
  v_selected_choices int[] := '{}';
  v_expected_text text;
  v_answers jsonb;
  v_existing_attempt public.omr_attempts%rowtype;
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
  if v_answer_count is null or v_answer_count <> v_assignment.num_questions then
    raise exception 'invalid_answer_count';
  end if;

  select * into v_existing_attempt
  from public.omr_attempts
  where assignment_id = p_assignment_id and user_id = v_user_id;

  if v_existing_attempt.id is not null and v_existing_attempt.is_complete = true then
    return jsonb_build_object(
      'status','locked',
      'message','이미 완료된 과제입니다.',
      'attempt_no', v_existing_attempt.attempt_no
    );
  end if;

  v_attempt_no := coalesce(v_existing_attempt.attempt_no, 0) + 1;

  if v_assignment.attempt_limit is not null and v_attempt_no > v_assignment.attempt_limit then
    return jsonb_build_object(
      'status','locked',
      'message','제출 횟수를 초과했습니다.',
      'attempt_no', v_attempt_no
    );
  end if;

  select jsonb_agg(jsonb_build_object('no', idx, 'answer', p_answers[idx])) into v_answers
  from generate_subscripts(p_answers, 1) as idx;

  if v_assignment.answer_key is null then
    raise exception 'answer_key_missing';
  end if;

  for v_key in
    select value from jsonb_array_elements(v_assignment.answer_key) as value
  loop
    v_no := (v_key->>'no')::int;
    v_type := v_key->>'type';
    v_choice := p_answers[v_no];

    if v_type = 'choice' then
      if jsonb_typeof(v_key->'answer') = 'array' then
        select array_agg(value::int) into v_expected_choices
        from jsonb_array_elements_text(v_key->'answer');
      else
        v_expected_choice := (v_key->>'answer')::int;
        v_expected_choices := array[v_expected_choice];
      end if;

      v_selected_choices := coalesce(string_to_array(coalesce(v_choice, ''), ',')::int[], '{}');
      if v_selected_choices <@ v_expected_choices and v_expected_choices <@ v_selected_choices then
        v_correct_count := v_correct_count + 1;
      else
        v_wrong_count := v_wrong_count + 1;
        v_wrong_numbers := array_append(v_wrong_numbers, v_no);
      end if;
    else
      v_expected_text := trim(coalesce(v_key->>'answer',''));
      if trim(coalesce(v_choice,'')) = v_expected_text and v_expected_text <> '' then
        v_correct_count := v_correct_count + 1;
      else
        v_wrong_count := v_wrong_count + 1;
        v_wrong_numbers := array_append(v_wrong_numbers, v_no);
      end if;
    end if;
  end loop;

  v_score := round((v_correct_count::numeric / v_assignment.num_questions::numeric) * 100, 2);
  if v_assignment.require_all_answers and v_wrong_count = 0 then
    v_completed := true;
  end if;

  if v_existing_attempt.id is null then
    insert into public.omr_attempts (
      assignment_id, class_id, user_id, answers, attempt_no, status, score_percent, correct_count, wrong_count, is_complete, completed_at
    ) values (
      p_assignment_id, v_class_id, v_user_id, coalesce(v_answers, '[]'::jsonb), v_attempt_no,
      case when v_completed then 'completed' else 'submitted' end,
      v_score, v_correct_count, v_wrong_count, v_completed, case when v_completed then now() else null end
    ) returning id into v_attempt_id;
  else
    update public.omr_attempts
      set answers = coalesce(v_answers, '[]'::jsonb),
          attempt_no = v_attempt_no,
          score_percent = v_score,
          correct_count = v_correct_count,
          wrong_count = v_wrong_count,
          status = case when v_completed then 'completed' else 'submitted' end,
          is_complete = v_completed,
          completed_at = case when v_completed then now() else null end,
          updated_at = now()
    where id = v_existing_attempt.id
    returning id into v_attempt_id;
  end if;

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
