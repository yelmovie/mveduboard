# 학급 저장/생성 실패 — 전수 점검 및 검증

증거 기반으로 Supabase·Vercel·클라이언트 전 구간을 점검하고, 누락/불일치 시 최소 변경만 적용한다.  
**금지**: 임의 기능 삭제, DROP/DELETE, 정책 덮어쓰기.

---

## [0] 사전 증거 (캡처/기록)

### A. 브라우저 Network (Fetch/XHR)

**학급 명부 저장 (students)** — 아래 두 요청 각각 캡처 후 붙여넣기.

| 요청 | method | full URL (쿼리 포함) | status | response body (짧게) |
|------|--------|----------------------|--------|----------------------|
| 1) 기존 명부 삭제 | DELETE | (예: …/rest/v1/students?class_id=eq.xxx&created_by=eq.yyy) | 204 / 401 / 403 / 400 | |
| 2) 명부 INSERT | POST | (예: …/rest/v1/students) | 201 / 401 / 403 / 400 | |

- **진단**: 401 → auth/세션/anon key · 403 → RLS/정책 거부 · 400 → 스키마/페이로드 불일치

| 항목 | 기록 | 비고 |
|------|------|------|
| **Google 로그인 후 학급 저장 클릭** 시 실패 요청 | URL: _____________ (예: /rest/v1/classes) | |
| | status: _____________ (401/403/400) | |
| | response body (error/message): _____________ | |
| **비번 로그인** 시 /auth/v1/token | status: _____________ (200/401) | |
| | response error_description: _____________ | |

### B. 브라우저 Storage

| 항목 | 결과 |
|------|------|
| localStorage `sb-<projectRef>-auth-token` | 있음 / 없음 |

### C. 콘솔 오류 분류

| 구분 | 내용 |
|------|------|
| **치명(기능 영향)** |  |
| **무시 가능(경고)** |  |

---

## [1] 설정 점검 결과 표

### 1) Supabase — Authentication → URL Configuration

| 항목 | 기대값 | 확인 결과 | 조치 |
|------|--------|-----------|------|
| Site URL | https://<vercel-domain> (예: https://mveduboard.vercel.app) |  | 불일치 시 대시보드에서 수정 |
| Redirect URLs | https://<vercel-domain>/* |  | 누락 시 추가 |
| | http://localhost:<port>/* (로컬 사용 시) |  | |
| | https://<vercel-domain>/reset-password (또는 /* 로 커버) |  | |

### 2) Supabase — Authentication → Providers

| 항목 | 확인 결과 | 조치 |
|------|-----------|------|
| Email provider enabled | Y/N | 비번 로그인 필요 시 Y |
| Google provider enabled | Y/N | |
| Google Client ID/Secret 존재 | Y/N | |
| Confirm email required | Y/N | Y이면 Users에서 confirmed 확인 |
| Google OAuth redirect URI (Google Cloud) | https://\<projectRef>.supabase.co/auth/v1/callback | Google Cloud Console에 동일 등록 |

### 3) Supabase — Authentication → Users

| 항목 | 확인 결과 |
|------|-----------|
| 테스트 teacher 계정 존재 |  |
| Google 로그인 계정이 Users에 생성됨 |  |
| Email confirmed (필요 시) |  |

### 4) Vercel — Environment Variables

| 변수 | Production | Preview | 비고 |
|------|------------|---------|------|
| VITE_SUPABASE_URL |  |  | 공백/줄바꿈/오타 없이 |
| VITE_SUPABASE_ANON_KEY |  |  |  |

### 5) DB 스키마 (034 점검 실행 결과 기준)

| 테이블 | 존재 | RLS enabled | 비고 |
|--------|------|-------------|------|
| profiles |  |  | role, display_name, school_id, class_id |
| classes |  |  | created_by, name, join_code, school_id |
| schools |  |  | name, created_at |
| posts |  |  |  |
| memberships / students / comments |  |  | 있으면 확인 |
| students |  | RLS on (010/038) | 명부 저장: DELETE/INSERT 정책 students_*_own (created_by = auth.uid()) |
| omr_assignments |  | Before: false (정책 미적용) / 패치 후: true | **037** 전용: `alter table public.omr_assignments enable row level security;` |

