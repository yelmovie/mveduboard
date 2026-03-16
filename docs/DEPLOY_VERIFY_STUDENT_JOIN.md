# 배포 런타임 검증 — 학생 로그인

## 1. 배포 확인

- **Production branch**: Vercel 대시보드 → 프로젝트 → Settings → Git → Production Branch 확인 (보통 `main`).
- **Production latest commit**: Vercel → Deployments → 최신 배포의 commit hash.
- **be9cb78 반영 여부**: 배포된 commit이 be9cb78 이상이면 yes. 아니면 해당 배포의 commit이 실제 라이브.
- **테스트 환경 구분**: prod(배포 URL) / preview(PR 배포) / local(로컬 dev).

배포 시 커밋 해시를 앱에서 보려면 빌드 시 `VITE_GIT_SHA` 주입. 예: Vercel에서 Environment Variable에 `VITE_GIT_SHA` = `$VERCEL_GIT_COMMIT_SHA` 설정.

---

## 2. 환경변수 검증

- **client 파일**: `src/lib/supabase/client.ts` — `createClient(SUPABASE_URL, SUPABASE_ANON_KEY, ...)` 한 곳에서 생성.
- **교사 경로**: `TeacherDashboard` → `getClassById()` (auth) → 동일 `supabase` import.
- **학생 경로**: `StudentLoginModal` → `studentService.fetchRosterByJoinCode` / `auth.studentJoinWithCode` → 동일 `supabase` import.
- **같은 프로젝트**: yes. 단일 client 인스턴스 사용.

배포 환경에서 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`가 mveduboard 프로젝트와 일치하는지 확인. URL host prefix는 `?debugJoin=1` 배너에서 확인.

---

## 3. 실패 지점 (정확한 조건문)

| 메시지 | 파일 | 함수 | 조건 |
|--------|------|------|------|
| 입력한 참여 코드를 찾을 수 없습니다 | `services/studentService.ts` | `fetchRosterByJoinCode` | `!payload \|\| !payload.id` (RPC 성공 but 학급 없음) |
| 참여 코드를 확인할 수 없습니다 (잠시 후) | `services/studentService.ts` | `fetchRosterByJoinCode` | `error` (RPC 에러) |
| 학급 명부에 없는 이름입니다 | `components/StudentLoginModal.tsx` | `handleJoin` | `!matched` (명부에는 있으나 이름 불일치) |
| 학급 명부가 등록되지 않았습니다 | `components/StudentLoginModal.tsx` | `handleJoin` | `roster.length === 0` |
| 참여 코드가 올바르지 않습니다 | `services/boardService.ts` | `joinBoard` | `!options?.skipCodeCheck && normalizedCode !== '123456'` — 학생 모달에서는 `skipCodeCheck: true`로 호출하므로 정상 경로에서는 발생하지 않음. 예전 빌드 또는 다른 호출 경로에서만 가능. |

실제 런타임 값 확인: 배포 사이트에서 학생 로그인 모달 열고 **?debugJoin=1** 붙인 뒤 입장 시도 → 콘솔 `[join-debug] submit` 및 화면 하단 배너에서 `failureReason`, `resultExists`, `matchedStudentExists`, `rpcStudentCount` 확인.

---

## 4. ?debugJoin=1 사용법

1. URL에 `?debugJoin=1` 추가 (예: `https://mveduboard.vercel.app/?debugJoin=1`).
2. 학생 로그인 모달 열기.
3. 참여 코드·이름 입력 후 입장하기 클릭.
4. **콘솔**: `[join-debug] submit` 로그에 rawCodeLength, normalizedCodeMasked, resultExists, matchedStudentExists, failureReason 등 출력.
5. **화면**: 모달 하단 배너에 build gitSha, env host, anon key hint, 마지막 제출의 reason/rpcStudentCount 표시.
6. **버튼**: "코드만 검증" / "이름만 명부 매칭" / "RPC raw 요약"으로 단계별 검증.

원인 파악 후에는 URL에서 `?debugJoin=1` 제거.
