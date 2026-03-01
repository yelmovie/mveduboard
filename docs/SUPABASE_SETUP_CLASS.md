# 학급 정보 생성 — Supabase 설정 가이드

학급 정보(학교·학급 생성, 입장 코드 발급, 나의 정보 수정)가 동작하려면 아래 테이블·컬럼·RLS가 Supabase에 적용되어 있어야 합니다.

---

## 1. 필수 테이블

| 테이블 | 용도 |
|--------|------|
| `auth.users` | Supabase Auth 기본 (회원가입/로그인) |
| `public.schools` | 학교 정보 (이름 등) |
| `public.classes` | 학급 정보 (이름, 입장 코드, 생성자) |
| `public.profiles` | 사용자 프로필 (역할, 학교/학급 연결) |

---

## 2. `classes` 테이블에 필요한 컬럼

앱 코드는 `classes`에 아래 컬럼을 사용합니다. **001_init.sql**에는 없으므로, 마이그레이션으로 추가해야 합니다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `grade` | integer NOT NULL | 학년 (기본값 1) |
| `class_no` | integer NOT NULL | 반 번호 (기본값 1) |
| `created_by` | uuid NOT NULL REFERENCES auth.users(id) | 학급 생성자(선생님) |

**적용 방법:** Supabase SQL Editor에서 **`supabase/sql/032_class_info_setup.sql`** 실행 (아래 5번 참고).

---

## 3. RLS 정책 요약

### 3.1 schools

- **SELECT**: 인증된 사용자 (`auth.role() = 'authenticated'`)
- **INSERT**: 인증된 사용자 (회원가입/학급 생성 시 학교 생성)
- **UPDATE**: 인증된 사용자 (나의 정보 수정 시 학교명 변경) ← **없으면 추가 필요**

### 3.2 classes

- **SELECT**: 본인 학급만 (프로필의 `school_id`/`class_id` 또는 `created_by = auth.uid()`)
- **INSERT**: 인증된 사용자 (회원가입 시 학급 생성) + 선생님 프로필 있을 때
- **UPDATE**: `created_by = auth.uid()` (입장 코드 재발급, 학급명 수정)

### 3.3 profiles

- **SELECT**: 본인 또는 같은 학급 선생님
- **INSERT**: 본인만 (`auth.uid() = id`)
- **UPDATE**: 본인만 (`auth.uid() = id`) ← **없으면 추가 필요**

---

## 4. Supabase 대시보드에서 확인할 것

1. **Authentication**
   - **Providers**: Email 등록·로그인 사용 시 Email 활성화
   - **Email Confirmations**: 사용하지 않으면 "Confirm email" 끄면 즉시 로그인 가능

2. **Table Editor**
   - `schools`, `classes`, `profiles` 테이블 존재 여부
   - `classes`에 `grade`, `class_no`, `created_by` 컬럼 존재 여부

3. **SQL Editor**
   - 아래 "5. 적용 순서"대로 스크립트 실행

4. **API**
   - Project URL, anon key를 `.env` / Vercel의 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`에 설정

---

## 5. 적용 순서 (SQL Editor에서 실행)

1. **001_init.sql** — 테이블 생성 (이미 있으면 생략 가능)
2. **002_rls.sql** — RLS 기본 정책
3. **006_fix_signup_rls.sql** — 회원가입/학급 생성용 INSERT 허용
4. **032_class_info_setup.sql** — `classes`에 `grade`, `class_no`, `created_by` 컬럼 추가 + `profiles`/`schools`/`classes` UPDATE 정책 추가 (이 파일을 실행해야 학급 생성·나의 정보 수정이 동작함)

실행 후 **Schema reload**: Settings → API → "Reload schema" 또는 SQL에서 `notify pgrst, 'reload schema';`

---

## 6. 정리

- **학급 정보 생성**이 안 되면: `classes`에 `grade`, `class_no`, `created_by` 존재 여부와 `classes_authenticated_insert` 등 INSERT 정책 확인.
- **나의 정보 수정 저장**이 안 되면: `profiles`, `schools`, `classes`에 대한 **UPDATE** RLS 정책 존재 여부 확인.
- **입장 코드 재발급**이 안 되면: `classes`에 `created_by` 컬럼과 `classes_teacher_update_own` 정책 확인.
