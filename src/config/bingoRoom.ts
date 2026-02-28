export const BINGO_ROOM_TABLES = {
  rooms: 'bingo_rooms',
  players: 'bingo_players',
  boards: 'bingo_boards',
} as const;

export const BINGO_ROOM_CHANNEL_PREFIX = 'room';

export const BINGO_ROOM_CODE_LENGTH = 6;
export const BINGO_ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const BINGO_ROOM_STATUS = {
  draft: 'draft',
  open: 'open',
  running: 'running',
  ended: 'ended',
} as const;

export const BINGO_ROOM_ROLE = {
  host: 'host',
  student: 'student',
} as const;

export const BINGO_LS_KEYS = {
  roomId: 'edu_bingo_room_id',
  roomCode: 'edu_bingo_room_code',
  playerId: 'edu_bingo_player_id',
} as const;
