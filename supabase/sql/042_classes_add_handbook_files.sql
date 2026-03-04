-- 교무수첩 파일 (학사일정, 연간시간표, 시수표, 진도표) jsonb 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'handbook_files'
  ) THEN
    EXECUTE 'ALTER TABLE public.classes ADD COLUMN handbook_files jsonb';
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
