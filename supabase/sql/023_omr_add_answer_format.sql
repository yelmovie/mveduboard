-- omr_assignments 누락 컬럼 보강 (answer_format)

alter table public.omr_assignments
  add column if not exists answer_format text not null default '1-5'
  check (answer_format in ('1-5','A-E'));

select pg_notify('pgrst', 'reload schema');
