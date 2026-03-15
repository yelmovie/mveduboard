-- =============================================================================
-- 학생 입장 코드(참여 코드) 로그인 점검용 스크립트
--
-- 실행 방법: Supabase 대시보드 → SQL Editor → 새 쿼리 → 이 파일 내용 붙여넣기 → Run
--
-- 하는 일:
-- 1) RPC get_class_and_roster_by_join_code 생성/갱신 및 anon·authenticated 실행 권한 부여
-- 2) join_code가 비어 있는 classes 행에 고유 코드 자동 채우기
-- 3) 마지막에 RPC 존재 여부 확인용 SELECT
--
-- "참여 코드가 올바르지 않습니다" 오류가 나면 이 스크립트를 한 번 실행한 뒤
-- 선생님 대시보드에서 표시되는 입장 코드로 다시 시도해 보세요.
-- =============================================================================

-- 1) RPC 함수 생성/갱신 (학생이 로그인 전 anon으로 참여 코드로 학급·명부 조회)
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

-- 2) (선택) join_code가 비어 있는 classes 행이 있으면 고유값 채우기
-- 이미 join_code가 있는 행은 변경되지 않습니다. (id 기반으로 고유 8자리)
UPDATE public.classes
SET join_code = upper(substring(md5(id::text) from 1 for 8))
WHERE join_code IS NULL OR trim(join_code) = '';

-- unique 제약이 없다면 추가 (이미 있으면 무시)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'classes_join_code_key' AND conrelid = 'public.classes'::regclass
  ) THEN
    ALTER TABLE public.classes ADD CONSTRAINT classes_join_code_key UNIQUE (join_code);
  END IF;
EXCEPTION
  WHEN unique_violation THEN NULL;
END $$;

-- 3) 확인용: RPC가 anon으로 호출 가능한지 (실행 후 결과만 확인)
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'get_class_and_roster_by_join_code';
