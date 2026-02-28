import { BingoGame, BingoPlayer, BingoSize, BingoCell } from '../types';
import { generateText } from './openaiClient';
import { generateUUID } from '../src/utils/uuid';
import {
  BINGO_AI_MAX_WORD_LEN,
  BINGO_AI_MIN_WORD_LEN,
  BINGO_AI_PROMPT_SYSTEM,
  buildBingoAiPrompt,
} from '../src/config/bingoAi';

const LS_KEYS = {
  GAME: 'edu_bingo_game',
  PLAYERS: 'edu_bingo_players',
  INIT: 'edu_bingo_initialized'
};

const hasApiKey = () => {
  return Boolean(import.meta.env?.VITE_OPENAI_API_KEY || import.meta.env?.OPENAI_API_KEY);
};

const initializeBingo = () => {
    if (!localStorage.getItem(LS_KEYS.INIT)) {
        const words = ['호랑이', '사자', '코끼리', '기린', '원숭이', '판다', '토끼', '거북이', '고래', '상어', '독수리', '참새', '부엉이', '펭귄', '악어', '하마'];
        const game: BingoGame = {
            id: generateUUID(),
            title: '동물 이름 빙고',
            size: 4,
            words: words,
            status: 'playing',
            isLocked: false,
            createdAt: new Date().toISOString()
        };
        
        // Sample player
        const player: BingoPlayer = {
            studentId: 'student-1',
            studentName: '김민수',
            board: words.slice(0, 16).map((w, i) => ({ index: i, text: w, isMarked: i % 3 === 0 })),
            bingoCount: 1,
            lastBingoTime: Date.now()
        };

        localStorage.setItem(LS_KEYS.GAME, JSON.stringify(game));
        localStorage.setItem(LS_KEYS.PLAYERS, JSON.stringify([player]));
        localStorage.setItem(LS_KEYS.INIT, 'true');
    }
}

// --- Game Management (Teacher) ---

export const getGame = (): BingoGame | null => {
  initializeBingo();
  const stored = localStorage.getItem(LS_KEYS.GAME);
  return stored ? JSON.parse(stored) : null;
};

