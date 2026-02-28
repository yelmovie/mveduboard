<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1U2ZKwPY2Blaoj_iD6qaM4VFq86chRLZk

## Run Locally

**Prerequisites:** Node.js, pnpm


1. Install dependencies:
   `pnpm install`
2. 환경 변수: `.env.example` 을 참고해 `.env.local` 에 키를 설정하세요.  
   자세한 키 목록과 보안 안내는 [docs/ENV_AND_SECURITY.md](docs/ENV_AND_SECURITY.md) 참고.
   - 필수: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - AI 기능: `VITE_OPENAI_API_KEY`
3. Run the app:
   `pnpm dev`

## Supabase 연결 확인

- `.env.local`에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`가 있으면 앱에서 Supabase 클라이언트가 생성됩니다.
- 개발 서버 실행 시 콘솔에 `[supabase] url set? true anon set? true` 로그가 보이면 환경변수가 적용된 것입니다.
- 선생님 로그인/회원가입, 학급 코드 등이 정상 동작하면 Supabase와 연결된 것입니다.

## Supabase setup (Bingo)

If you see errors like `Could not find the table 'public.bingo_rooms' in the schema cache`,
apply the migrations and refresh the schema cache:

1. Apply migrations:
   - Supabase CLI: `supabase db push`
   - Or SQL Editor: run `supabase/migrations/20260125_bingo_rooms.sql` and
     `supabase/migrations/20260125_bingo_rooms_created_by.sql`
2. Reload PostgREST schema cache:
   - SQL Editor: `notify pgrst, 'reload schema';`
   - Or Dashboard: Settings → API → Reload
3. If you use generated types, re-run `supabase gen types` and restart the dev server.
