-- =============================================================================
-- 학급 명부 저장(students) RLS 보강 — 추가만, DROP/DELETE 금지
-- DELETE (class_id, created_by) + INSERT (created_by = auth.uid()) 성공하도록 정책 보장.
-- =============================================================================

-- (1) RLS 켜기 — rowsecurity=false일 때만 (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'students' AND rowsecurity = false
  ) THEN
    EXECUTE 'ALTER TABLE public.students ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- (2) 정책 — pg_policies에 없을 때만 생성 (기존 정책 덮어쓰지 않음)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'students' AND policyname = 'students_select_own'
  ) THEN
    EXECUTE $p$
      CREATE POLICY students_select_own ON public.students
      FOR SELECT TO authenticated
      USING (created_by = auth.uid())
    $p$;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'students' AND policyname = 'students_insert_own'
  ) THEN
    EXECUTE $p$
      CREATE POLICY students_insert_own ON public.students
      FOR INSERT TO authenticated
      WITH CHECK (created_by = auth.uid())
    $p$;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'students' AND policyname = 'students_update_own'
  ) THEN
    EXECUTE $p$
      CREATE POLICY students_update_own ON public.students
      FOR UPDATE TO authenticated
      USING (created_by = auth.uid())
      WITH CHECK (created_by = auth.uid())
    $p$;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'students' AND policyname = 'students_delete_own'
  ) THEN
    EXECUTE $p$
      CREATE POLICY students_delete_own ON public.students
      FOR DELETE TO authenticated
      USING (created_by = auth.uid())
    $p$;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- Verify RLS + policies (read-only)
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'students';

SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'students'
ORDER BY policyname;
