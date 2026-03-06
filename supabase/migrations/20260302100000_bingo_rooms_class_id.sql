-- 학급 단위 빙고 참가: bingo_rooms에 class_id 추가
alter table if exists public.bingo_rooms
  add column if not exists class_id uuid null;

comment on column public.bingo_rooms.class_id is '학급 ID - 해당 학급 구성원이 코드 없이 참가할 때 사용';

create index if not exists idx_bingo_rooms_class_id on public.bingo_rooms (class_id);
create index if not exists idx_bingo_rooms_class_status_created
  on public.bingo_rooms (class_id, status, created_at desc);
