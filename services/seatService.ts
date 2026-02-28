
import { SeatLayout, SeatStudent } from '../types';
import * as studentService from './studentService';
import { generateUUID } from '../src/utils/uuid';

const LS_KEY = 'edu_seat_layout';
const INIT_KEY = 'edu_seat_initialized';

const initializeSeat = () => {
    if (!localStorage.getItem(INIT_KEY)) {
        const roster = studentService.getRoster();
        const rows = 5;
        const cols = 8; // Default increased to 40 seats
        const total = rows * cols;
        
        const seatMap = Array(total).fill(true);
        const assignments: (SeatStudent | null)[] = Array(total).fill(null);
        
        roster.forEach((s, i) => {
            if (i < total) assignments[i] = { id: s.id, name: s.name };
        });

        const layout: SeatLayout = {
            rows,
            cols,
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
  
  const layout = JSON.parse(stored);
  if (!layout.seatMap) {
      layout.seatMap = Array(layout.rows * layout.cols).fill(true);
  }
  return layout;
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
  return layout;
};

export const shuffleSeats = (names: string[], rows: number, cols: number, seatMap?: boolean[]): (SeatStudent | null)[] => {
  const students: SeatStudent[] = names.map(name => ({
    id: generateUUID(),
    name: name.trim()
  })).filter(s => s.name !== '');

  const shuffled = [...students].sort(() => Math.random() - 0.5);

  const totalSlots = rows * cols;
  const assignments: (SeatStudent | null)[] = Array(totalSlots).fill(null);
  
  const validMap = seatMap || Array(totalSlots).fill(true);
  
  let studentIdx = 0;
  for (let i = 0; i < totalSlots; i++) {
      if (validMap[i] && studentIdx < shuffled.length) {
          assignments[i] = shuffled[studentIdx];
          studentIdx++;
      } else {
          assignments[i] = null;
      }
  }

  return assignments;
};