- **[RLS] public.students**: 명부 저장 시 1) DELETE (class_id, created_by) 2) POST INSERT. 정책: students_delete_own, students_insert_own (created_by = auth.uid()). 누락 시 **038** 적용.
- **[RLS] public.omr_assignments**: pg_policies는 6개 존재하나 rowsecurity가 false였음 → **037** `supabase/sql/037_omr_enable_rls_no_drop.sql` 실행. 재확인: `pg_tables.rowsecurity`가 true.

### 6) RLS 정책 (pg_policies 조회 결과)

| 테이블 | 정책명 | cmd | 조건 요약 |
|--------|--------|-----|----------|
| profiles | profiles_owner_read / profiles_select_own | SELECT | id = auth.uid() |
| profiles | profiles_owner_write / profiles_insert_own | INSERT | id = auth.uid() |
| profiles | profiles_owner_update / profiles_update_own | UPDATE | id = auth.uid() |
| classes | classes_authenticated_insert | INSERT | auth.role() = 'authenticated' |
| classes | classes_teacher_write / classes_insert_teacher | INSERT | created_by = auth.uid() + teacher profile |
| classes | classes_teacher_update_own / classes_update_teacher | UPDATE | created_by = auth.uid() |
| schools | schools_authenticated_* | SELECT/INSERT/UPDATE | authenticated |
| students | students_select_own, students_insert_own, students_update_own, students_delete_own | SELECT/INSERT/UPDATE/DELETE | created_by = auth.uid() |

### 7) Network 상태코드별 원인

| status | 원인 후보 | 확인 |
|--------|-----------|------|
| 401 | JWT 미포함(세션 없음/singleton 아님/직접 fetch) |  |
| 403 | RLS 정책 불일치(teacher/created_by) |  |
| 400 | 컬럼/타입/NOT NULL/체크 제약 불일치 |  |

---

## [2] 앱 코드 점검 결과

| 항목 | 상태 | 비고 |
|------|------|------|
| Supabase client singleton | OK | `src/lib/supabase/client.ts` 한 곳에서만 createClient |
| 학급 생성 경로 | OK | `createTeacherSchoolAndClass` → supabase.from('classes').insert(payload), created_by = sessionUserId |
| fetch 직접 호출 | 없음 | SDK 사용 |
| Google 로그인 후 profiles upsert | OK | `ensureTeacherProfile(session.user)` on SIGNED_IN (App onAuthStateChange) |
| 401/403/400 UI 표시 | OK | auth.ts에서 error.status, error_description 기반 throw, "Invalid API key" 단독 매핑 없음 |
| 비밀번호 재설정 | OK | resetPasswordForEmail + /reset-password + updatePassword |

---

## [3] 적용한 SQL 패치

- **파일**: `036_audit_patch_no_drop.sql` (profiles/classes), `037_omr_enable_rls_no_drop.sql` (OMR 전용), `038_students_roster_rls_patch_no_drop.sql` (명부 저장용).
- **원칙**: DROP/DELETE 없음. ADD COLUMN IF NOT EXISTS, DO $$ 로 정책은 없을 때만 추가. OMR 수정은 037에만, 명부(students) 수정은 038에만.
- **적용 순서**: 034 점검 실행 → 누락 확인 → 036 → (필요 시) 037, 038 → 034 재실행으로 검증.

(적용한 패치만 아래에 요약 기록)

