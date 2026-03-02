-- =============================================================================
-- classes 테이블에 study_data (jsonb) 컬럼 추가
-- 주간학습안내 데이터를 classes 행에 저장하기 위한 컬럼.
-- 추가만, DROP 없음.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'study_data'
  ) THEN
    EXECUTE 'ALTER TABLE public.classes ADD COLUMN study_data jsonb';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
