-- omr_assignments 누락 컬럼 보강 (description)

alter table public.omr_assignments
  add column if not exists description text;

select pg_notify('pgrst', 'reload schema');