| # | 적용 내용 | 파일/블록 |
|---|----------|------------|
| 1 | profiles: role, display_name, updated_at (IF NOT EXISTS) | 036 (1) |
| 2 | classes: created_by, school_id, updated_at (IF NOT EXISTS) | 036 (2) |
| 3 | classes.created_by FK (pg_constraint 없을 때만) | 036 (3) |
| 4 | RLS 활성화 (profiles, classes) | 036 (4) |
| 5 | profiles 정책: profiles_select_own, profiles_insert_own, profiles_update_own | 036 (5) |
| 6 | classes 정책: classes_insert_teacher, classes_update_teacher | 036 (6) |
| 7 | omr_assignments RLS 활성화 (기존 정책 유지) | **037** (OMR 전용, 036과 분리) |
| 8 | students RLS + 정책 (students_*_own, 없을 때만 추가) | **038** (명부 저장 경로) |

---

### omr_assignments RLS 재확인 (패치 적용 후)

```sql
-- 1) RLS on/off
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'omr_assignments';

-- 2) 정책 목록
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'omr_assignments'
ORDER BY policyname;
```

기대: `rowsecurity = true`, 정책 6개 유지. (034 점검 SQL로도 확인 가능.)

### students (명부 저장) 재확인 (038 적용 후)

```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'students';

SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'students'
ORDER BY policyname;
```

기대: `rowsecurity = true`, students_delete_own, students_insert_own 등 4개 정책.

---

## [4] 수정 후 검증 체크리스트 (증거)

| # | 항목 | 통과 | 증거(캡처/로그 요약) |
|---|------|------|----------------------|
| 1 | URL Configuration: Site URL / Redirect URLs 정상 |  |  |
| 2 | Google 로그인 성공 후 localStorage에 sb-*-auth-token 생성 |  |  |
| 3 | 학급 명부 저장: DELETE /rest/v1/students 204, POST /rest/v1/students 201 |  | 위 [0] A에 캡처 붙여넣기 |
| 4 | Table Editor에서 students row 확인 (class_id, created_by 일치) |  |  |
| 5 | Table Editor에서 classes row 생성 확인 |  |  |
| 6 | 로그아웃 후 보호 페이지 접근 차단 |  |  |
| 7 | (선택) 비번 재설정 메일 → 비번 변경 → 비번 로그인 200 |  |  |

---

## [5] 리스크 및 롤백 안내

- **변경 내용**: 컬럼 추가(IF NOT EXISTS), 정책 추가(이름 없을 때만). 기존 정책/테이블/행 삭제 없음.
- **롤백**:  
  - 추가한 **정책**만 제거하려면 별도 승인 후 `DROP POLICY IF EXISTS ...` 실행.  
  - **컬럼** 제거는 권장하지 않음(앱이 사용 중일 수 있음). 필요 시 별도 마이그레이션으로 처리.

---

## [6] 034 점검 SQL 실행 방법

1. Supabase 대시보드 → SQL Editor.
2. `supabase/sql/034_schema_inspection.sql` 내용 붙여넣기 → Run.
3. 결과를 위 [1] 표에 채워 넣고, 누락 시 `036_audit_patch_no_drop.sql` 실행 후 034 다시 실행해 검증.

---

## 증거 기록 (Network / response body / 테이블 row)

- **실패 요청 URL**: (예: `https://<projectRef>.supabase.co/rest/v1/classes` 또는 `/rest/v1/students`)
- **실패 status / response body**: (예: 403, `{"code":"42501","message":"..."}`)
- **학급 명부 저장 성공 시** (패치 038 적용 후, 2xx면 아래에 붙여넣기):
  - 요청 1: method DELETE, URL `…/rest/v1/students?class_id=eq.<id>&created_by=eq.<uid>`, status _____, response body _____
  - 요청 2: method POST, URL `…/rest/v1/students`, status _____, response body _____
- **Table Editor students row**: (class_id, created_by, name, student_no 등 확인)
- **적용한 패치**: 036 (profiles/classes), 037 (omr_assignments RLS), 038 (students 명부 RLS/정책)
- **롤백**: 추가한 정책만 제거 시 `DROP POLICY IF EXISTS ...` 별도 승인 후 실행.
