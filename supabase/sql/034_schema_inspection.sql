-- =============================================================================
-- [1] public 스키마 점검용 조회 (Supabase SQL Editor에서 실행 후 결과 표로 정리)
-- DROP/DELETE 없음. 조회만 수행.
-- =============================================================================

-- A. 테이블 목록 (public 스키마)
SELECT
  t.tablename AS table_name,
  CASE
    WHEN t.tablename IN ('profiles','schools','classes','posts','post_images') THEN 'Y'
    WHEN t.tablename IN ('memberships','students','comments','join_codes') THEN '확인'
    ELSE '기타'
  END AS 주요테이블
FROM pg_tables t
WHERE t.schemaname = 'public'
ORDER BY t.tablename;

-- B. 테이블별 컬럼/타입/nullable/default (profiles, classes, schools)
SELECT
  c.table_schema,
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN ('profiles','classes','schools','posts')
ORDER BY c.table_name, c.ordinal_position;

-- B-2. PK
SELECT
  tc.table_schema,
  tc.table_name,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_name IN ('profiles','classes','schools','posts')
ORDER BY tc.table_name;

-- B-3. FK
SELECT
  tc.table_schema,
  tc.table_name,
  kcu.column_name,
  ccu.table_schema AS ref_schema,
  ccu.table_name AS ref_table,
  ccu.column_name AS ref_column,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
LEFT JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('profiles','classes','schools','posts')
ORDER BY tc.table_name, kcu.column_name;

-- B-4. unique 제약
SELECT
  tc.table_schema,
  tc.table_name,
  tc.constraint_name,
  string_agg(kcu.column_name, ',' ORDER BY kcu.ordinal_position) AS columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'UNIQUE'
  AND tc.table_name IN ('profiles','classes','schools','posts')
GROUP BY tc.table_schema, tc.table_name, tc.constraint_name;

-- C. RLS 활성화 여부
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles','classes','schools','posts','post_images')
ORDER BY tablename;

-- D. RLS 정책 (pg_policies)
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual AS using_expr,
  with_check AS with_check_expr
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles','classes','schools','posts','post_images')
ORDER BY tablename, policyname;

-- E. 권한 플로우 검증용: profiles.role 존재 여부
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
  AND column_name = 'role';

-- F. classes.created_by(또는 teacher_id) 존재 여부
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'classes'
  AND column_name IN ('created_by','teacher_id');
