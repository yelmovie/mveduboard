-- classes 테이블에 누락된 컬럼 일괄 추가 (Table Editor에 id, school_id만 있을 때 실행)
-- Supabase 대시보드 → SQL Editor → 새 쿼리 → 아래 전체 붙여넣기 → Run
-- 기존 행이 있어도 안전 (add column if not exists + default). 여러 번 실행 가능.

-- 1. classes 필수 컬럼 추가
alter table public.classes
  add column if not exists name text not null default '';

alter table public.classes
  add column if not exists join_code text;

alter table public.classes
  add column if not exists join_code_created_at timestamptz not null default now();

alter table public.classes
  add column if not exists max_students int not null default 30;

alter table public.classes
  add column if not exists created_at timestamptz not null default now();

alter table public.classes
  add column if not exists grade int not null default 1;

alter table public.classes
  add column if not exists class_no int not null default 1;

alter table public.classes
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- join_code가 비어 있는 기존 행에 고유값 채우기 (한 번만)
update public.classes
set join_code = upper(substring(md5(id::text) from 1 for 8))
where join_code is null or join_code = '';

-- unique 제약 (이미 있으면 제거 후 재생성)
alter table public.classes drop constraint if exists classes_join_code_key;
alter table public.classes add constraint classes_join_code_key unique (join_code);

-- 2. schools 컬럼 (없을 때만 추가)
alter table public.schools add column if not exists name text not null default '미정';
alter table public.schools add column if not exists created_at timestamptz not null default now();

-- 3. profiles 컬럼 (없을 때만 추가)
alter table public.profiles add column if not exists school_id uuid references public.schools(id) on delete set null;
alter table public.profiles add column if not exists class_id uuid references public.classes(id) on delete set null;
alter table public.profiles add column if not exists display_name text not null default '사용자';

-- 4. RLS 정책 (032와 동일, 있으면 덮어씀)
alter table public.profiles enable row level security;
drop policy if exists "profiles_owner_update" on public.profiles;
create policy "profiles_owner_update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

alter table public.schools enable row level security;
drop policy if exists "schools_authenticated_update" on public.schools;
create policy "schools_authenticated_update" on public.schools for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table public.classes enable row level security;
drop policy if exists "classes_teacher_update_own" on public.classes;
create policy "classes_teacher_update_own" on public.classes for update using (created_by = auth.uid()) with check (created_by = auth.uid());

drop policy if exists "classes_teacher_select_own" on public.classes;
create policy "classes_teacher_select_own" on public.classes for select using (
  created_by = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher' and p.school_id = classes.school_id)
);

notify pgrst, 'reload schema';
