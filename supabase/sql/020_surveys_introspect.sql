-- surveys 컬럼 목록 조회

select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'surveys'
order by ordinal_position;
