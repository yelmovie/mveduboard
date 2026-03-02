-- =============================================================================
-- classes 테이블에 monthly_plan_data (jsonb) 컬럼 추가
-- 학교 월간교육계획 파일 데이터를 classes 행에 저장.
-- 추가만, DROP 없음.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'monthly_plan_data'
  ) THEN
    EXECUTE 'ALTER TABLE public.classes ADD COLUMN monthly_plan_data jsonb';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
