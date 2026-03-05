-- 학급 명부 백업(roster_data) jsonb 컬럼 추가 - 데이터 유실 방지
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'roster_data'
  ) THEN
    ALTER TABLE public.classes ADD COLUMN roster_data jsonb;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