export const createGame = (title: string, size: BingoSize, words: string[]): BingoGame => {
  const requiredCount = size * size;
  let gameWords = [...words];
  
  if (gameWords.length < requiredCount) {
     for(let i=gameWords.length; i<requiredCount; i++) {
         gameWords.push(`${i+1}`);
     }
  }

  const newGame: BingoGame = {
    id: generateUUID(),
    title,
    size,
    words: gameWords,
    status: 'preparing',
    isLocked: false,
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem(LS_KEYS.GAME, JSON.stringify(newGame));
  localStorage.removeItem(LS_KEYS.PLAYERS);
  return newGame;
};

export const updateGameStatus = (status: BingoGame['status'], isLocked: boolean) => {
    const game = getGame();
    if (game) {
        const updated = { ...game, status, isLocked };
        localStorage.setItem(LS_KEYS.GAME, JSON.stringify(updated));
    }
}

export const resetGame = () => {
    localStorage.removeItem(LS_KEYS.GAME);
    localStorage.removeItem(LS_KEYS.PLAYERS);
}

export const generateWordsWithAI = async (topic: string, count: number): Promise<string[]> => {
    if (!hasApiKey()) {
        console.error('[bingoService] OpenAI API Key not found');
        return [];
    }
    const prompt = `
        Create ${count} Korean words or short terms related to this topic: "${topic}".
        Rules:
        1. Only Korean words.
        2. Suitable for elementary students.
        3. Return words separated by commas only. No numbering or bullets.
        4. Avoid long phrases; keep each item short (1~6 chars).
        5. Do not include duplicates.
    `;
    try {
        const text = await generateText(prompt, { maxTokens: 256 });
        const words = text
            .split(/[,\n]+/)
            .map((w) => w.trim())
            .filter((w) => w.length > 0 && w.length <= 10);
        return Array.from(new Set(words));
    } catch (e) {
        console.error('[bingoService] generateWordsWithAI error', e);
        return [];
    }
};

const extractJsonArray = (text: string) => {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (e) {
    return null;
  }
};

export const generateWordPairsWithAI = async (
  topic: string,
  count: number
): Promise<{ word: string; meaning: string }[]> => {
  if (!hasApiKey()) {
    console.error('[bingoService] OpenAI API Key not found');
    return [];
  }
  const prompt = buildBingoAiPrompt(topic, count);
  try {
    const text = await generateText(prompt, { maxTokens: 512 }, BINGO_AI_PROMPT_SYSTEM);
    const parsed = extractJsonArray(text);
    const list = Array.isArray(parsed) ? parsed : [];
    const normalized = list
      .map((item: any) => ({
        word: String(item?.word || '').trim(),
        meaning: String(item?.meaning || '').trim(),
      }))
      .filter((item) => item.word && item.meaning)
      .filter((item) => item.word.length >= BINGO_AI_MIN_WORD_LEN && item.word.length <= BINGO_AI_MAX_WORD_LEN);
    const seen = new Set<string>();
    const unique = normalized.filter((item) => {
      const key = item.word.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return unique.slice(0, count);
  } catch (e) {
    console.error('[bingoService] generateWordPairsWithAI error', e);
    return [];
  }
};

// --- Player Management (Student) ---

export const getPlayers = (): BingoPlayer[] => {
    const stored = localStorage.getItem(LS_KEYS.PLAYERS);
    return stored ? JSON.parse(stored) : [];
}

export const joinGame = (studentId: string, studentName: string): BingoPlayer | null => {
    const game = getGame();
    if (!game) return null;

    const players = getPlayers();
    const existing = players.find(p => p.studentId === studentId);
    if (existing) return existing;

    const shuffled = [...game.words].sort(() => Math.random() - 0.5);
    const boardCells: BingoCell[] = shuffled.slice(0, game.size * game.size).map((word, idx) => ({
        index: idx,
        text: word,
        isMarked: false
    }));

    const newPlayer: BingoPlayer = {
        studentId,
        studentName,
        board: boardCells,
        bingoCount: 0
    };

    localStorage.setItem(LS_KEYS.PLAYERS, JSON.stringify([...players, newPlayer]));
    return newPlayer;
}

export const toggleCell = (studentId: string, cellIndex: number): BingoPlayer | null => {
    const game = getGame();
    if (!game || game.isLocked || game.status !== 'playing') return null;

    const players = getPlayers();
    const playerIndex = players.findIndex(p => p.studentId === studentId);
    if (playerIndex === -1) return null;

    const player = players[playerIndex];
    const newBoard = [...player.board];
    newBoard[cellIndex] = { ...newBoard[cellIndex], isMarked: !newBoard[cellIndex].isMarked };

    const bingoCount = calculateBingoCount(newBoard, game.size);
    const updatedPlayer = { ...player, board: newBoard, bingoCount, lastBingoTime: bingoCount > player.bingoCount ? Date.now() : player.lastBingoTime };

    players[playerIndex] = updatedPlayer;
    localStorage.setItem(LS_KEYS.PLAYERS, JSON.stringify(players));
    
    return updatedPlayer;
}

const calculateBingoCount = (cells: BingoCell[], size: number): number => {
    let count = 0;
    
    // Rows
    for (let r = 0; r < size; r++) {
        let isLine = true;
        for (let c = 0; c < size; c++) {
            if (!cells[r * size + c].isMarked) {
                isLine = false; 
                break;
            }
        }
        if (isLine) count++;
    }

    // Cols
    for (let c = 0; c < size; c++) {
        let isLine = true;
        for (let r = 0; r < size; r++) {
            if (!cells[r * size + c].isMarked) {
                isLine = false;
                break;
            }
        }
        if (isLine) count++;
    }

    // Diagonal 1 (TL to BR)
    let isD1 = true;
    for (let i = 0; i < size; i++) {
        if (!cells[i * size + i].isMarked) {
            isD1 = false;
            break;
        }
    }
    if (isD1) count++;

    // Diagonal 2 (TR to BL)
    let isD2 = true;
    for (let i = 0; i < size; i++) {
        if (!cells[i * size + (size - 1 - i)].isMarked) {
            isD2 = false;
            break;
        }
    }
    if (isD2) count++;

    return count;
}