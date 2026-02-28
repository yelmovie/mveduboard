import { supabase } from './client';
import {
  BINGO_ROOM_TABLES,
  BINGO_ROOM_CHANNEL_PREFIX,
  BINGO_ROOM_STATUS,
  BINGO_ROOM_ROLE,
} from '../../config/bingoRoom';
import { generateRoomCode } from '../../utils/bingo';

export type BingoRoomStatus = typeof BINGO_ROOM_STATUS[keyof typeof BINGO_ROOM_STATUS];
export type BingoRoomRole = typeof BINGO_ROOM_ROLE[keyof typeof BINGO_ROOM_ROLE];

export type BingoRoomRecord = {
  id: string;
  code: string;
  title: string;
  host_user_id: string | null;
  size: number;
  words: string[];
  status: BingoRoomStatus;
  revealed_student_id: string | null;
  created_at: string;
};

export type BingoPlayerRecord = {
  id: string;
  room_id: string;
  display_name: string;
  role: BingoRoomRole;
  joined_at: string;
};

export type BingoBoardRecord = {
  id: string;
  room_id: string;
  player_id: string;
  layout: string[];
  marks: boolean[];
  bingo_lines: number;
  submitted: boolean;
  updated_at: string;
};

const ensureClient = () => {
  if (!supabase) {
    throw new Error('Supabase 설정이 필요합니다.');
  }
};

export const createRoom = async (payload: {
  title: string;
  size: number;
  words: string[];
  hostUserId?: string | null;
}) => {
  ensureClient();
  const maxRetry = 5;
  let lastError: Error | null = null;
  for (let i = 0; i < maxRetry; i += 1) {
    const code = generateRoomCode();
    const { data, error } = await supabase
      .from(BINGO_ROOM_TABLES.rooms)
      .insert({
        code,
        title: payload.title,
        host_user_id: payload.hostUserId ?? null,
        size: payload.size,
        words: payload.words,
        status: BINGO_ROOM_STATUS.draft,
        revealed_student_id: null,
      })
      .select('*')
      .maybeSingle();
    if (!error && data) return data as BingoRoomRecord;
    lastError = new Error(error?.message || '방 생성에 실패했습니다.');
  }
  throw lastError || new Error('방 생성에 실패했습니다.');
};

export const getRoomByCode = async (code: string) => {
  ensureClient();
  const { data, error } = await supabase
    .from(BINGO_ROOM_TABLES.rooms)
    .select('*')
    .eq('code', code)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as BingoRoomRecord | null;
};

export const getRoomById = async (roomId: string) => {
  ensureClient();
  const { data, error } = await supabase
    .from(BINGO_ROOM_TABLES.rooms)
    .select('*')
    .eq('id', roomId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as BingoRoomRecord | null;
};

export const updateRoomStatus = async (roomId: string, status: BingoRoomStatus) => {
  ensureClient();
  const { error } = await supabase
    .from(BINGO_ROOM_TABLES.rooms)
    .update({ status })
    .eq('id', roomId);
  if (error) throw new Error(error.message);
};

export const setRevealedStudent = async (roomId: string, playerId: string | null) => {
  ensureClient();
  const { error } = await supabase
    .from(BINGO_ROOM_TABLES.rooms)
    .update({ revealed_student_id: playerId })
    .eq('id', roomId);
  if (error) throw new Error(error.message);
};

export const joinRoom = async (payload: {
  roomId: string;
  displayName: string;
  role: BingoRoomRole;
}) => {
  ensureClient();
  const { data, error } = await supabase
    .from(BINGO_ROOM_TABLES.players)
    .insert({
      room_id: payload.roomId,
      display_name: payload.displayName,
      role: payload.role,
    })
    .select('*')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as BingoPlayerRecord;
};

export const getPlayers = async (roomId: string) => {
  ensureClient();
  const { data, error } = await supabase
    .from(BINGO_ROOM_TABLES.players)
    .select('*')
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as BingoPlayerRecord[];
};

export const upsertBoard = async (payload: {
  roomId: string;
  playerId: string;
  layout: string[];
  marks: boolean[];
  bingoLines: number;
  submitted: boolean;
}) => {
  ensureClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from(BINGO_ROOM_TABLES.boards)
    .upsert({
      room_id: payload.roomId,
      player_id: payload.playerId,
      layout: payload.layout,
      marks: payload.marks,
      bingo_lines: payload.bingoLines,
      submitted: payload.submitted,
      updated_at: now,
    }, { onConflict: 'room_id,player_id' })
    .select('*')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as BingoBoardRecord;
};

export const getBoard = async (roomId: string, playerId: string) => {
  ensureClient();
  const { data, error } = await supabase
    .from(BINGO_ROOM_TABLES.boards)
    .select('*')
    .eq('room_id', roomId)
    .eq('player_id', playerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as BingoBoardRecord | null;
};

export const getBoards = async (roomId: string) => {
  ensureClient();
  const { data, error } = await supabase
    .from(BINGO_ROOM_TABLES.boards)
    .select('*')
    .eq('room_id', roomId);
  if (error) throw new Error(error.message);
  return (data || []) as BingoBoardRecord[];
};

export const subscribeRoom = (roomId: string, onChange: () => void) => {
  ensureClient();
  const channel = supabase.channel(`${BINGO_ROOM_CHANNEL_PREFIX}:${roomId}`);
  channel
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: BINGO_ROOM_TABLES.rooms, filter: `id=eq.${roomId}` },
      onChange
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: BINGO_ROOM_TABLES.players, filter: `room_id=eq.${roomId}` },
      onChange
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: BINGO_ROOM_TABLES.boards, filter: `room_id=eq.${roomId}` },
      onChange
    );
  channel.subscribe();
  return () => {
    channel.unsubscribe();
  };
};
