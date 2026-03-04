-- Ensure bingo_rooms has created_by column for ownership metadata
alter table if exists public.bingo_rooms
  add column if not exists created_by uuid null;
