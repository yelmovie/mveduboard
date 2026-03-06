-- 체크리스트(명부 탭) 저장용 jsonb 컬럼 추가 - 이전 기록 유지
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'roster_checklist_data') THEN
    ALTER TABLE public.classes ADD COLUMN roster_checklist_data jsonb;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
