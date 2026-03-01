-- =============================================================================
-- [2] 보완 전용 (추가만, DROP/DELETE 금지)
-- Supabase SQL Editor에서 034 점검 실행 후, 누락된 항목이 있을 때만 실행.
-- 여러 번 실행해도 안전 (IF NOT EXISTS / DO 블록).
-- =============================================================================

-- (1) profiles: 누락 컬럼만 추가 (이미 있으면 무시)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS display_name text DEFAULT '사용자',
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- role이 있지만 CHECK 제약이 없으면 추가하지 않음(기존 데이터 깨질 수 있음). 필요 시 수동 적용.

-- (2) classes: created_by, grade, class_no 등 누락 시 추가
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS grade int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS class_no int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS join_code_created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- (3) schools: name, created_at (001에 있으나 마이그레이션 누락 시)
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- (4) created_by FK (없을 때만 추가, ON DELETE SET NULL로 기존 행 보호)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'classes'
      AND constraint_name = 'classes_created_by_fkey'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.classes
      ADD CONSTRAINT classes_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- (5) RLS 활성화 (이미 켜져 있으면 no-op)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- (6) 정책은 "이름이 없을 때만" 추가 (기존 정책 덮어쓰지 않음)
-- profiles: 본인 SELECT
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_owner_read') THEN
    CREATE POLICY profiles_owner_read ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_owner_write') THEN
    CREATE POLICY profiles_owner_write ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_owner_update') THEN
    CREATE POLICY profiles_owner_update ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- classes: authenticated insert (학급 생성 경로용, Google 로그인 직후 프로필 없을 수 있음)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='classes' AND policyname='classes_authenticated_insert') THEN
    CREATE POLICY classes_authenticated_insert ON public.classes FOR INSERT TO authenticated WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

-- classes: 생성자만 UPDATE
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='classes' AND policyname='classes_teacher_update_own') THEN
    CREATE POLICY classes_teacher_update_own ON public.classes FOR UPDATE TO authenticated
      USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
  END IF;
END $$;

-- classes: SELECT (생성자 또는 동일 학교 teacher)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='classes' AND policyname='classes_teacher_select_own') THEN
    CREATE POLICY classes_teacher_select_own ON public.classes FOR SELECT TO authenticated
      USING (
        created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'teacher' AND p.school_id = classes.school_id
        )
      );
  END IF;
END $$;

-- schools: authenticated SELECT/INSERT
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='schools' AND policyname='schools_authenticated_select') THEN
    CREATE POLICY schools_authenticated_select ON public.schools FOR SELECT TO authenticated USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='schools' AND policyname='schools_authenticated_insert') THEN
    CREATE POLICY schools_authenticated_insert ON public.schools FOR INSERT TO authenticated WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='schools' AND policyname='schools_authenticated_update') THEN
    CREATE POLICY schools_authenticated_update ON public.schools FOR UPDATE TO authenticated USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

-- 스키마 리로드 알림
NOTIFY pgrst, 'reload schema';
