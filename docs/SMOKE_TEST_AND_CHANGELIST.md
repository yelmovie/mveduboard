# 정리 작업: Smoke Test 체크리스트 및 변경 목록

## 베이스라인
- **브랜치**: `chore/stabilize-cleanup` (main HEAD 기준 생성)
- **원칙**: 기능 삭제/파괴 없음, 삭제는 사용처 0건 증거 후 격리 우선

---

## 변경 전 Smoke Test 체크리스트 (회귀 검증용)

| # | 항목 | 결과 (통과/실패/미실행) | 비고 |
|---|------|------------------------|------|
| 1 | (교사) 로그인 → 세션 유지(새로고침) → 내 정보 저장/학급 저장 |  |  |
| 2 | (교사) 학급 코드 발급/학급 관리 버튼 실제 동작 |  |  |
| 3 | (학생) 입장 코드 흐름 → 학생 화면 정상 |  |  |
| 4 | 게시판: teacher 승인/관리, student 작성/열람 분리 |  |  |
| 5 | 로그아웃 후 보호 페이지 접근 차단 |  |  |
| 6 | 비밀번호 재설정: 메일 발송 → 링크 → 새 비번 설정 |  |  |
| 7 | /reset-password, /debug/health 라우트 접근 |  |  |

---

## 변경 목록 (예정)

### 1) 사용처 0건 → 격리(삭제 안 함)
- `src/features/auth/useSession.ts`: import 0건 → 상단 DEPRECATED 주석 + TODO
- 루트 `lib/supabase/client.ts`, `lib/supabase/storage.ts`, `lib/supabase/events.ts`: 앱이 전부 `src/lib/supabase/*` 사용 → DEPRECATED 주석
- 루트 `lib/image/resizeCompress.ts`: 사용처 `src/lib/image/resizeCompress` → 루트 버전 DEPRECATED 주석
- 루트 `config/supabase.ts`: 앱이 전부 `src/config/supabase` 사용 → DEPRECATED 주석

### 2) 중복 코드 단일 소스
- auth/session: 이미 `src/lib/supabase/client.ts` 단일 인스턴스 사용 유지. 추가 변경 없음(로그인/세션 불안정 방지).
- 에러 메시지: `src/utils/errors.ts` 단일 소스 유지 확인만.

### 3) 버튼/기능 검증
- role 판단: `profiles.role` 단일 컬럼 사용 확인됨.
- 선생님 전용: 학급 생성·코드 발급·승인 등은 `getCurrentUserProfile()` → `role === 'teacher'` 후 노출.
- 학생 전용: 게시판 작성/열람은 `role === 'student'` 및 `allowStudentPost` 등으로 분리 확인.

### 4) 보안 점검
- env: `.env.local` 미커밋, 로그에 토큰/비밀정보 미출력(DEV 또는 VITE_DEBUG_AUTH 시에만 제한 로그).
- 라우팅: /reset-password, /debug/* 만 pathname 분기, 세션 null 시 대시보드 비노출 유지.

### 5) 위험 변경
- 없음. auth/세션/RLS 로직 변경 없음. 격리 시 주석만 추가.

---

## 변경 요약 (파일별)

| 파일 | 변경 내용 |
|------|-----------|
| `deprecated/README.md` | 신규. 사용처 0건 목록 및 삭제 시 증거·롤백 안내. |
| `lib/supabase/client.ts` | 상단 DEPRECATED 주석 추가(삭제 안 함). |
| `lib/supabase/storage.ts` | 상단 DEPRECATED 주석 추가. |
| `lib/supabase/events.ts` | 상단 DEPRECATED 주석 추가. |
| `lib/image/resizeCompress.ts` | 상단 DEPRECATED 주석 추가. |
| `config/supabase.ts` | 상단 DEPRECATED 주석 추가. |
| `constants\limits.ts` | 상단 DEPRECATED 주석 추가(루트 lib 전용). |
| `src/features/auth/useSession.ts` | DEPRECATED + TODO 주석 추가(import 0건). |
| `src/config/supabase.ts` | `isAuthDebug()` 추가. auth 상세 로그는 DEV/VITE_DEBUG_AUTH 시에만 출력. |
| `src/lib/supabase/client.ts` | init 시 `console.log`를 `isAuthDebug()` 조건으로만 출력. |
| `src/lib/supabase/auth.ts` | `teacherSignIn` 내부 로그를 `isAuthDebug()` 조건으로 제한, 세션/토큰/키 목록 미출력. |

---

## 정리했지만 삭제하지 않은 항목 (deprecated/격리)

- **루트 `lib/supabase/*`, `lib/image/*`, `config/supabase.ts`, `constants\limits.ts`**: 앱은 전부 `src/lib`, `src/config`, `src/constants` 사용. 삭제 시 `grep` 사용처 0건 확인 후 진행.
- **`src/features/auth/useSession.ts`**: import 0건. 세션은 App + getSession/onAuthStateChange 사용. 삭제 시 `grep useSession` 0건 확인.

---

## 위험 변경 3개(해당 시) 및 근거/롤백

- **0건.** auth/세션/RLS/라우팅 로직 변경 없음. 로그 출력 조건만 추가(isAuthDebug), 격리 시 주석만 추가.

---

## 회귀 테스트 결과 체크리스트

| # | 항목 | 결과 | 비고 |
|---|------|------|------|
| 1 | (교사) 로그인 → 세션 유지(새로고침) → 내 정보 저장/학급 저장 | (실행 후 기입) | |
| 2 | (교사) 학급 코드 발급/학급 관리 버튼 실제 동작 | (실행 후 기입) | |
| 3 | (학생) 입장 코드 흐름 → 학생 화면 정상 | (실행 후 기입) | |
| 4 | 게시판: teacher 승인/관리, student 작성/열람 분리 | (실행 후 기입) | |
| 5 | 로그아웃 후 보호 페이지 접근 차단 | (실행 후 기입) | |
| 6 | 비밀번호 재설정(해당 브랜치에 있으면) | (실행 후 기입) | |
| 7 | /reset-password, /debug/health 라우트 | (실행 후 기입) | |

---

## 보안 점검 요약

- **환경변수**: `.gitignore`에 `.env`, `.env.local` 포함. 키/비밀 커밋 금지 유지.
- **로그**: auth 상세 로그는 `isAuthDebug()`(DEV 또는 VITE_DEBUG_AUTH)일 때만 출력. 토큰/세션 값·userId 미출력.
- **RLS/라우팅**: 변경 없음. 세션 null 시 대시보드 비노출 로직 유지.
