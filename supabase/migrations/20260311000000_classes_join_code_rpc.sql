-- =============================================================================
-- 학급 참여 코드(join_code)로 학급·명부 조회 RPC
-- 학생이 로그인 전(anon)에 참여 코드로 학급 조회 시 RLS 때문에 SELECT가 막히는 문제 해결.
-- SECURITY DEFINER로 정의되어 있어 anon/authenticated가 호출 가능.
-- =============================================================================

-- join_code로 학급 정보(id, school_id)와 해당 학급 명부(students) 반환
CREATE OR REPLACE FUNCTION public.get_class_and_roster_by_join_code(p_join_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_class record;
  v_students jsonb;
  v_result jsonb;
BEGIN
  v_code := upper(trim(nullif(p_join_code, '')));
  IF v_code IS NULL OR v_code = '' THEN
    RETURN NULL;
  END IF;

  SELECT c.id, c.school_id, c.join_code
  INTO v_class
  FROM public.classes c
  WHERE c.join_code = v_code
  LIMIT 1;

  IF v_class.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'student_no', s.student_no,
        'gender', s.gender
      ) ORDER BY s.student_no NULLS LAST, s.name
    ),
    '[]'::jsonb
  )
  INTO v_students
  FROM public.students s
  WHERE s.class_id = v_class.id;

  v_result := jsonb_build_object(
    'id', v_class.id,
    'school_id', v_class.school_id,
    'join_code', v_class.join_code,
    'students', coalesce(v_students, '[]'::jsonb)
  );
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_class_and_roster_by_join_code(text) IS
  '참여 코드로 학급 정보와 명부 조회. 학생 가입 전 anon 호출용.';

GRANT EXECUTE ON FUNCTION public.get_class_and_roster_by_join_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_class_and_roster_by_join_code(text) TO authenticated;
