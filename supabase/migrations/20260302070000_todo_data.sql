-- 할일 목록(todo_data) jsonb 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'todo_data'
  ) THEN
    ALTER TABLE public.classes ADD COLUMN todo_data jsonb;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
