-- surveys 누락 컬럼 보강 (anonymous 등)

alter table public.surveys
  add column if not exists anonymous boolean not null default true,
  add column if not exists one_response_per_user boolean not null default true,
  add column if not exists results_visible_to_students boolean not null default false;

select pg_notify('pgrst', 'reload schema');
