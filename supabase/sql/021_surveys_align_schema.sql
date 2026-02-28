-- surveys 스키마 정합성 보강 (코드 기준)
-- 실행 후: select pg_notify('pgrst', 'reload schema');

alter table public.surveys
  add column if not exists class_id uuid,
  add column if not exists created_by uuid,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists status text not null default 'draft',
  add column if not exists start_at timestamptz,
  add column if not exists end_at timestamptz,
  add column if not exists is_anonymous boolean not null default true,
  add column if not exists one_response_per_user boolean not null default true,
  add column if not exists results_visible_to_students boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if to_regclass('public.classes') is not null then
    alter table public.surveys
      add constraint surveys_class_id_fkey
      foreign key (class_id) references public.classes(id)
      on delete cascade;
  end if;
exception
  when duplicate_object then
    null;
end $$;

do $$
begin
  if to_regclass('auth.users') is not null then
    alter table public.surveys
      add constraint surveys_created_by_fkey
      foreign key (created_by) references auth.users(id)
      on delete cascade;
  end if;
exception
  when duplicate_object then
    null;
end $$;

select pg_notify('pgrst', 'reload schema');
