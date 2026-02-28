-- surveys 컬럼명 변경 대응: is_anonymous 추가 및 데이터 이관

alter table public.surveys
  add column if not exists is_anonymous boolean not null default true;

do $$
begin
  if to_regclass('public.surveys') is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'surveys'
        and column_name = 'anonymous'
    ) then
      update public.surveys
      set is_anonymous = anonymous
      where is_anonymous is null;
    end if;
  end if;
end $$;

select pg_notify('pgrst', 'reload schema');
