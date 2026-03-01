# Deprecated / 격리 대상 (삭제하지 않음)

아래 항목은 **사용처 0건**으로 확인되었으나, 기능 파괴/임의 삭제 방지 원칙에 따라  
**삭제하지 않고** 주석으로만 표시했습니다. 삭제 시에는 반드시 grep 등으로 사용처 0건을 재확인하고 롤백 계획을 세우세요.

## 1. 루트 `lib/`, `config/` (앱에서 미사용)

- 앱 전체가 Supabase/이미지 관련해 **`src/lib/supabase/*`**, **`src/config/supabase`** 만 import함.
- 루트 `lib/supabase/client.ts`, `lib/supabase/storage.ts`, `lib/supabase/events.ts`, `lib/image/resizeCompress.ts`, `config/supabase.ts` 는 **어떤 컴포넌트/서비스에서도 import하지 않음** (검색 근거: `from ['\"].*src/lib/`, `from ['\"].*src/config/` 만 사용).

**증거**:  
- `lib/supabase/client.ts` → grep "from.*lib/supabase/client" → 모두 `src/lib/supabase/client` 참조.  
- `config/supabase.ts` → grep "from.*config/supabase" → 모두 `src/config/supabase` 참조.

**조치**: 각 파일 상단에 `// DEPRECATED: 사용처 없음. 단일 소스는 src/lib, src/config.` 주석 추가.  
**삭제 시**: 위 grep 재실행 + 빌드 통과 후 진행, 필요 시 이 README 기준으로 롤백.

---

## 2. `src/features/auth/useSession.ts` (import 0건)

- `useSession` 훅을 import하는 파일 없음.  
- 앱은 `App.tsx` + `getSession()` / `onAuthStateChange` 로 세션을 관리함.

**조치**: 파일 상단에 DEPRECATED + TODO 주석 추가.  
**삭제 시**: `grep -r "useSession" --include="*.ts" --include="*.tsx"` 결과 0건 확인 후 진행.
