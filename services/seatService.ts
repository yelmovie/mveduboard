
import { SeatLayout, SeatStudent } from '../types';
import * as studentService from './studentService';
import { generateUUID } from '../src/utils/uuid';
import { loadWithSupabaseFallback, saveClassColumn } from '../lib/classDataSync';

const LS_KEY = 'edu_seat_layout';
const INIT_KEY = 'edu_seat_initialized';
const HISTORY_KEY = 'edu_seat_history';
const ROWS_DEFAULT = 6;
const COLS_DEFAULT = 9;

/** 5x8 레이아웃을 6x9로 확장하여 반환하고 저장 */
function migrate58To69(layout: SeatLayout): SeatLayout {
  if (layout.rows !== 5 || layout.cols !== 8) return layout;
  const newTotal = ROWS_DEFAULT * COLS_DEFAULT;
  const newSeatMap = Array(newTotal).fill(true);
  const newAssignments: (SeatStudent | null)[] = Array(newTotal).fill(null);
  const oldMap = layout.seatMap || Array(40).fill(true);
  const oldAssignments = layout.assignments || [];
  for (let i = 0; i < 40 && i < oldMap.length; i++) {
    newSeatMap[i] = oldMap[i];
    if (i < oldAssignments.length && oldAssignments[i]) newAssignments[i] = oldAssignments[i];
  }
  const migrated: SeatLayout = {
    rows: ROWS_DEFAULT,
    cols: COLS_DEFAULT,
    assignments: newAssignments,
    seatMap: newSeatMap,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(LS_KEY, JSON.stringify(migrated));
  saveClassColumn('seat_data', migrated).catch(() => {});
  return migrated;
}

const initializeSeat = () => {
    if (!localStorage.getItem(INIT_KEY)) {
        const roster = studentService.getRoster();
        const total = ROWS_DEFAULT * COLS_DEFAULT;
        
        const seatMap = Array(total).fill(true);
        const assignments: (SeatStudent | null)[] = Array(total).fill(null);
        
        roster.forEach((s, i) => {
            if (i < total) assignments[i] = { id: s.id, name: s.name };
        });

        const layout: SeatLayout = {
            rows: ROWS_DEFAULT,
            cols: COLS_DEFAULT,
            assignments,
            seatMap,
            updatedAt: new Date().toISOString()
        };
        
        localStorage.setItem(LS_KEY, JSON.stringify(layout));
        localStorage.setItem(INIT_KEY, 'true');
    }
}

export const getSeatLayout = (): SeatLayout | null => {
  initializeSeat();
  const stored = localStorage.getItem(LS_KEY);
  if (!stored) return null;

  const layout: SeatLayout = JSON.parse(stored);
  if (!layout.seatMap) {
    layout.seatMap = Array(layout.rows * layout.cols).fill(true);
  }
  const migrated = migrate58To69(layout);
  return migrated;
};

export const saveSeatLayout = (rows: number, cols: number, assignments: (SeatStudent | null)[], seatMap?: boolean[]) => {
  const finalSeatMap = seatMap || Array(rows * cols).fill(true);
  
  const layout: SeatLayout = {
    rows,
    cols,
    assignments,
    seatMap: finalSeatMap,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(LS_KEY, JSON.stringify(layout));
  saveClassColumn('seat_data', layout).catch(() => {});
  return layout;
};

export const loadSeatDataAsync = async (): Promise<void> => {
  const loaded = await loadWithSupabaseFallback<SeatLayout | null>(
    'seat_data',
    () => {
      initializeSeat();
      const s = localStorage.getItem(LS_KEY);
      return s ? JSON.parse(s) : null;
    },
    (d) => { if (d) { localStorage.setItem(LS_KEY, JSON.stringify(d)); localStorage.setItem(INIT_KEY, 'true'); } },
    (d) => !d || !d.assignments
  );
  if (loaded && loaded.seatMap === undefined && loaded.rows && loaded.cols) {
    loaded.seatMap = Array(loaded.rows * loaded.cols).fill(true);
  }
  if (loaded && loaded.rows === 5 && loaded.cols === 8) {
    migrate58To69(loaded);
    localStorage.setItem(INIT_KEY, 'true');
  }
};

const getHistory = (): SeatLayout[] => {
  const stored = localStorage.getItem(HISTORY_KEY);
  return stored ? JSON.parse(stored) : [];
};

const saveHistory = (layout: SeatLayout) => {
  const history = getHistory();
  history.unshift(layout);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 5)));
};

const getNeighborPairs = (assignments: (SeatStudent | null)[], cols: number): Set<string> => {
  const pairs = new Set<string>();
  const len = assignments.length;
  const directions = [-1, 1, -cols, cols, -cols - 1, -cols + 1, cols - 1, cols + 1];

  for (let i = 0; i < len; i++) {
    const a = assignments[i];
    if (!a) continue;
    for (const d of directions) {
      const j = i + d;
      if (j < 0 || j >= len) continue;
      if (d === -1 || d === -cols - 1 || d === cols - 1) { if (i % cols === 0) continue; }
      if (d === 1 || d === -cols + 1 || d === cols + 1) { if (i % cols === cols - 1) continue; }
      const b = assignments[j];
      if (!b) continue;
      const key = [a.name, b.name].sort().join('|');
      pairs.add(key);
    }
  }
  return pairs;
};

const scoreAssignment = (
  assignments: (SeatStudent | null)[],
  cols: number,
  historyPairs: Set<string>
): number => {
  const currentPairs = getNeighborPairs(assignments, cols);
  let overlap = 0;
  currentPairs.forEach(p => { if (historyPairs.has(p)) overlap++; });
  return overlap;
};

const buildHistoryPairs = (cols: number): Set<string> => {
  const history = getHistory();
  const allPairs = new Set<string>();
  for (const layout of history) {
    const pairs = getNeighborPairs(layout.assignments, layout.cols);
    pairs.forEach(p => allPairs.add(p));
  }
  return allPairs;
};

const doShuffle = (students: SeatStudent[], totalSlots: number, validMap: boolean[]): (SeatStudent | null)[] => {
  const shuffled = [...students].sort(() => Math.random() - 0.5);
  const assignments: (SeatStudent | null)[] = Array(totalSlots).fill(null);
  let idx = 0;
  for (let i = 0; i < totalSlots; i++) {
    if (validMap[i] && idx < shuffled.length) {
      assignments[i] = shuffled[idx++];
    }
  }
  return assignments;
};

export const shuffleSeats = (names: string[], rows: number, cols: number, seatMap?: boolean[]): (SeatStudent | null)[] => {
  const students: SeatStudent[] = names.map(name => ({
    id: generateUUID(),
    name: name.trim()
  })).filter(s => s.name !== '');

  const totalSlots = rows * cols;
  const validMap = seatMap || Array(totalSlots).fill(true);
  const historyPairs = buildHistoryPairs(cols);

  if (historyPairs.size === 0) {
    return doShuffle(students, totalSlots, validMap);
  }

  let bestAssignment = doShuffle(students, totalSlots, validMap);
  let bestScore = scoreAssignment(bestAssignment, cols, historyPairs);

  const attempts = Math.min(200, students.length * 20);
  for (let i = 0; i < attempts; i++) {
    if (bestScore === 0) break;
    const candidate = doShuffle(students, totalSlots, validMap);
    const candidateScore = scoreAssignment(candidate, cols, historyPairs);
    if (candidateScore < bestScore) {
      bestAssignment = candidate;
      bestScore = candidateScore;
    }
  }

  return bestAssignment;
};

export { saveHistory };
