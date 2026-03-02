/**
 * 학급 명부 CSV/엑셀 파싱·검증 (브라우저 전용, 개인정보 로그 금지)
 */
import * as XLSX from 'xlsx';
import {
  ROSTER_CSV_HEADERS,
  ROSTER_PREVIEW_MAX_ROWS,
  ROSTER_CSV_FILENAME,
} from '../constants/rosterCsv';
import { MAX_STUDENTS_PER_CLASS } from '../constants/limits';

const MAX_NUMBER = MAX_STUDENTS_PER_CLASS;

export type UploadRosterRow = {
  rowIndex: number;
  number: number;
  name: string;
  gender: 'male' | 'female' | null;
  note: string;
  error?: string;
};

/** CSV 한 줄 파싱 (쉼표 구분, 따옴표 허용) */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let cell = '';
      i++;
      while (i < line.length) {
        if (line[i] === '"') {
          i++;
          if (line[i] === '"') {
            cell += '"';
            i++;
          } else break;
        } else {
          cell += line[i];
          i++;
        }
      }
      out.push(cell);
      if (line[i] === ',') i++;
    } else {
      let end = line.indexOf(',', i);
      if (end === -1) end = line.length;
      out.push(line.slice(i, end).trim());
      i = end + 1;
    }
  }
  return out;
}

/** CSV 텍스트 → 2차원 배열 (첫 행 헤더) */
export function parseCsvText(text: string): string[][] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  return lines.map(parseCsvLine);
}

/** 엑셀 시트 → 2차원 배열 (첫 행 헤더) */
export function parseXlsxToRows(buffer: ArrayBuffer): string[][] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) return [];
  const sheet = wb.Sheets[firstSheet];
  const data: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  return data.map((row: unknown) =>
    Array.isArray(row) ? row.map((c) => (c != null ? String(c).trim() : '')) : []
  );
}

function normalizeGender(val: string): 'male' | 'female' | null {
  const v = val.trim().toLowerCase();
  if (v === '남' || v === 'm' || v === 'male') return 'male';
  if (v === '여' || v === 'f' || v === 'female') return 'female';
  return null;
}

/** 헤더 인덱스 찾기 (number, name, gender, note) */
function findHeaderIndices(firstRow: string[]): Record<string, number> {
  const m: Record<string, number> = {};
  const lower = firstRow.map((c) => c.trim().toLowerCase());
  ROSTER_CSV_HEADERS.forEach((h) => {
    const i = lower.indexOf(h.toLowerCase());
    if (i !== -1) m[h] = i;
  });
  return m;
}

/**
 * 파싱된 2차원 배열 검증 (첫 행은 헤더로 사용).
 * 반환: 검증된 행 목록 + 오류 행은 error 필드에 사유.
 */
export function validateRosterRows(rows: string[][]): UploadRosterRow[] {
  if (rows.length < 2) return [];
  const [headerRow, ...dataRows] = rows;
  const idx = findHeaderIndices(headerRow);
  const numIdx = idx.number ?? 0;
  const nameIdx = idx.name ?? 1;
  const genderIdx = idx.gender ?? 2;
  const noteIdx = idx.note ?? 3;

  const seenNumbers = new Map<number, number>();
  const result: UploadRosterRow[] = [];

  dataRows.forEach((row, i) => {
    const rowIndex = i + 2;
    const numStr = (row[numIdx] ?? '').trim();
    const name = (row[nameIdx] ?? '').trim();
    const genderStr = (row[genderIdx] ?? '').trim();
    const note = (row[noteIdx] ?? '').trim();

    let error: string | undefined;

    if (!name) {
      error = '이름 없음';
    }

    let number = 0;
    if (numStr) {
      const n = parseInt(numStr, 10);
      if (Number.isNaN(n) || n < 1 || n > MAX_NUMBER) {
        error = error ? `${error}; 번호 형식 오류(1~${MAX_NUMBER})` : `번호 형식 오류(1~${MAX_NUMBER})`;
      } else {
        number = n;
        const prev = seenNumbers.get(number);
        if (prev !== undefined) {
          error = error ? `${error}; 번호 중복(행 ${prev})` : `번호 중복(행 ${prev})`;
        } else {
          seenNumbers.set(number, rowIndex);
        }
      }
    } else {
      if (!error) error = '번호 없음';
    }

    const gender = normalizeGender(genderStr);

    result.push({
      rowIndex,
      number: number || result.length + 1,
      name: name || '(이름 없음)',
      gender,
      note,
      error,
    });
  });

  return result;
}

/** 미리보기용 최대 행 수 */
export const PREVIEW_MAX = Math.min(ROSTER_PREVIEW_MAX_ROWS, 50);

const FALLBACK_HEADERS = ['number', 'name', 'gender', 'note'];
const FALLBACK_ROW = { number: '1', name: '예시', gender: '남', note: '' };

/** 샘플 CSV 문자열 생성 (헤더/행 없어도 최소 1행 반환) */
export function buildSampleCsvContent(
  headers: readonly string[],
  sampleRows: Record<string, string>[]
): string {
  const h = headers?.length ? [...headers] : FALLBACK_HEADERS;
  const headerLine = h.join(',');
  const rows = Array.isArray(sampleRows) && sampleRows.length > 0 ? sampleRows : [FALLBACK_ROW];
  const dataLines = rows.map((row) =>
    h.map((key) => {
      const v = (row && row[key]) != null ? String(row[key]) : '';
      return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(',')
  );
  return [headerLine, ...dataLines].join('\n');
}

/** 샘플 CSV 다운로드 트리거 (UTF-8 BOM, 클라이언트 전용·네트워크 없음) */
export function downloadSampleCsv(
  headers: readonly string[],
  sampleRows: Record<string, string>[],
  filename: string
): void {
  const content = buildSampleCsvContent(headers, sampleRows);
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'class_roster_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export { ROSTER_CSV_FILENAME, ROSTER_CSV_HEADERS, ROSTER_CSV_SAMPLE_ROWS } from '../constants/rosterCsv';
