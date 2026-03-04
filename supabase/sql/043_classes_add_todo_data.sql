-- 할일 목록(todo_tasks, todo_records) jsonb 컬럼 추가
-- study_data, handbook_files와 동일한 패턴
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'todo_data'
  ) THEN
    EXECUTE 'ALTER TABLE public.classes ADD COLUMN todo_data jsonb';
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
