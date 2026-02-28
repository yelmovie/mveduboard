# 환경 변수 정리 및 보안 가이드

## 1. 환경 변수 키 목록

| 변수명 | 필수 | 설명 | 예시/기본값 |
|--------|------|------|-------------|
| `VITE_SUPABASE_URL` | ✅ | Supabase 프로젝트 URL | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase 공개(anon) 키 | JWT 형식 키 |
| `VITE_OPENAI_API_KEY` | ⭕ | OpenAI API 키 (AI 기능용) | `sk-...` |
| `VITE_OMR_MAX_QUESTIONS` | ❌ | OMR 최대 문항 수 | `200` (기본) |
| `VITE_OMR_MIN_QUESTIONS` | ❌ | OMR 최소 문항 수 | `1` (기본) |
| `VITE_SURVEY_ATTACHMENT_MAX_MB` | ❌ | 설문 첨부 최대 용량(MB) | `5` |
| `VITE_SURVEY_ATTACHMENT_MIME` | ❌ | 첨부 허용 MIME | `image/*` |
| `VITE_BETA_EVENTS_ENABLED` | ❌ | 베타 이벤트 로깅 | `false` |

- **설정 위치**: 프로젝트 루트의 `.env.local` (또는 `.env`)
- **예시 파일**: `.env.example` 을 복사해 `.env.local` 로 저장한 뒤 값만 채우면 됩니다.

---

## 2. 보안 점검

### ✅ 반드시 지킬 것

1. **`.env.local` / `.env` 커밋 금지**
   - 실제 키가 들어 있는 파일은 Git에 올리지 마세요.
   - `.gitignore`에 `*.local` 이 포함되어 있어 `.env.local` 은 자동 제외됩니다.
   - `.env` 도 커밋하지 않도록 루트에 `.env` 를 추가해 두었습니다.

2. **Supabase**
   - `VITE_SUPABASE_ANON_KEY` 는 **공개(anon) 키**라 브라우저에 노출되는 구조입니다.
   - 데이터 보호는 **RLS(행 수준 보안)** 정책으로 하세요. 프로젝트의 Supabase SQL 마이그레이션을 적용해 두었는지 확인하세요.
   - 서비스 역할 키(service_role key)는 **절대** 프론트엔드나 `.env.local` 에 넣지 마세요.

3. **OpenAI API 키**
   - `VITE_` 접두사 변수는 Vite 빌드 시 **클라이언트 번들에 포함**됩니다.
   - 따라서 `VITE_OPENAI_API_KEY` 는 브라우저에서 노출될 수 있습니다.
   - **개발/데모** 용도로는 괜찮지만, **실서비스**에서는 가능하면 백엔드(또는 서버리스 함수)에서만 API를 호출하고, 프론트는 그 API를 호출하도록 구성하는 것을 권장합니다.

### ⚠️ 추가 권장 사항

- 키가 유출된 경우: Supabase는 대시보드에서 anon 키 재발급 가능. OpenAI는 키를 즉시 회전(revoke 후 새 키 발급)하세요.
- CI/배포 환경에서는 저장소가 아닌 **시크릿 관리**에 키를 넣고, 빌드 시에만 주입하세요.

---

## 3. 요약

- **필수**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **AI 기능 사용 시**: `VITE_OPENAI_API_KEY`
- **보안**: `.env.local` 미커밋, Supabase RLS 적용, 프로덕션에서는 OpenAI 호출을 백엔드로 이전 권장.
