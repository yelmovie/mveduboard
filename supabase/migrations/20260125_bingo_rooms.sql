-- Bingo Realtime Rooms
create table if not exists public.bingo_rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text not null,
  host_user_id uuid null,
  size int not null,
  words jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  revealed_student_id uuid null,
  created_at timestamptz not null default now()
);

create table if not exists public.bingo_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.bingo_rooms(id) on delete cascade,
  display_name text not null,
  role text not null default 'student',
  joined_at timestamptz not null default now()
);

create unique index if not exists bingo_players_room_name_unique
  on public.bingo_players (room_id, display_name);

create table if not exists public.bingo_boards (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.bingo_rooms(id) on delete cascade,
  player_id uuid not null,
  layout jsonb not null default '[]'::jsonb,
  marks jsonb not null default '[]'::jsonb,
  bingo_lines int not null default 0,
  submitted boolean not null default false,
  updated_at timestamptz not null default now()
);

create unique index if not exists bingo_boards_room_player_unique
  on public.bingo_boards (room_id, player_id);

alter table public.bingo_rooms enable row level security;
alter table public.bingo_players enable row level security;
alter table public.bingo_boards enable row level security;

-- NOTE: 아래 정책은 MVP용 초안입니다. 운영 환경에서는 반드시 강화하세요.
create policy "bingo rooms read" on public.bingo_rooms
  for select using (true);

create policy "bingo rooms write" on public.bingo_rooms
  for insert with check (true);

create policy "bingo rooms update" on public.bingo_rooms
  for update using (true);

create policy "bingo players read" on public.bingo_players
  for select using (true);

create policy "bingo players write" on public.bingo_players
  for insert with check (true);

create policy "bingo boards read" on public.bingo_boards
  for select using (true);

create policy "bingo boards write" on public.bingo_boards
  for insert with check (true);

create policy "bingo boards update" on public.bingo_boards
  for update using (true);
