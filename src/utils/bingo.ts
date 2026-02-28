import { BINGO_ROOM_CODE_ALPHABET, BINGO_ROOM_CODE_LENGTH } from '../config/bingoRoom';

export const generateRoomCode = (length = BINGO_ROOM_CODE_LENGTH) => {
  const alphabet = BINGO_ROOM_CODE_ALPHABET;
  let code = '';
  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(Math.random() * alphabet.length);
    code += alphabet[idx];
  }
  return code;
};

export const applyMarkToggle = (marks: boolean[], index: number) => {
  return marks.map((m, i) => (i === index ? !m : m));
};

export const computeBingoLines = (size: number, marks: boolean[]) => {
  let count = 0;

  for (let r = 0; r < size; r += 1) {
    let isLine = true;
    for (let c = 0; c < size; c += 1) {
      if (!marks[r * size + c]) {
        isLine = false;
        break;
      }
    }
    if (isLine) count += 1;
  }

  for (let c = 0; c < size; c += 1) {
    let isLine = true;
    for (let r = 0; r < size; r += 1) {
      if (!marks[r * size + c]) {
        isLine = false;
        break;
      }
    }
    if (isLine) count += 1;
  }

  let isD1 = true;
  for (let i = 0; i < size; i += 1) {
    if (!marks[i * size + i]) {
      isD1 = false;
      break;
    }
  }
  if (isD1) count += 1;

  let isD2 = true;
  for (let i = 0; i < size; i += 1) {
    if (!marks[i * size + (size - 1 - i)]) {
      isD2 = false;
      break;
    }
  }
  if (isD2) count += 1;

  return count;
};

export type BingoLine =
  | { type: 'row'; index: number }
  | { type: 'col'; index: number }
  | { type: 'diag'; index: 0 | 1 };

export const computeCompletedLines = (size: number, marks: boolean[]) => {
  const lines: BingoLine[] = [];

  for (let r = 0; r < size; r += 1) {
    let isLine = true;
    for (let c = 0; c < size; c += 1) {
      if (!marks[r * size + c]) {
        isLine = false;
        break;
      }
    }
    if (isLine) lines.push({ type: 'row', index: r });
  }

  for (let c = 0; c < size; c += 1) {
    let isLine = true;
    for (let r = 0; r < size; r += 1) {
      if (!marks[r * size + c]) {
        isLine = false;
        break;
      }
    }
    if (isLine) lines.push({ type: 'col', index: c });
  }

  let isD1 = true;
  for (let i = 0; i < size; i += 1) {
    if (!marks[i * size + i]) {
      isD1 = false;
      break;
    }
  }
  if (isD1) lines.push({ type: 'diag', index: 0 });

  let isD2 = true;
  for (let i = 0; i < size; i += 1) {
    if (!marks[i * size + (size - 1 - i)]) {
      isD2 = false;
      break;
    }
  }
  if (isD2) lines.push({ type: 'diag', index: 1 });

  return lines;
};
