import { WordSearchGame } from '../types';
import { generateText } from './openaiClient';
import { generateUUID } from '../src/utils/uuid';

const LS_KEY = 'edu_wordsearch_game';
const INIT_KEY = 'edu_wordsearch_initialized';
const LEADERBOARD_KEY_PREFIX = 'edu_wordsearch_leaderboard_';

export type WordSearchRankEntry = {
    id: string;
    name: string;
    timeMs: number;
    finishedAt: string;
};

const initializeWordSearch = () => {
    if (!localStorage.getItem(INIT_KEY)) {
        createGame('과일 이름 찾기', ['사과', '포도', '바나나', '수박', '오렌지']);
        localStorage.setItem(INIT_KEY, 'true');
    }
}

const hasApiKey = () => {
    return Boolean(import.meta.env?.VITE_OPENAI_API_KEY || import.meta.env?.OPENAI_API_KEY);
};

export const getGame = (): WordSearchGame | null => {
  initializeWordSearch();
  const stored = localStorage.getItem(LS_KEY);
  return stored ? JSON.parse(stored) : null;
};

export const createGame = (title: string, wordsInput: string[]): WordSearchGame => {
  const words = wordsInput.filter(w => w.length > 0 && w.length <= 10);
  const size = Math.max(10, Math.min(15, Math.ceil(Math.sqrt(words.join('').length * 3))));
  
  const grid: string[][] = Array(size).fill(null).map(() => Array(size).fill(''));
  const placedWords: string[] = [];

  const directions = [
    [0, 1], [1, 0], [1, 1], [1, -1],
  ];

  const sortedWords = [...words].sort((a, b) => b.length - a.length);

  for (const word of sortedWords) {
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 100) {
      const dir = directions[Math.floor(Math.random() * directions.length)];
      const row = Math.floor(Math.random() * size);
      const col = Math.floor(Math.random() * size);

      if (canPlace(grid, word, row, col, dir[0], dir[1], size)) {
        place(grid, word, row, col, dir[0], dir[1]);
        placedWords.push(word);
        placed = true;
      }
      attempts++;
    }
  }

  const chars = placedWords.join('');
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === '') {
        grid[r][c] = chars[Math.floor(Math.random() * chars.length)] || '가';
      }
    }
  }

  const newGame: WordSearchGame = {
    id: generateUUID(),
    title,
    size,
    words: placedWords,
    grid,
    foundWords: [],
  };

  localStorage.setItem(LS_KEY, JSON.stringify(newGame));
  return newGame;
};

export const findWord = (word: string) => {
    const game = getGame();
    if (!game) return;
    
    if (game.words.includes(word) && !game.foundWords.includes(word)) {
        game.foundWords.push(word);
        localStorage.setItem(LS_KEY, JSON.stringify(game));
        return true;
    }
    return false;
};

export const resetGame = () => {
    localStorage.removeItem(LS_KEY);
};

export const resetProgress = () => {
    const game = getGame();
    if (!game) return;
    game.foundWords = [];
    localStorage.setItem(LS_KEY, JSON.stringify(game));
};

export const getLeaderboard = (gameId: string): WordSearchRankEntry[] => {
    const stored = localStorage.getItem(`${LEADERBOARD_KEY_PREFIX}${gameId}`);
    return stored ? JSON.parse(stored) : [];
};

export const upsertLeaderboardEntry = (gameId: string, entry: WordSearchRankEntry) => {
    const list = getLeaderboard(gameId);
    const existingIndex = list.findIndex((e) => e.id === entry.id);
    if (existingIndex >= 0) {
        list[existingIndex] = entry;
    } else {
        list.push(entry);
    }
    localStorage.setItem(`${LEADERBOARD_KEY_PREFIX}${gameId}`, JSON.stringify(list));
    return list;
};

export const generateWordsWithAI = async (theme: string, count: number): Promise<string[]> => {
    if (!hasApiKey()) {
        console.error('[wordSearchService] OpenAI API Key not found');
        return [];
    }
    const prompt = `
        List ${count} Korean words related to the theme: "${theme}".
        Rules:
        1. Words must be in Korean.
        2. Words should be suitable for elementary school students.
        3. Only return the words, separated by commas. No numbering, no bullets.
        4. Avoid spaces in words if possible (or keep them short).
        5. Do not include the word "ACE".
    `;

    try {
        const text = await generateText(prompt, { maxTokens: 256 });
        // Split by comma or newline and clean up
        return text.split(/[,,\n]+/).map(w => w.trim()).filter(w => w.length > 0 && w.length <= 10); // Enforce max length
    } catch (e) {
        console.error(e);
        return [];
    }
}

const canPlace = (grid: string[][], word: string, r: number, c: number, dr: number, dc: number, size: number) => {
  const endR = r + (word.length - 1) * dr;
  const endC = c + (word.length - 1) * dc;

  if (endR < 0 || endR >= size || endC < 0 || endC >= size) return false;

  for (let i = 0; i < word.length; i++) {
    const charAtGrid = grid[r + i * dr][c + i * dc];
    if (charAtGrid !== '' && charAtGrid !== word[i]) {
      return false;
    }
  }
  return true;
};

const place = (grid: string[][], word: string, r: number, c: number, dr: number, dc: number) => {
  for (let i = 0; i < word.length; i++) {
    grid[r + i * dr][c + i * dc] = word[i];
  }
};