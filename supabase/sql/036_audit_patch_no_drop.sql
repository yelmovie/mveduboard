-- =============================================================================
-- 학급 저장/생성 실패 전수 점검용 패치 (추가만, DROP/DELETE 금지)
-- 034 점검 실행 후 누락이 있을 때만 적용. 여러 번 실행 가능.
-- =============================================================================

-- (1) profiles 보완 (역할 기반 분리)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS display_name text DEFAULT '사용자',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- (2) classes 보완 (학급 생성 주체) — 앱은 name 컬럼 사용, class_name 미사용
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- (3) FK 보완 (없을 때만, pg_constraint 기준)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classes_created_by_fkey') THEN
    ALTER TABLE public.classes
      ADD CONSTRAINT classes_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- (4) RLS 켜기 (필요 시)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- (5) profiles 정책 (본인 row만 SELECT/INSERT/UPDATE) — 이름 없을 때만 추가
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_select_own') THEN
    CREATE POLICY profiles_select_own ON public.profiles
      FOR SELECT TO authenticated USING (id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_insert_own') THEN
    CREATE POLICY profiles_insert_own ON public.profiles
      FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_update_own') THEN
    CREATE POLICY profiles_update_own ON public.profiles
      FOR UPDATE TO authenticated
      USING (id = auth.uid()) WITH CHECK (id = auth.uid());
  END IF;
END $$;

-- (6) classes 정책 (teacher만 INSERT/UPDATE) — 이름 없을 때만 추가
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'classes' AND policyname = 'classes_insert_teacher') THEN
    CREATE POLICY classes_insert_teacher ON public.classes
      FOR INSERT TO authenticated
      WITH CHECK (
        created_by = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'teacher'
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'classes' AND policyname = 'classes_update_teacher') THEN
    CREATE POLICY classes_update_teacher ON public.classes
      FOR UPDATE TO authenticated
      USING (
        created_by = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'teacher'
        )
      )
      WITH CHECK (
        created_by = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'teacher'
        )
      );
  END IF;
END $$;

-- (OMR RLS는 별도 패치: supabase/sql/037_omr_enable_rls_no_drop.sql)

NOTIFY pgrst, 'reload schema';
