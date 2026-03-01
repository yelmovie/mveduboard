-- 학급 정보 생성용: classes 컬럼 추가 + profiles/schools/classes UPDATE 정책
-- SQL Editor에서 001_init, 002_rls, 006_fix_signup_rls 실행 후 실행하세요. (idempotent)

-- 1) classes 테이블에 컬럼 추가 (앱에서 사용)
alter table public.classes
  add column if not exists grade int not null default 1;

alter table public.classes
  add column if not exists class_no int not null default 1;

-- created_by: 기존 행이 있으면 null 허용, 새 행은 앱에서 항상 넣음
alter table public.classes
  add column if not exists created_by uuid references auth.users(id) on delete cascade;

-- 2) profiles: 본인 프로필 수정 허용 (나의 정보 수정)
alter table public.profiles enable row level security;

drop policy if exists "profiles_owner_update" on public.profiles;
create policy "profiles_owner_update"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 3) schools: 인증된 사용자 학교명 수정 (나의 정보 수정)
alter table public.schools enable row level security;

drop policy if exists "schools_authenticated_update" on public.schools;
create policy "schools_authenticated_update"
  on public.schools
  for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 4) classes: 생성자만 수정 (입장 코드 재발급, 학급명 수정)
alter table public.classes enable row level security;

drop policy if exists "classes_teacher_update_own" on public.classes;
create policy "classes_teacher_update_own"
  on public.classes
  for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- 5) classes SELECT: created_by로 본인 학급 조회 허용 (008과 동일, 기존 행 created_by null이면 다른 정책으로만 조회)
drop policy if exists "classes_teacher_select_own" on public.classes;
create policy "classes_teacher_select_own"
  on public.classes
  for select
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and p.role = 'teacher'
      and p.school_id = classes.school_id
    )
  );

-- 스키마 갱신 (PostgREST가 새 컬럼/정책 인식)
notify pgrst, 'reload schema';
