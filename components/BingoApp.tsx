
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Home, Grid, Play, Pause, RotateCcw, Plus, Check, Lock, Unlock, Trophy, User, Download, Info, Users, Monitor, Hash, Type, Sparkles, Star, UserX, Settings, Copy } from 'lucide-react';
import * as bingoService from '../services/bingoService';
import * as studentService from '../services/studentService';
import { BingoGame, BingoPlayer, BingoSize, Participant, BingoCell, BingoRoom, BingoRoomPlayer, BingoRoomBoard } from '../types';
import html2canvas from 'html2canvas';
import { supabase } from '../src/lib/supabase/client';
import * as bingoRealtime from '../src/lib/supabase/bingo';
import { applyMarkToggle, computeBingoLines, computeCompletedLines } from '../src/utils/bingo';
import { BINGO_LS_KEYS, BINGO_ROOM_ROLE, BINGO_ROOM_STATUS } from '../src/config/bingoRoom';

// Shared Wrapper for 3D Mystical Theme
// Uses min-h-[calc(100vh-6rem)] to force full visible height in ToolsApp and center content properly
const MysticalWrapper: React.FC<{children: React.ReactNode}> = ({children}) => (
    <div className="min-h-[calc(100vh-6rem)] bg-slate-900 flex flex-col font-sans relative overflow-hidden text-white">
        {/* Background FX */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900 via-slate-950 to-black opacity-80 pointer-events-none"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 animate-pulse pointer-events-none"></div>
        
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full p-4">
            {children}
        </div>
    </div>
);

interface BingoAppProps {
  onBack: () => void;
  isTeacherMode: boolean;
  student: Participant | null;
  onLoginRequest: () => void;
}

type AppMode = 'lobby' | 'class_game' | 'teacher_setup' | 'local_setup' | 'local_game';
type BingoType = 'word' | 'number';

type BingoForm = {
  mode: BingoType;
  size: BingoSize;
  title: string;
  topic: string;
  wordsText: string;
  aiCount: number;
};

export const BingoApp: React.FC<BingoAppProps> = ({ onBack, isTeacherMode, student, onLoginRequest }) => {
  const [mode, setMode] = useState<AppMode>('lobby');
  
  // Shared Game State
  const [classGame, setClassGame] = useState<BingoGame | null>(null);
  const [myClassPlayer, setMyClassPlayer] = useState<BingoPlayer | null>(null);
  const [allClassPlayers, setAllClassPlayers] = useState<BingoPlayer[]>([]);
  
  // Local/Teacher Create State
  const [form, setForm] = useState<BingoForm>({
    mode: 'word',
    size: 3,
    title: '',
    topic: '',
    wordsText: '',
    aiCount: 9,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  
  // Local Game State (Student Solo/Peer)
  const [localGame, setLocalGame] = useState<{title: string, size: BingoSize, cells: BingoCell[], bingoCount: number} | null>(null);

  // Realtime Room State (Supabase)
  const [room, setRoom] = useState<BingoRoom | null>(null);
  const [roomPlayers, setRoomPlayers] = useState<BingoRoomPlayer[]>([]);
  const [roomBoards, setRoomBoards] = useState<BingoRoomBoard[]>([]);
  const [myRoomPlayer, setMyRoomPlayer] = useState<BingoRoomPlayer | null>(null);
  const [myBoard, setMyBoard] = useState<BingoRoomBoard | null>(null);
  const [revealedBoard, setRevealedBoard] = useState<BingoRoomBoard | null>(null);
  const [revealLines, setRevealLines] = useState<ReturnType<typeof computeCompletedLines>>([]);
  const [myLines, setMyLines] = useState<ReturnType<typeof computeCompletedLines>>([]);
  const [joinCode, setJoinCode] = useState('');
  const [displayName, setDisplayName] = useState(student?.nickname || '');
  const [joinError, setJoinError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [studentView, setStudentView] = useState<'public' | 'my'>('public');
  const [layoutDraft, setLayoutDraft] = useState<string[]>([]);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [isSubmittingLayout, setIsSubmittingLayout] = useState(false);

  // Animation State
  const [showBingoEffect, setShowBingoEffect] = useState(false);
  const [showWinModal, setShowWinModal] = useState(false); // 3 Bingo Win Modal
  const bingoBoardRef = useRef<HTMLDivElement>(null);

  const topRanks = useMemo(() => {
      if (!allClassPlayers || allClassPlayers.length === 0) return [];
      return allClassPlayers
          .filter((p) => p.bingoCount >= 3 && typeof p.lastBingoTime === 'number')
          .sort((a, b) => (a.lastBingoTime || 0) - (b.lastBingoTime || 0))
          .slice(0, 3);
  }, [allClassPlayers]);

  const parsedWordInput = useMemo(() => {
      return form.wordsText.split('\n').map((w) => w.trim()).filter((w) => w !== '');
  }, [form.wordsText]);

  const wordInputCount = parsedWordInput.length;
  const isSupabaseEnabled = Boolean(supabase);
  useEffect(() => {
    setForm((prev) => ({ ...prev, aiCount: prev.size * prev.size }));
  }, [form.size]);

  useEffect(() => {
    if (student?.nickname) {
      setDisplayName(student.nickname);
    }
  }, [student?.nickname]);

  // Preload roster from DB
  useEffect(() => {
    if (isTeacherMode) {
      studentService.fetchRosterFromDb().catch(() => {});
    }
  }, [isTeacherMode]);

  // Init
  useEffect(() => {
      if (isTeacherMode) {
          if (isSupabaseEnabled) {
              const savedRoomId = localStorage.getItem(BINGO_LS_KEYS.roomId);
              const savedPlayerId = localStorage.getItem(BINGO_LS_KEYS.playerId);
              if (savedRoomId) {
                  bingoRealtime.getRoomById(savedRoomId)
                    .then((data) => {
                      if (data) {
                        setRoom(data);
                        setMode('class_game');
                      }
                    })
                    .catch(() => {
                      localStorage.removeItem(BINGO_LS_KEYS.roomId);
                      localStorage.removeItem(BINGO_LS_KEYS.playerId);
                    });
              } else {
                  setMode('class_game');
              }
              if (savedPlayerId) {
                // player reload handled after room load
              }
          } else {
              const g = bingoService.getGame();
              if (g) {
                  setMode('class_game');
                  setClassGame(g);
              } else {
                  setMode('class_game'); 
              }
          }
      } else {
          setMode('lobby');
      }
  }, [isTeacherMode]);

  // Sync Interval for Class Game
  useEffect(() => {
    if (isSupabaseEnabled) return;
    const shouldSync =
      (!isTeacherMode && mode === 'lobby') ||
      (mode === 'class_game' && (!isTeacherMode || Boolean(classGame)));

    if (!shouldSync) return;

    loadClassData();
    const interval = setInterval(loadClassData, 1000);
    return () => clearInterval(interval);
  }, [mode, isTeacherMode, student, classGame]);

  const loadClassData = () => {
    const g = bingoService.getGame();
    setClassGame(g);
    setAllClassPlayers(bingoService.getPlayers());
  };

  const loadRoomData = async (roomId: string, playerId?: string | null) => {
    if (!isSupabaseEnabled) return;
    try {
      const [roomData, players, boards] = await Promise.all([
        bingoRealtime.getRoomById(roomId),
        bingoRealtime.getPlayers(roomId),
        bingoRealtime.getBoards(roomId),
      ]);
      if (!roomData) {
        throw new Error('방 정보를 찾을 수 없습니다.');
      }
      setRoom(roomData);
      setRoomPlayers(players);
      setRoomBoards(boards);

      const targetPlayerId = playerId || myRoomPlayer?.id || null;
      if (targetPlayerId) {
        const myBoardData = boards.find((b) => b.player_id === targetPlayerId) || null;
        setMyBoard(myBoardData);
        if (myBoardData?.marks?.length && roomData) {
          setMyLines(computeCompletedLines(roomData.size, myBoardData.marks));
        } else {
          setMyLines([]);
        }
        if (myBoardData?.submitted) {
          setStudentView((prev) => prev || 'public');
        }
      }

      if (roomData.revealed_student_id) {
        const reveal = boards.find((b) => b.player_id === roomData.revealed_student_id) || null;
        setRevealedBoard(reveal);
        if (reveal?.marks?.length) {
          setRevealLines(computeCompletedLines(roomData.size, reveal.marks));
        } else {
          setRevealLines([]);
        }
      } else {
        setRevealedBoard(null);
        setRevealLines([]);
      }
    } catch (e: any) {
      console.error('[bingo] loadRoomData error', e);
    }
  };

  useEffect(() => {
    if (!isSupabaseEnabled || !room?.id) return;
    const unsubscribe = bingoRealtime.subscribeRoom(room.id, () => {
      loadRoomData(room.id);
    });
    loadRoomData(room.id);
    return () => {
      unsubscribe();
    };
  }, [isSupabaseEnabled, room?.id]);

  useEffect(() => {
    if (!isSupabaseEnabled || !room?.id || roomPlayers.length === 0) return;
    const savedPlayerId = localStorage.getItem(BINGO_LS_KEYS.playerId);
    const matched = savedPlayerId
      ? roomPlayers.find((p) => p.id === savedPlayerId)
      : roomPlayers.find((p) => p.display_name === displayName);
    if (matched) {
      setMyRoomPlayer(matched);
      loadRoomData(room.id, matched.id);
    }
  }, [isSupabaseEnabled, room?.id, roomPlayers, displayName]);

  // --- Handlers: Teacher Class Game ---

  const handleCreateClassGame = () => {
    if (!form.title.trim()) {
        alert('빙고 제목을 입력해주세요.');
        return;
    }
    if (classGame && !confirm('새 게임을 만들면 기존 게임이 종료됩니다. 계속할까요?')) {
        return;
    }
    
    let words: string[] = [];
    if (form.mode === 'number') {
        const count = form.size * form.size;
        words = Array.from({length: count}, (_, i) => (i + 1).toString());
    } else {
        words = form.wordsText.split('\n').map((w) => w.trim()).filter(Boolean);
        words = Array.from(new Set(words));
        if (words.length < form.size * form.size) {
            alert(`단어가 부족합니다! 최소 ${form.size*form.size}개의 단어가 필요합니다.\n현재: ${words.length}개`);
            return;
        }
    }

    if (isSupabaseEnabled) {
      const hostName = displayName.trim() || '선생님';
      setJoinError('');
      bingoRealtime.createRoom({
        title: form.title.trim(),
        size: form.size,
        words,
        hostUserId: null,
      })
        .then(async (newRoom) => {
          setRoom(newRoom);
          localStorage.setItem(BINGO_LS_KEYS.roomId, newRoom.id);
          localStorage.setItem(BINGO_LS_KEYS.roomCode, newRoom.code);
          const hostPlayer = await bingoRealtime.joinRoom({
            roomId: newRoom.id,
            displayName: hostName,
            role: BINGO_ROOM_ROLE.host,
          });
          setMyRoomPlayer(hostPlayer);
          localStorage.setItem(BINGO_LS_KEYS.playerId, hostPlayer.id);
          await loadRoomData(newRoom.id, hostPlayer.id);
          setMode('class_game');
          setForm((prev) => ({
            ...prev,
            title: '',
            topic: '',
            wordsText: '',
          }));
        })
        .catch((e: any) => {
          console.error('[bingo] createRoom error', e);
          alert(e?.message || '방 생성에 실패했습니다.');
        });
      return;
    }

    bingoService.createGame(form.title.trim(), form.size, words);
    setForm((prev) => ({
      ...prev,
      title: '',
      topic: '',
      wordsText: '',
    }));
    loadClassData();
    setMode('class_game');
  };

  const handleClassStatusChange = (status: BingoGame['status']) => {
    if (isSupabaseEnabled) {
      if (!room) return;
      const nextStatus =
        status === 'ended' ? BINGO_ROOM_STATUS.ended : BINGO_ROOM_STATUS.open;
      bingoRealtime.updateRoomStatus(room.id, nextStatus).catch((e) => {
        console.error('[bingo] updateRoomStatus error', e);
        alert('상태 변경에 실패했습니다.');
      });
      return;
    }
    if(!classGame) return;
    bingoService.updateGameStatus(status, classGame.isLocked);
    loadClassData();
  };

  const handleClassLockToggle = () => {
    if (isSupabaseEnabled) {
      if (!room) return;
      const next = room.status === BINGO_ROOM_STATUS.open ? BINGO_ROOM_STATUS.draft : BINGO_ROOM_STATUS.open;
      bingoRealtime.updateRoomStatus(room.id, next).catch((e) => {
        console.error('[bingo] updateRoomStatus error', e);
        alert('허용 상태 변경에 실패했습니다.');
      });
      return;
    }
    if(!classGame) return;
    bingoService.updateGameStatus(classGame.status, !classGame.isLocked);
    loadClassData();
  };

  const handleClassReset = () => {
    if(confirm('진행 중인 게임을 종료하고 모두 지우시겠습니까?')) {
        if (isSupabaseEnabled && room?.id) {
          bingoRealtime.updateRoomStatus(room.id, BINGO_ROOM_STATUS.ended)
            .catch((e) => console.error('[bingo] end room error', e))
            .finally(() => {
              setRoom(null);
              setRoomPlayers([]);
              setRoomBoards([]);
              setMyRoomPlayer(null);
              setMyBoard(null);
              setRevealedBoard(null);
              localStorage.removeItem(BINGO_LS_KEYS.roomId);
              localStorage.removeItem(BINGO_LS_KEYS.roomCode);
              localStorage.removeItem(BINGO_LS_KEYS.playerId);
            });
          return;
        }
        bingoService.resetGame();
        setClassGame(null);
        setAllClassPlayers([]);
        setMyClassPlayer(null);
    }
  };

  // --- Handlers: Student Navigation ---

  const handleJoinClassGame = () => {
      if (isSupabaseEnabled) {
          handleJoinRoomByCode();
          return;
      }
      if (!student) {
          onLoginRequest();
          return;
      }
      if (!classGame) return;
      
      const p = bingoService.joinGame(student.id, student.nickname);
      setMyClassPlayer(p);
      setMode('class_game');
  };

  const handleJoinRoomByCode = async () => {
      if (!isSupabaseEnabled) return;
      const code = joinCode.trim().toUpperCase();
      const name = displayName.trim();
      if (!code) {
          setJoinError('참여 코드를 입력해주세요.');
          return;
      }
      if (!name) {
          setJoinError('이름(닉네임)을 입력해주세요.');
          return;
      }
      setJoinError('');
      setIsJoining(true);
      try {
          const foundRoom = await bingoRealtime.getRoomByCode(code);
          if (!foundRoom) {
              setJoinError('방을 찾을 수 없습니다. 코드를 확인해주세요.');
              return;
          }
          if (foundRoom.status !== BINGO_ROOM_STATUS.open && foundRoom.status !== BINGO_ROOM_STATUS.running) {
              setJoinError('참가가 아직 허용되지 않았습니다.');
              return;
          }
          if (foundRoom.status === BINGO_ROOM_STATUS.ended) {
              setJoinError('종료된 방입니다.');
              return;
          }
          const existing = await bingoRealtime.getPlayers(foundRoom.id);
          if (existing.some((p) => p.display_name === name)) {
              setJoinError('이미 사용 중인 이름입니다.');
              return;
          }

          setRoom(foundRoom);
          localStorage.setItem(BINGO_LS_KEYS.roomId, foundRoom.id);
          localStorage.setItem(BINGO_LS_KEYS.roomCode, foundRoom.code);
          const player = await bingoRealtime.joinRoom({
              roomId: foundRoom.id,
              displayName: name,
              role: BINGO_ROOM_ROLE.student,
          });
          setMyRoomPlayer(player);
          localStorage.setItem(BINGO_LS_KEYS.playerId, player.id);
          const draft = Array.from({ length: foundRoom.size * foundRoom.size }, () => '');
          setLayoutDraft(draft);
          await bingoRealtime.upsertBoard({
            roomId: foundRoom.id,
            playerId: player.id,
            layout: draft,
            marks: Array.from({ length: foundRoom.size * foundRoom.size }, () => false),
            bingoLines: 0,
            submitted: false,
          });
          await loadRoomData(foundRoom.id, player.id);
          setMode('class_game');
      } catch (e: any) {
          console.error('[bingo] joinRoom error', e);
          if (String(e?.message || '').toLowerCase().includes('duplicate')) {
            setJoinError('이미 사용 중인 이름입니다.');
          } else {
            setJoinError(e?.message || '참가에 실패했습니다.');
          }
      } finally {
          setIsJoining(false);
      }
  };

  const handleSelectWord = (word: string) => {
      setSelectedWord(word);
  };

  const handlePlaceWord = (index: number) => {
      const boardSize = room?.size || 3;
      const count = boardSize * boardSize;
      if (layoutDraft.length !== count) {
          setLayoutDraft(Array.from({ length: count }, () => ''));
          return;
      }
      if (!selectedWord) {
          const next = [...layoutDraft];
          next[index] = '';
          setLayoutDraft(next);
          return;
      }
      const next = [...layoutDraft];
      next[index] = selectedWord;
      setLayoutDraft(next);
      setSelectedWord(null);
  };

  const handleSubmitLayout = async () => {
      if (!room || !myRoomPlayer) return;
      const size = room.size;
      const count = size * size;
      if (layoutDraft.length !== count) {
          alert('배치를 다시 확인해주세요.');
          return;
      }
      const missing = layoutDraft.some((w) => !w);
      if (missing) {
          alert('모든 칸을 채워주세요.');
          return;
      }
      setIsSubmittingLayout(true);
      try {
          const marks = Array.from({ length: count }, () => false);
          const board = await bingoRealtime.upsertBoard({
              roomId: room.id,
              playerId: myRoomPlayer.id,
              layout: layoutDraft,
              marks,
              bingoLines: 0,
              submitted: true,
          });
          setMyBoard(board);
          setMyLines([]);
          setStudentView('public');
      } catch (e: any) {
          console.error('[bingo] submit layout error', e);
          alert(e?.message || '배치 저장에 실패했습니다.');
      } finally {
          setIsSubmittingLayout(false);
      }
  };

  const handleToggleMark = async (index: number, targetBoard: BingoRoomBoard | null) => {
      if (!room || !targetBoard) return;
      const nextMarks = applyMarkToggle(targetBoard.marks, index);
      const lines = computeBingoLines(room.size, nextMarks);
      try {
          const updated = await bingoRealtime.upsertBoard({
              roomId: room.id,
              playerId: targetBoard.player_id,
              layout: targetBoard.layout,
              marks: nextMarks,
              bingoLines: lines,
              submitted: true,
          });
          if (targetBoard.player_id === myRoomPlayer?.id) {
              setMyBoard(updated);
              setMyLines(computeCompletedLines(room.size, updated.marks));
          }
          if (room.revealed_student_id === targetBoard.player_id) {
              setRevealedBoard(updated);
              setRevealLines(computeCompletedLines(room.size, updated.marks));
          }
      } catch (e: any) {
          console.error('[bingo] toggle mark error', e);
          alert(e?.message || '체크 반영에 실패했습니다.');
      }
  };

  const handleRevealPlayer = async (playerId: string) => {
      if (!room) return;
      try {
          await bingoRealtime.setRevealedStudent(room.id, playerId);
      } catch (e: any) {
          console.error('[bingo] reveal player error', e);
          alert('학생 공개 전환에 실패했습니다.');
      }
  };

  const handleStartLocalSetup = () => {
      setMode('local_setup');
      setForm((prev) => ({
        ...prev,
        title: '우리끼리 빙고',
        size: 3,
        mode: 'number',
        topic: '',
        wordsText: '',
      }));
  };

  const handleOpenTeacherSetup = () => {
      if (isSupabaseEnabled && room) {
          setForm((prev) => ({
            ...prev,
            title: room.title || '학급 빙고',
            size: room.size || 3,
            mode: 'word',
            wordsText: room.words?.join('\n') || '',
          }));
      } else if (classGame) {
          setForm((prev) => ({
            ...prev,
            title: classGame.title || '학급 빙고',
            size: classGame.size || 3,
            mode: 'word',
            wordsText: classGame.words?.join('\n') || '',
          }));
      } else {
          setForm((prev) => ({
            ...prev,
            title: '학급 빙고',
            size: 3,
            mode: 'word',
            wordsText: '',
          }));
      }
      setForm((prev) => ({ ...prev, topic: '' }));
      setAiError('');
      setMode('teacher_setup');
  };

  const handleStartLocalGame = () => {
      let words: string[] = [];
      const count = form.size * form.size;

      if (form.mode === 'number') {
          words = Array.from({length: count}, (_, i) => (i + 1).toString());
      } else {
          words = form.wordsText.split('\n').map((w) => w.trim()).filter(Boolean);
          if (words.length < count) {
              alert(`단어가 부족합니다! 최소 ${count}개의 단어가 필요합니다.`);
              return;
          }
      }

      const shuffled = [...words].sort(() => Math.random() - 0.5).slice(0, count);
      const cells: BingoCell[] = shuffled.map((w, i) => ({ index: i, text: w, isMarked: false }));

      setLocalGame({
          title: form.title,
          size: form.size,
          cells,
          bingoCount: 0
      });
      setMode('local_game');
  };

  const handleGenerateWords = async () => {
      if (!form.topic.trim()) {
          setAiError('주제를 입력해주세요.');
          return;
      }
      setIsGenerating(true);
      setAiError('');
      try {
          const count = form.aiCount;
          const pairs = await bingoService.generateWordPairsWithAI(form.topic, count);
          if (pairs.length === 0) {
              setAiError('단어 생성에 실패했습니다. 다른 주제로 시도해주세요.');
              return;
          }
          setForm((prev) => ({
            ...prev,
            wordsText: pairs.map((item) => item.word).join('\n'),
          }));
      } finally {
          setIsGenerating(false);
      }
  };

  // --- Handlers: Gameplay (Marking) ---

  const handleCellClick = (index: number) => {
      if (mode === 'class_game') {
          if (isSupabaseEnabled) {
              if (isTeacherMode) {
                  if (!revealedBoard) return;
                  handleToggleMark(index, revealedBoard);
                  return;
              }
              if (studentView !== 'my') return;
              if (!myBoard) return;
              handleToggleMark(index, myBoard);
              return;
          }
          if (!student || !classGame || !myClassPlayer) return;
          if (classGame.status === 'preparing') { alert('선생님이 게임을 시작하기 전입니다.'); return; }
          if (classGame.isLocked) { alert('잠금 상태입니다.'); return; }

          const updated = bingoService.toggleCell(student.id, index);
          if (updated) {
              if (updated.bingoCount > myClassPlayer.bingoCount) {
                  triggerBingoEffect();
                  if (updated.bingoCount >= 3 && myClassPlayer.bingoCount < 3) {
                      setShowWinModal(true);
                  }
              }
              setMyClassPlayer(updated);
          }
      } else if (mode === 'local_game' && localGame) {
          const newCells = [...localGame.cells];
          newCells[index] = { ...newCells[index], isMarked: !newCells[index].isMarked };
          
          const bingoCount = calculateBingoCount(newCells, localGame.size);
          if (bingoCount > localGame.bingoCount) {
              triggerBingoEffect();
              if (bingoCount >= 3 && localGame.bingoCount < 3) {
                  setShowWinModal(true);
              }
          }
          
          setLocalGame({ ...localGame, cells: newCells, bingoCount });
      }
  };

  const calculateBingoCount = (cells: BingoCell[], size: number): number => {
    let count = 0;
    // Rows
    for (let r = 0; r < size; r++) {
        let isLine = true;
        for (let c = 0; c < size; c++) {
            if (!cells[r * size + c].isMarked) { isLine = false; break; }
        }
        if (isLine) count++;
    }
    // Cols
    for (let c = 0; c < size; c++) {
        let isLine = true;
        for (let r = 0; r < size; r++) {
            if (!cells[r * size + c].isMarked) { isLine = false; break; }
        }
        if (isLine) count++;
    }
    // Diagonals
    let isD1 = true;
    for (let i = 0; i < size; i++) {
        if (!cells[i * size + i].isMarked) { isD1 = false; break; }
    }
    if (isD1) count++;
    let isD2 = true;
    for (let i = 0; i < size; i++) {
        if (!cells[i * size + (size - 1 - i)].isMarked) { isD2 = false; break; }
    }
    if (isD2) count++;
    return count;
  }

  const triggerBingoEffect = () => {
      setShowBingoEffect(true);
      setTimeout(() => setShowBingoEffect(false), 2000);
  }

  const handleCaptureBoard = async () => {
      if (!bingoBoardRef.current) return;
      try {
          const canvas = await html2canvas(bingoBoardRef.current, { backgroundColor: '#0f172a' }); // Capture dark bg
          const link = document.createElement('a');
          link.download = `bingo_result.png`;
          link.href = canvas.toDataURL();
          link.click();
      } catch (e) {
          console.error(e);
          alert('이미지 저장에 실패했습니다.');
      }
  }

  const getGridClass = (size: number) => {
      if (size === 3) return 'grid-cols-3';
      if (size === 4) return 'grid-cols-4';
      if (size === 5) return 'grid-cols-5';
      if (size === 6) return 'grid-cols-6';
      if (size === 8) return 'grid-cols-8';
      return 'grid-cols-5';
  }

  // --- RENDER ---

  // 1. STUDENT LOBBY
  if (mode === 'lobby') {
      return (
          <MysticalWrapper>
              <div className="bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-3xl shadow-[0_0_30px_rgba(124,58,237,0.3)] w-full max-w-md text-center space-y-8 animate-fade-in-up">
                  <div className="bg-gradient-to-br from-violet-500 to-fuchsia-600 p-5 rounded-full w-24 h-24 flex items-center justify-center mx-auto shadow-lg mb-2">
                      <Grid size={48} className="text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-fuchsia-300 mb-2">신비한 빙고</h1>
                    <p className="text-indigo-200">마법 같은 빙고 게임에 오신 것을 환영합니다</p>
                  </div>
                  
                  <div className="space-y-4">
                      <div className="space-y-3">
                          <div className="flex flex-col gap-2 text-left">
                              <label className="text-sm text-indigo-200 font-semibold">참여 코드</label>
                              <input
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.currentTarget.value.toUpperCase())}
                                placeholder="예: A1B2C3"
                                className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-400 text-base"
                              />
                          </div>
                          <div className="flex flex-col gap-2 text-left">
                              <label className="text-sm text-indigo-200 font-semibold">이름(닉네임)</label>
                              <input
                                value={displayName}
                                onChange={(e) => setDisplayName(e.currentTarget.value)}
                                placeholder="이름을 입력하세요"
                                className="w-full px-4 py-3 rounded-xl bg-slate-900/60 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-violet-400 text-base"
                              />
                          </div>
                          {joinError && (
                              <div className="text-sm text-red-300">{joinError}</div>
                          )}
                          <button 
                            onClick={handleJoinClassGame}
                            disabled={isSupabaseEnabled ? isJoining : !classGame}
                            className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all border-b-4 active:border-b-0 active:translate-y-1
                                ${isSupabaseEnabled
                                    ? 'bg-violet-600 border-violet-800 text-white shadow-[0_0_20px_rgba(139,92,246,0.5)] hover:bg-violet-500'
                                    : classGame 
                                        ? 'bg-violet-600 border-violet-800 text-white shadow-[0_0_20px_rgba(139,92,246,0.5)] hover:bg-violet-500' 
                                        : 'bg-slate-700 border-slate-800 text-slate-400 cursor-not-allowed'}
                            `}
                          >
                              <Monitor size={24} />
                              {isSupabaseEnabled ? (isJoining ? '참가 중...' : '코드로 참가') : (classGame ? '선생님 게임 입장' : '선생님 게임 대기중...')}
                          </button>
                      </div>

                      <div className="flex items-center gap-2 text-indigo-300 text-sm">
                          <div className="h-px bg-white/20 flex-1"></div>
                          <span>OR</span>
                          <div className="h-px bg-white/20 flex-1"></div>
                      </div>

                      <button 
                        onClick={handleStartLocalSetup}
                        className="w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 bg-white/10 border border-white/20 border-b-4 border-b-white/10 text-white hover:bg-white/20 transition-all active:border-b-0 active:translate-y-1 backdrop-blur-sm"
                      >
                          <Users size={24} />
                          우리끼리 / 혼자 하기
                      </button>
                  </div>

                  <button onClick={onBack} className="text-slate-400 hover:text-white underline text-sm">나가기</button>
              </div>
          </MysticalWrapper>
      );
  }

  // 2. SETUP
  const shouldOpenTeacherSetup =
    mode === 'local_setup' ||
    mode === 'teacher_setup' ||
    (isTeacherMode && mode === 'class_game' && ((isSupabaseEnabled && !room) || (!isSupabaseEnabled && !classGame)));

  if (shouldOpenTeacherSetup) {
      const isLocal = mode === 'local_setup';
      return (
          <MysticalWrapper>
              <div className="bg-slate-800/80 backdrop-blur-xl w-full max-w-2xl rounded-3xl shadow-2xl p-6 md:p-8 border border-white/10 max-h-[90vh] overflow-y-auto custom-scrollbar">
                  <header className="flex justify-between items-center mb-8">
                      <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
                          {isLocal ? <Users className="text-fuchsia-400"/> : <Monitor className="text-violet-400"/>} 
                          {isLocal ? '자유 게임 생성' : '학급 게임 생성'}
                      </h1>
                      <button onClick={() => isLocal ? setMode('lobby') : setMode('class_game')} className="bg-white/10 p-2 rounded-full text-white hover:bg-white/20"><Home size={20}/></button>
                  </header>

                  <div className="space-y-8">
                      {/* Type */}
                      <div>
                          <label className="block text-sm font-bold text-indigo-300 mb-3">게임 방식</label>
                          <div className="flex bg-slate-900/50 p-1 rounded-2xl border border-white/5">
                              <button 
                                onClick={() => setForm((prev) => ({ ...prev, mode: 'number' }))}
                                className={`flex-1 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${form.mode === 'number' ? 'bg-violet-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                              >
                                  <Hash size={20} /> 번호 (1~N)
                              </button>
                              <button 
                                onClick={() => setForm((prev) => ({ ...prev, mode: 'word' }))}
                                className={`flex-1 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${form.mode === 'word' ? 'bg-fuchsia-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                              >
                                  <Type size={20} /> 단어 (직접입력)
                              </button>
                          </div>
                      </div>

                      {/* Size */}
                      <div>
                          <label className="block text-sm font-bold text-indigo-300 mb-3">빙고판 크기</label>
                          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                              {[3, 4, 5, 6, 8].map(s => (
                                  <button 
                                    key={s}
                                    onClick={() => setForm((prev) => ({ ...prev, size: s as BingoSize }))}
                                    className={`flex-1 py-3 px-4 rounded-xl font-bold text-lg border-2 transition-all min-w-[70px] 
                                        ${form.size === s 
                                            ? 'border-violet-500 bg-violet-500/20 text-white shadow-[0_0_15px_rgba(139,92,246,0.4)]' 
                                            : 'border-slate-700 bg-slate-800 text-slate-500 hover:border-slate-500 hover:text-slate-300'}`}
                                  >
                                      {s}X{s}
                                  </button>
                              ))}
                          </div>
                      </div>

                      <div>
                          <label className="block text-sm font-bold text-indigo-300 mb-2">제목</label>
                          <input 
                            type="text" 
                            value={form.title}
                            onChange={(e) => {
                              const value = e.currentTarget?.value ?? '';
                              setForm((prev) => ({ ...prev, title: value }));
                            }}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-violet-500 focus:outline-none placeholder-slate-600 pointer-events-auto"
                            placeholder={form.mode === 'number' ? '예: 숫자 빙고' : '예: 동물 이름 빙고'}
                          />
                      </div>

                      {form.mode === 'word' && (
                          <div>
                              <label className="block text-sm font-bold text-indigo-300 mb-2">
                                  단어 목록 <span className="text-xs font-normal text-slate-400 ml-2">(최소 {form.size*form.size}개)</span>
                              </label>
                              {isTeacherMode && (
                                  <div className="mb-3 space-y-2">
                                      <input
                                        type="text"
                                        value={form.topic}
                                        onChange={(e) => {
                                            const value = e.currentTarget?.value ?? '';
                                            setForm((prev) => ({ ...prev, topic: value }));
                                            if (aiError) setAiError('');
                                        }}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-fuchsia-500 focus:outline-none placeholder-slate-600 pointer-events-auto"
                                        placeholder="주제 입력 (단어 또는 1~3문장)"
                                      />
                                      <div className="flex items-center gap-2">
                                        <div className="text-xs text-slate-400">
                                          생성 개수: {form.aiCount}개
                                        </div>
                                      </div>
                                      <button
                                        onClick={handleGenerateWords}
                                        disabled={isGenerating}
                                        className="w-full bg-slate-800 border border-slate-600 text-slate-100 rounded-xl py-2 font-bold hover:bg-slate-700 disabled:opacity-50"
                                      >
                                          {isGenerating ? '생성 중...' : 'AI로 단어 자동 생성'}
                                      </button>
                                      {aiError && (
                                        <div className="flex items-center justify-between text-xs text-rose-400">
                                          <span>{aiError}</span>
                                          <button
                                            type="button"
                                            onClick={handleGenerateWords}
                                            className="text-rose-200 underline"
                                          >
                                            다시 시도
                                          </button>
                                        </div>
                                      )}
                                  </div>
                              )}
                              <textarea 
                                value={form.wordsText}
                                onChange={(e) => {
                                  const value = e.currentTarget?.value ?? '';
                                  setForm((prev) => ({ ...prev, wordsText: value }));
                                }}
                                className="w-full h-40 bg-slate-900 border border-slate-700 rounded-xl p-4 resize-none focus:ring-2 focus:ring-fuchsia-500 focus:outline-none text-white placeholder-slate-600 custom-scrollbar pointer-events-auto"
                                placeholder={`사과, 배, 포도...\n또는\n김철수\n이영희`}
                              />
                              <div className="text-right text-xs text-slate-400 mt-2">
                                  입력된 단어: {wordInputCount}개
                              </div>
                          </div>
                      )}

                      <button 
                        onClick={isLocal ? handleStartLocalGame : handleCreateClassGame}
                        className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold py-5 rounded-2xl shadow-lg transform transition-all active:scale-95 text-xl flex items-center justify-center gap-3 border-t border-white/20"
                      >
                          <Sparkles size={24} /> {isLocal ? '게임 시작하기' : '학급 게임 생성'}
                      </button>
                  </div>
              </div>
          </MysticalWrapper>
      );
  }

  // 3. TEACHER DASHBOARD
  if (isTeacherMode && mode === 'class_game') {
      if (isSupabaseEnabled) {
          if (!room) {
              return (
                  <MysticalWrapper>
                      <div className="text-slate-200">방 정보를 불러오는 중입니다...</div>
                  </MysticalWrapper>
              );
          }
          const boardSize = room.size || 3;
          const boardCount = boardSize * boardSize;
          const revealPlayer = roomPlayers.find((p) => p.id === room.revealed_student_id) || null;
          const revealMarks = revealedBoard?.marks || Array.from({ length: boardCount }, () => false);
          const revealLayout = revealedBoard?.layout || [];
          const studentList = roomPlayers.filter((p) => p.role === BINGO_ROOM_ROLE.student);

          return (
              <div className="min-h-[calc(100vh-6rem)] relative bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-slate-100 flex flex-col font-sans overflow-hidden">
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(59,130,246,0.08),transparent_40%),radial-gradient(circle_at_40%_80%,rgba(99,102,241,0.08),transparent_45%)] opacity-70" />
                  <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/70 backdrop-blur-md">
                      <div className="mx-auto max-w-7xl px-4 md:px-6 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                              <button onClick={onBack} className="bg-white/10 p-2 rounded-full text-slate-200 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"><Home size={20}/></button>
                              <h1 className="font-semibold text-lg md:text-xl truncate max-w-[240px]">{room.title} ({room.size}x{room.size})</h1>
                              <span className={`px-3 py-1 rounded-full text-sm font-semibold shrink-0 border ${room.status === BINGO_ROOM_STATUS.open ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : room.status === BINGO_ROOM_STATUS.ended ? 'bg-slate-400/10 text-slate-200 border-slate-400/30' : 'bg-amber-400/10 text-amber-200 border-amber-400/30'}`}>
                                  {room.status === BINGO_ROOM_STATUS.open ? '허용 중' : room.status === BINGO_ROOM_STATUS.ended ? '종료' : '준비 중'}
                              </span>
                              <div className="flex items-center gap-2 bg-white/10 border border-white/10 rounded-full px-3 py-1 text-sm">
                                  <span className="text-slate-300">참여 코드</span>
                                  <span className="font-semibold text-white">{room.code}</span>
                                  <button
                                    onClick={async () => {
                                      try {
                                        await navigator.clipboard.writeText(room.code);
                                        alert('참여 코드가 복사되었습니다.');
                                      } catch {
                                        alert('복사에 실패했습니다.');
                                      }
                                    }}
                                    className="text-slate-300 hover:text-white"
                                  >
                                      <Copy size={14} />
                                  </button>
                              </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                              <button
                                onClick={handleOpenTeacherSetup}
                                className="bg-violet-600 text-white px-4 h-12 rounded-xl font-semibold text-base flex items-center gap-2 hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 w-full sm:w-auto justify-center"
                              >
                                  <Sparkles size={18} /> AI 단어 생성
                              </button>
                              <button
                                onClick={handleOpenTeacherSetup}
                                className="bg-white/10 text-slate-100 px-4 h-12 rounded-xl font-semibold text-base flex items-center gap-2 hover:bg-white/20 border border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 w-full sm:w-auto justify-center"
                              >
                                  <Settings size={18} /> 게임 설정
                              </button>
                              <button onClick={handleClassLockToggle} className={`px-4 h-12 rounded-xl font-semibold text-base flex items-center gap-2 border ${room.status === BINGO_ROOM_STATUS.open ? 'bg-emerald-500/10 text-emerald-200 border-emerald-500/30' : 'bg-white/10 text-slate-100 border-white/10 hover:bg-white/20'}`}>
                                  {room.status === BINGO_ROOM_STATUS.open ? <Unlock size={18} /> : <Lock size={18} />}
                                  <span>{room.status === BINGO_ROOM_STATUS.open ? '허용 중' : '허용'}</span>
                              </button>
                              <button onClick={() => handleClassStatusChange('ended')} className="bg-white/10 text-slate-100 px-4 h-12 rounded-xl font-semibold text-base flex items-center gap-2 hover:bg-white/20 border border-white/10">
                                  <Pause size={18} /> 종료
                              </button>
                              <button onClick={onBack} className="bg-white/10 text-slate-100 px-4 h-12 rounded-xl font-semibold text-base hover:bg-white/20 border border-white/10">
                                  나가기
                              </button>
                          </div>
                      </div>
                  </header>

                  <main className="flex-1 px-4 md:px-6 py-8 relative z-10">
                      <div className="mx-auto w-full max-w-7xl flex flex-col gap-8">
                          <section className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 backdrop-blur-sm shadow-[0_10px_30px_rgba(15,23,42,0.25)]">
                              <div className="flex flex-wrap items-center gap-3 text-base md:text-lg text-slate-200">
                                  <span className="font-semibold">Step 1:</span>
                                  <span className="text-slate-300">단어 준비(AI 생성 또는 설정)</span>
                                  <span className="text-slate-500">•</span>
                                  <span className="font-semibold">Step 2:</span>
                                  <span className="text-slate-300">학생들에게 참여 코드 안내(허용)</span>
                                  <span className="text-slate-500">•</span>
                                  <span className="font-semibold">Step 3:</span>
                                  <span className="text-slate-300">진행하며 호명/체크</span>
                              </div>
                          </section>

                          <section className="grid grid-cols-1 xl:grid-cols-[minmax(680px,1.8fr)_minmax(300px,0.8fr)] gap-6">
                              <div className="bg-white/5 backdrop-blur-md rounded-3xl shadow-[0_20px_60px_rgba(15,23,42,0.35)] border border-white/10 p-6 md:p-8 flex flex-col min-h-[520px]">
                                  <div className="flex items-center justify-between gap-3 mb-6">
                                      <div className="min-w-0">
                                          <h2 className="text-2xl md:text-3xl font-semibold truncate">{room.title} 빙고</h2>
                                          <p className="text-slate-300 text-base md:text-lg">{room.size}x{room.size}</p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                          {revealPlayer && (
                                              <span className="px-3 py-1 rounded-full text-sm font-semibold border bg-cyan-500/10 text-cyan-200 border-cyan-500/30">
                                                  지금 공개 중: {revealPlayer.display_name}
                                              </span>
                                          )}
                                          <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${revealLines.length >= 3 ? 'bg-violet-500/10 text-violet-200 border-violet-500/30' : 'bg-white/10 text-slate-200 border-white/10'}`}>
                                              빙고 줄 수 {revealLines.length}줄
                                          </span>
                                          {revealLines.length >= 3 && (
                                              <span className="px-3 py-1 rounded-full text-sm font-semibold border bg-violet-600/20 text-violet-100 border-violet-400/40">
                                                  3빙고 달성
                                              </span>
                                          )}
                                      </div>
                                  </div>

                                  {!revealPlayer && (
                                      <div className="mb-6 text-center text-slate-200 text-lg md:text-xl font-semibold">
                                          먼저 학생을 선택해 공개 화면을 전환하세요.
                                      </div>
                                  )}

                                      <div className="relative">
                                      <div className={`grid ${getGridClass(boardSize)} gap-3 w-full flex-1`}>
                                      {Array.from({ length: boardCount }).map((_, i) => {
                                          const word = revealLayout[i];
                                          const isMarked = revealMarks[i];
                                          const sizeClass =
                                              boardSize === 3 ? 'min-h-[140px] text-xl md:text-2xl' :
                                              boardSize === 4 ? 'min-h-[110px] text-lg' :
                                              boardSize === 5 ? 'min-h-[90px] text-base' : 'min-h-[70px] text-sm';
                                          return (
                                              <button
                                                  key={i}
                                                  onClick={() => handleCellClick(i)}
                                                  className={`rounded-2xl border transition-transform duration-200 flex items-center justify-center text-center font-semibold ${sizeClass} ${isMarked ? 'bg-violet-600/70 border-violet-400 text-white shadow-[0_0_16px_rgba(139,92,246,0.6)]' : 'bg-white/10 border-white/10 text-slate-200 hover:bg-white/20'}`}
                                              >
                                                  {word ? (
                                                      <span className="px-3">{word}</span>
                                                  ) : (
                                                      <span className="w-full h-full rounded-2xl bg-white/5 animate-pulse" />
                                                  )}
                                              </button>
                                          );
                                      })}
                                      </div>
                                      <div className="absolute inset-0 pointer-events-none">
                                          {revealLines.map((line, idx) => {
                                              if (line.type === 'row') {
                                                  const top = ((line.index + 0.5) / boardSize) * 100;
                                                  return <div key={`r-${idx}`} className="absolute left-[6%] right-[6%] h-[3px] bg-cyan-300/80 rounded-full shadow-[0_0_12px_rgba(34,211,238,0.7)] transition-opacity" style={{ top: `${top}%` }} />;
                                              }
                                              if (line.type === 'col') {
                                                  const left = ((line.index + 0.5) / boardSize) * 100;
                                                  return <div key={`c-${idx}`} className="absolute top-[6%] bottom-[6%] w-[3px] bg-cyan-300/80 rounded-full shadow-[0_0_12px_rgba(34,211,238,0.7)] transition-opacity" style={{ left: `${left}%` }} />;
                                              }
                                              const rotate = line.index === 0 ? 45 : -45;
                                              return <div key={`d-${idx}`} className="absolute left-[6%] right-[6%] top-1/2 h-[3px] bg-cyan-300/80 rounded-full shadow-[0_0_12px_rgba(34,211,238,0.7)] transition-opacity origin-center" style={{ transform: `translateY(-50%) rotate(${rotate}deg)` }} />;
                                          })}
                                      </div>
                                      </div>
                                  </div>

                              <div className="bg-white/5 backdrop-blur-md rounded-3xl shadow-[0_10px_30px_rgba(15,23,42,0.25)] border border-white/10 p-6 flex flex-col overflow-hidden">
                                  <details open className="group">
                                      <summary className="cursor-pointer list-none flex items-center justify-between text-lg font-semibold text-slate-100 mb-3">
                                          <span className="flex items-center gap-2"><Users size={20} className="text-indigo-300" /> 호명용 목록 ({studentList.length}명)</span>
                                          <span className="text-slate-400 group-open:rotate-180 transition-transform">▾</span>
                                      </summary>
                                      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-2">
                                          {studentList.map((p) => (
                                              <button
                                                key={p.id}
                                                onClick={() => handleRevealPlayer(p.id)}
                                                className={`w-full px-3 py-2 rounded-xl text-left font-semibold border transition-colors ${room.revealed_student_id === p.id ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-100' : 'bg-white/10 border-white/10 text-slate-200 hover:bg-white/20'}`}
                                              >
                                                  {p.display_name}
                                              </button>
                                          ))}
                                      </div>
                                  </details>
                              </div>
                          </section>
                      </div>
                  </main>
              </div>
          );
      }

      if (!classGame) {
          return <div>Loading...</div>;
      }
      const boardSize = classGame.size || 3;
      const boardCount = boardSize * boardSize;
      const boardWords = classGame.words?.slice(0, boardCount) || [];
      
      // Roster check for missing students
      const joinedNames = new Set(allClassPlayers.map(p => p.studentName));
      const roster = studentService.getRoster();
      const missingStudents = roster.filter(s => !joinedNames.has(s.name));

      return (
          <div className="min-h-[calc(100vh-6rem)] relative bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-slate-100 flex flex-col font-sans overflow-hidden">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(59,130,246,0.08),transparent_40%),radial-gradient(circle_at_40%_80%,rgba(99,102,241,0.08),transparent_45%)] opacity-70" />

              {/* Header */}
              <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/70 backdrop-blur-md">
                  <div className="mx-auto max-w-7xl px-4 md:px-6 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                          <button onClick={onBack} className="bg-white/10 p-2 rounded-full text-slate-200 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"><Home size={20}/></button>
                          <h1 className="font-semibold text-lg md:text-xl truncate max-w-[240px]">{classGame.title} ({classGame.size}x{classGame.size})</h1>
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold shrink-0 border ${classGame.status === 'playing' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-amber-400/10 text-amber-200 border-amber-400/30'}`}>
                              {classGame.status === 'playing' ? '진행 중' : '준비 중'}
                          </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                          <button
                            onClick={handleOpenTeacherSetup}
                            className="bg-violet-600 text-white px-4 h-12 rounded-xl font-semibold text-base flex items-center gap-2 hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 w-full sm:w-auto justify-center"
                          >
                              <Sparkles size={18} /> AI 단어 생성
                          </button>
                          <button
                            onClick={handleOpenTeacherSetup}
                            className="bg-white/10 text-slate-100 px-4 h-12 rounded-xl font-semibold text-base flex items-center gap-2 hover:bg-white/20 border border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 w-full sm:w-auto justify-center"
                          >
                              <Settings size={18} /> 게임 설정
                          </button>
                          {classGame.status === 'preparing' ? (
                              <button onClick={() => handleClassStatusChange('playing')} className="bg-emerald-600 text-white px-4 h-12 rounded-xl font-semibold text-base flex items-center gap-2 hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 w-full sm:w-auto justify-center">
                                  <Play size={18} /> 허용
                              </button>
                          ) : (
                              <>
                                <button onClick={handleClassLockToggle} className={`px-4 h-12 rounded-xl font-semibold text-base flex items-center gap-2 border ${classGame.isLocked ? 'bg-red-500/10 text-red-200 border-red-500/30' : 'bg-white/10 text-slate-100 border-white/10 hover:bg-white/20'}`}>
                                    {classGame.isLocked ? <Lock size={18} /> : <Unlock size={18} />}
                                    <span>{classGame.isLocked ? '잠금' : '허용'}</span>
                                </button>
                                <button onClick={() => handleClassStatusChange('ended')} className="bg-white/10 text-slate-100 px-4 h-12 rounded-xl font-semibold text-base flex items-center gap-2 hover:bg-white/20 border border-white/10">
                                    <Pause size={18} /> 종료
                                </button>
                              </>
                          )}
                          <button onClick={onBack} className="bg-white/10 text-slate-100 px-4 h-12 rounded-xl font-semibold text-base hover:bg-white/20 border border-white/10">
                              나가기
                          </button>
                      </div>
                  </div>
              </header>

              <main className="flex-1 px-4 md:px-6 py-8 relative z-10">
                  <div className="mx-auto w-full max-w-7xl flex flex-col gap-8">
                      {/* Mini Guide */}
                      <section className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 backdrop-blur-sm shadow-[0_10px_30px_rgba(15,23,42,0.25)]">
                          <div className="flex flex-wrap items-center gap-3 text-base md:text-lg text-slate-200">
                              <span className="font-semibold">Step 1:</span>
                              <span className="text-slate-300">단어 준비(AI 생성 또는 설정)</span>
                              <span className="text-slate-500">•</span>
                              <span className="font-semibold">Step 2:</span>
                              <span className="text-slate-300">학생들에게 참여 코드 안내(허용)</span>
                              <span className="text-slate-500">•</span>
                              <span className="font-semibold">Step 3:</span>
                              <span className="text-slate-300">진행하며 호명/체크</span>
                          </div>
                      </section>

                      {/* Main Grid: Board + Call List */}
                      <section className="grid grid-cols-1 xl:grid-cols-[minmax(680px,1.8fr)_minmax(300px,0.8fr)] gap-6">
                          {/* Bingo Board (Main) */}
                          <div className="bg-white/5 backdrop-blur-md rounded-3xl shadow-[0_20px_60px_rgba(15,23,42,0.35)] border border-white/10 p-6 md:p-8 flex flex-col min-h-[520px]">
                              <div className="flex items-center justify-between gap-3 mb-6">
                                  <div className="min-w-0">
                                      <h2 className="text-2xl md:text-3xl font-semibold truncate">{classGame.title} 빙고</h2>
                                      <p className="text-slate-300 text-base md:text-lg">{classGame.size}x{classGame.size}</p>
                                  </div>
                                  <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${classGame.status === 'playing' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-amber-400/10 text-amber-200 border-amber-400/30'}`}>
                                      {classGame.status === 'playing' ? '진행 중' : '준비 중'}
                                  </span>
                              </div>

                              {boardWords.length === 0 && (
                                  <div className="mb-6 text-center text-slate-200 text-lg md:text-xl font-semibold">
                                      먼저 <span className="text-violet-300">AI 단어 생성</span> 또는 <span className="text-cyan-300">게임 설정</span>으로 단어를 준비하세요.
                                  </div>
                              )}

                              <div className={`grid ${getGridClass(boardSize)} gap-3 w-full flex-1`}>
                                  {Array.from({ length: boardCount }).map((_, i) => {
                                      const word = boardWords[i];
                                      const sizeClass =
                                          boardSize === 3 ? 'min-h-[140px] text-xl md:text-2xl' :
                                          boardSize === 4 ? 'min-h-[110px] text-lg' :
                                          boardSize === 5 ? 'min-h-[90px] text-base' : 'min-h-[70px] text-sm';
                                      return (
                                          <div
                                              key={i}
                                              className={`rounded-2xl border border-white/10 bg-white/10 hover:bg-white/15 transition-transform duration-200 flex items-center justify-center text-center font-semibold ${sizeClass}`}
                                          >
                                              {word ? (
                                                  <span className="px-3 text-slate-100">{word}</span>
                                              ) : (
                                                  <span className="w-full h-full rounded-2xl bg-white/5 animate-pulse" />
                                              )}
                                          </div>
                                      );
                                  })}
                              </div>
                          </div>

                          {/* Call List (Side) */}
                          <div className="bg-white/5 backdrop-blur-md rounded-3xl shadow-[0_10px_30px_rgba(15,23,42,0.25)] border border-white/10 p-6 flex flex-col overflow-hidden">
                              <details open className="group">
                                  <summary className="cursor-pointer list-none flex items-center justify-between text-lg font-semibold text-slate-100 mb-3">
                                      <span className="flex items-center gap-2"><Info size={20} className="text-indigo-300" /> 호명용 목록 ({classGame.words.length}개)</span>
                                      <span className="text-slate-400 group-open:rotate-180 transition-transform">▾</span>
                                  </summary>
                                  <div className="flex-1 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-3 content-start pr-2">
                                      {classGame.words.map((w, i) => (
                                          <div key={i} className="bg-white/10 border border-white/10 rounded-xl px-2 py-3 text-center text-base font-semibold text-slate-200 truncate break-all flex items-center justify-center hover:bg-white/20 transition-colors">
                                              {w}
                                          </div>
                                      ))}
                                  </div>
                              </details>
                          </div>
                      </section>

                      {/* Collapsible Bottom: Missing Students */}
                      {missingStudents.length > 0 && (
                          <section className="bg-white/5 border border-white/10 rounded-3xl p-5 backdrop-blur-md shadow-[0_8px_24px_rgba(15,23,42,0.2)]">
                              <details className="group">
                                  <summary className="cursor-pointer list-none flex items-center justify-between text-lg font-semibold text-slate-100">
                                      <span className="flex items-center gap-2"><UserX size={20} className="text-slate-300" /> 미참여 학생 ({missingStudents.length}명)</span>
                                      <span className="text-slate-400 group-open:rotate-180 transition-transform">▾</span>
                                  </summary>
                                  <div className="mt-4 max-h-56 overflow-y-auto flex flex-wrap gap-3 content-start pr-2">
                                      {missingStudents.map(s => (
                                          <span key={s.id} className="text-sm md:text-base bg-white/10 text-slate-200 border border-white/10 px-3 py-2 rounded-full">
                                              {s.number}. {s.name}
                                          </span>
                                      ))}
                                  </div>
                              </details>
                          </section>
                      )}
                  </div>
              </main>
          </div>
      );
  }

  // 4. STUDENT ROOM (Supabase)
  if (!isTeacherMode && mode === 'class_game' && isSupabaseEnabled) {
      if (!room) {
          return (
              <MysticalWrapper>
                  <div className="text-slate-200">방 정보를 불러오는 중입니다...</div>
              </MysticalWrapper>
          );
      }
      const roomSize = room.size || 3;
      const roomCount = roomSize * roomSize;
      const revealPlayer = roomPlayers.find((p) => p.id === room.revealed_student_id) || null;
      const revealMarks = revealedBoard?.marks || Array.from({ length: roomCount }, () => false);
      const revealLayout = revealedBoard?.layout || [];
      const revealLines = revealedBoard?.bingo_lines || 0;

      if (!myRoomPlayer) {
          return (
              <MysticalWrapper>
                  <div className="text-slate-200">참가 정보를 불러오는 중입니다...</div>
              </MysticalWrapper>
          );
      }

      if (!myBoard || !myBoard.submitted) {
          const usedWords = new Set(layoutDraft.filter(Boolean));
          return (
              <MysticalWrapper>
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 md:p-8 rounded-3xl shadow-[0_0_30px_rgba(124,58,237,0.3)] w-full max-w-5xl space-y-6">
                      <header className="flex items-center justify-between">
                          <div>
                              <h1 className="text-2xl md:text-3xl font-bold text-white">단어 배치하기</h1>
                              <p className="text-slate-300 text-base">칩을 선택한 뒤 오른쪽 칸을 눌러 배치하세요.</p>
                          </div>
                          <button onClick={() => setMode('lobby')} className="bg-white/10 px-4 py-2 rounded-xl text-white hover:bg-white/20">나가기</button>
                      </header>

                      <div className="grid grid-cols-1 md:grid-cols-[minmax(220px,0.6fr)_minmax(360px,1fr)] gap-6">
                          <div className="bg-white/10 border border-white/10 rounded-2xl p-4">
                              <div className="font-semibold text-lg mb-3">단어 목록</div>
                              <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto pr-2">
                                  {room.words.map((word) => {
                                      const used = usedWords.has(word);
                                      return (
                                          <button
                                            key={word}
                                            onClick={() => !used && handleSelectWord(word)}
                                            disabled={used}
                                            className={`px-3 py-2 rounded-full text-sm font-semibold border ${used ? 'bg-white/5 text-slate-500 border-white/5 cursor-not-allowed' : selectedWord === word ? 'bg-violet-500/30 text-white border-violet-400' : 'bg-white/10 text-slate-100 border-white/10 hover:bg-white/20'}`}
                                          >
                                              {word}
                                          </button>
                                      );
                                  })}
                              </div>
                          </div>

                          <div className="bg-white/10 border border-white/10 rounded-2xl p-4">
                              <div className="font-semibold text-lg mb-3">나의 빙고판</div>
                              <div className={`grid ${getGridClass(roomSize)} gap-3`}>
                                  {Array.from({ length: roomCount }).map((_, i) => {
                                      const word = layoutDraft[i];
                                      return (
                                          <button
                                            key={i}
                                            onClick={() => handlePlaceWord(i)}
                                            className="min-h-[90px] rounded-2xl border border-white/10 bg-white/5 hover:bg-white/15 text-slate-100 font-semibold text-base"
                                          >
                                              {word || '배치'}
                                          </button>
                                      );
                                  })}
                              </div>
                          </div>
                      </div>

                      <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={handleSubmitLayout}
                            disabled={isSubmittingLayout}
                            className="bg-violet-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-violet-500 disabled:opacity-50"
                          >
                              {isSubmittingLayout ? '저장 중...' : '배치 확정'}
                          </button>
                      </div>
                  </div>
              </MysticalWrapper>
          );
      }

      return (
          <MysticalWrapper>
              <div className="w-full max-w-5xl mx-auto space-y-6">
                  <header className="flex items-center justify-between bg-white/10 border border-white/10 rounded-2xl px-5 py-4 backdrop-blur-sm">
                      <div>
                          <h1 className="text-xl md:text-2xl font-semibold text-white">{room.title}</h1>
                          <p className="text-slate-300 text-sm md:text-base">지금 공개 중: {revealPlayer ? revealPlayer.display_name : '없음'}</p>
                      </div>
                      <div className="flex gap-2">
                          <button onClick={() => setStudentView('public')} className={`px-4 py-2 rounded-xl text-sm font-semibold ${studentView === 'public' ? 'bg-violet-500 text-white' : 'bg-white/10 text-slate-200 hover:bg-white/20'}`}>공개 보드</button>
                          <button onClick={() => setStudentView('my')} className={`px-4 py-2 rounded-xl text-sm font-semibold ${studentView === 'my' ? 'bg-violet-500 text-white' : 'bg-white/10 text-slate-200 hover:bg-white/20'}`}>내 빙고판</button>
                          <button onClick={() => setMode('lobby')} className="px-4 py-2 rounded-xl text-sm font-semibold bg-white/10 text-slate-200 hover:bg-white/20">나가기</button>
                      </div>
                  </header>

                  <div className="bg-white/10 border border-white/10 rounded-3xl p-6 backdrop-blur-md shadow-[0_0_30px_rgba(124,58,237,0.25)]">
                      {studentView === 'public' ? (
                          <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                  <div className="text-slate-200 font-semibold">공개 보드</div>
                                  <div className={`text-sm font-semibold ${revealLines.length >= 3 ? 'text-violet-200' : 'text-slate-300'}`}>빙고 줄 수 {revealLines.length}줄</div>
                              </div>
                              {revealLines.length >= 3 && (
                                  <div className="text-sm font-semibold text-violet-200">3빙고 달성</div>
                              )}
                              <div className="relative">
                              <div className={`grid ${getGridClass(roomSize)} gap-3`}>
                                  {Array.from({ length: roomCount }).map((_, i) => {
                                      const word = revealLayout[i];
                                      const isMarked = revealMarks[i];
                                      return (
                                          <div key={i} className={`min-h-[90px] rounded-2xl border flex items-center justify-center text-center font-semibold ${isMarked ? 'bg-violet-600/70 border-violet-400 text-white' : 'bg-white/10 border-white/10 text-slate-200'}`}>
                                              {word || <span className="w-full h-full rounded-2xl bg-white/5 animate-pulse" />}
                                          </div>
                                      );
                                  })}
                              </div>
                              <div className="absolute inset-0 pointer-events-none">
                                  {revealLines.map((line, idx) => {
                                      if (line.type === 'row') {
                                          const top = ((line.index + 0.5) / roomSize) * 100;
                                          return <div key={`r-${idx}`} className="absolute left-[6%] right-[6%] h-[3px] bg-cyan-300/80 rounded-full shadow-[0_0_12px_rgba(34,211,238,0.7)] transition-opacity" style={{ top: `${top}%` }} />;
                                      }
                                      if (line.type === 'col') {
                                          const left = ((line.index + 0.5) / roomSize) * 100;
                                          return <div key={`c-${idx}`} className="absolute top-[6%] bottom-[6%] w-[3px] bg-cyan-300/80 rounded-full shadow-[0_0_12px_rgba(34,211,238,0.7)] transition-opacity" style={{ left: `${left}%` }} />;
                                      }
                                      const rotate = line.index === 0 ? 45 : -45;
                                      return <div key={`d-${idx}`} className="absolute left-[6%] right-[6%] top-1/2 h-[3px] bg-cyan-300/80 rounded-full shadow-[0_0_12px_rgba(34,211,238,0.7)] transition-opacity origin-center" style={{ transform: `translateY(-50%) rotate(${rotate}deg)` }} />;
                                  })}
                              </div>
                              </div>
                          </div>
                      ) : (
                          <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                  <div className="text-slate-200 font-semibold">내 빙고판</div>
                                  <div className={`text-sm font-semibold ${myLines.length >= 3 ? 'text-violet-200' : 'text-slate-300'}`}>빙고 줄 수 {myLines.length}줄</div>
                              </div>
                              {myLines.length >= 3 && (
                                  <div className="text-sm font-semibold text-violet-200">3빙고 달성</div>
                              )}
                              <div className="relative">
                              <div className={`grid ${getGridClass(roomSize)} gap-3`}>
                                  {myBoard.layout.map((word, i) => {
                                      const isMarked = myBoard.marks[i];
                                      return (
                                          <button
                                            key={i}
                                            onClick={() => handleCellClick(i)}
                                            className={`min-h-[90px] rounded-2xl border flex items-center justify-center text-center font-semibold transition-colors ${isMarked ? 'bg-violet-600/70 border-violet-400 text-white' : 'bg-white/10 border-white/10 text-slate-200 hover:bg-white/20'}`}
                                          >
                                              {word}
                                          </button>
                                      );
                                  })}
                              </div>
                              <div className="absolute inset-0 pointer-events-none">
                                  {myLines.map((line, idx) => {
                                      if (line.type === 'row') {
                                          const top = ((line.index + 0.5) / roomSize) * 100;
                                          return <div key={`mr-${idx}`} className="absolute left-[6%] right-[6%] h-[3px] bg-violet-300/80 rounded-full shadow-[0_0_12px_rgba(139,92,246,0.6)] transition-opacity" style={{ top: `${top}%` }} />;
                                      }
                                      if (line.type === 'col') {
                                          const left = ((line.index + 0.5) / roomSize) * 100;
                                          return <div key={`mc-${idx}`} className="absolute top-[6%] bottom-[6%] w-[3px] bg-violet-300/80 rounded-full shadow-[0_0_12px_rgba(139,92,246,0.6)] transition-opacity" style={{ left: `${left}%` }} />;
                                      }
                                      const rotate = line.index === 0 ? 45 : -45;
                                      return <div key={`md-${idx}`} className="absolute left-[6%] right-[6%] top-1/2 h-[3px] bg-violet-300/80 rounded-full shadow-[0_0_12px_rgba(139,92,246,0.6)] transition-opacity origin-center" style={{ transform: `translateY(-50%) rotate(${rotate}deg)` }} />;
                                  })}
                              </div>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </MysticalWrapper>
      );
  }

  // 5. GAME BOARD (Student/Local)
  const isClassGame = mode === 'class_game';
  const activeGameInfo = isClassGame 
      ? (classGame ? { title: classGame.title, size: classGame.size, status: classGame.status, isLocked: classGame.isLocked } : null)
      : localGame ? { title: localGame.title, size: localGame.size, status: 'playing', isLocked: false } : null;
  
  const activePlayer = isClassGame ? myClassPlayer : localGame ? { studentName: '나', board: localGame.cells, bingoCount: localGame.bingoCount } : null;

  if (activeGameInfo && activePlayer) {
      return (
          <MysticalWrapper>
              {/* Header */}
              <header className="w-full max-w-2xl mx-auto flex justify-between items-center p-4 z-20">
                  <button onClick={() => isClassGame ? onBack() : setMode('lobby')} className="bg-white/10 p-2 rounded-full hover:bg-white/20 backdrop-blur-sm"><Home size={20}/></button>
                  <div className="text-center truncate px-2">
                      <h1 className="font-bold text-xl truncate text-transparent bg-clip-text bg-gradient-to-r from-violet-200 to-cyan-200 drop-shadow-md">{activeGameInfo.title}</h1>
                      <p className="text-xs text-indigo-300">{activePlayer.studentName}의 빙고판 ({activeGameInfo.size}x{activeGameInfo.size})</p>
                  </div>
                  <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 bg-black/40 px-4 py-1.5 rounded-full border border-white/10 backdrop-blur-sm shadow-[0_0_10px_rgba(0,0,0,0.5)]">
                          <Trophy size={16} className="text-yellow-400" />
                          <span className="font-bold text-yellow-400 text-lg">{activePlayer.bingoCount}</span>
                          <span className="text-xs text-gray-400">/ 3</span>
                      </div>
                      <button onClick={() => isClassGame ? onBack() : setMode('lobby')} className="bg-white/10 text-white px-3 py-1.5 rounded-full font-bold hover:bg-white/20">
                          나가기
                      </button>
                  </div>
              </header>

              {isClassGame && topRanks.length > 0 && (
                  <div className="w-full max-w-2xl mx-auto mb-4 bg-white/10 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white">
                      <div className="font-bold text-indigo-200 mb-2">금·은·동</div>
                      <div className="flex gap-3 flex-wrap">
                          {topRanks.map((p, idx) => (
                              <div key={p.studentId} className="flex items-center gap-2 bg-black/30 rounded-full px-3 py-1">
                                  <span className={idx === 0 ? 'animate-bounce' : idx === 1 ? 'animate-pulse' : 'animate-fade-in'}>{['🥇','🥈','🥉'][idx]}</span>
                                  <span className="font-bold">{p.studentName}</span>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              {/* Locked/Prep Overlay */}
              {isClassGame && (activeGameInfo.status === 'preparing' || activeGameInfo.isLocked) && (
                  <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center text-white backdrop-blur-sm rounded-3xl">
                      <Lock size={64} className="mb-4 text-violet-400 animate-pulse" />
                      <h2 className="text-3xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-fuchsia-300">
                          {activeGameInfo.status === 'preparing' ? '준비 중입니다' : '잠시만 기다려주세요'}
                      </h2>
                      <p className="text-indigo-300">선생님의 안내를 기다려주세요.</p>
                  </div>
              )}

              {/* BINGO Effect (Line Complete) */}
              {showBingoEffect && (
                  <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
                      <h1 className="text-[6rem] md:text-[8rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-orange-500 drop-shadow-[0_0_30px_rgba(255,165,0,0.8)] animate-bounce font-hand scale-150">
                          BINGO!
                      </h1>
                  </div>
              )}

              {/* 3-Bingo WIN Modal */}
              {showWinModal && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
                      <div className="relative bg-gradient-to-b from-slate-900 to-violet-950 p-1 rounded-3xl shadow-[0_0_100px_rgba(139,92,246,0.6)] animate-fade-in-up max-w-sm w-full text-center">
                          <div className="bg-slate-900 rounded-[22px] p-8 relative overflow-hidden border border-white/10">
                              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-50 animate-pulse"></div>
                              
                              <div className="relative z-10 flex flex-col items-center">
                                  <Trophy size={80} className="text-yellow-400 mb-6 drop-shadow-[0_0_20px_rgba(250,204,21,0.6)] animate-bounce" />
                                  <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-orange-500 mb-2">
                                      3빙고 달성!
                                  </h2>
                                  <p className="text-indigo-200 mb-8">축하합니다! 훌륭한 게임이었어요.</p>
                                  
                                  <button 
                                    onClick={() => setShowWinModal(false)}
                                    className="bg-violet-600 hover:bg-violet-500 text-white font-bold px-8 py-3 rounded-xl shadow-lg transition-all active:scale-95"
                                  >
                                      계속하기
                                  </button>
                              </div>
                          </div>
                      </div>
                  </div>
              )}

              {/* Grid Board Container with 3D Perspective */}
              <div className="flex-1 flex items-center justify-center p-4 sm:p-8 perspective-1000 w-full max-w-4xl">
                  <div 
                    ref={bingoBoardRef}
                    className="
                        bg-slate-800/50 p-4 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] 
                        w-full max-w-xl aspect-square flex flex-col justify-center 
                        border border-white/5 backdrop-blur-md transform rotate-x-6 transition-transform duration-500
                    "
                    style={{ transform: 'rotateX(5deg)' }}
                  >
                      <div className={`grid ${getGridClass(activeGameInfo.size)} gap-2 sm:gap-3 w-full h-full`}>
                          {activePlayer.board.map((cell) => (
                              <button
                                key={cell.index}
                                onClick={() => handleCellClick(cell.index)}
                                disabled={isClassGame && (activeGameInfo.status === 'preparing' || activeGameInfo.isLocked)}
                                className={`
                                    relative h-full flex items-center justify-center rounded-xl transition-all duration-300 transform-style-3d group
                                    ${cell.isMarked 
                                        ? 'bg-gradient-to-br from-violet-600 to-indigo-600 border-b-8 border-indigo-900 shadow-[0_0_20px_rgba(139,92,246,0.5)] translate-y-2 border-b-0' 
                                        : 'bg-slate-700 border-b-8 border-slate-900 shadow-xl hover:bg-slate-600 hover:-translate-y-1 active:border-b-0 active:translate-y-2'}
                                `}
                              >
                                  <span className={`
                                      break-all leading-none flex items-center justify-center h-full w-full font-black text-center p-1 drop-shadow-md
                                      ${activeGameInfo.size >= 6 ? 'text-[10px] md:text-xs' : activeGameInfo.size === 5 ? 'text-xs md:text-sm' : 'text-sm md:text-xl'}
                                      ${cell.isMarked ? 'text-white text-shadow-glow' : 'text-slate-300 group-hover:text-white'}
                                  `}>
                                      {cell.text}
                                  </span>
                                  {/* Gloss Effect */}
                                  <div className="absolute top-0 left-0 w-full h-1/2 bg-white/5 rounded-t-xl pointer-events-none"></div>
                                  
                                  {/* Marker Overlay */}
                                  {cell.isMarked && (
                                      <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
                                          <Star size="60%" className="text-white fill-white animate-pulse" />
                                      </div>
                                  )}
                              </button>
                          ))}
                      </div>
                  </div>
              </div>

              {/* Footer Controls */}
              {activePlayer.bingoCount > 0 && (
                  <div className="p-6 flex justify-center z-20">
                      <button 
                        onClick={handleCaptureBoard}
                        className="bg-white/10 text-white px-6 py-3 rounded-full font-bold shadow-lg flex items-center gap-2 hover:bg-white/20 transition-colors border border-white/10 backdrop-blur-sm"
                      >
                          <Download size={20} /> 빙고판 저장하기
                      </button>
                  </div>
              )}
          </MysticalWrapper>
      );
  }

  return <div>Loading...</div>;
};
