/** 학급 명부 CSV/엑셀 업로드용 헤더 및 상수 (One Source of Truth) */
export const ROSTER_CSV_HEADERS = ['number', 'name', 'gender', 'note'] as const;
export type RosterCsvHeader = (typeof ROSTER_CSV_HEADERS)[number];

export const ROSTER_CSV_SAMPLE_ROWS: Record<string, string>[] = [
  { number: '1', name: '김철수', gender: '남', note: '' },
  { number: '2', name: '이영희', gender: '여', note: '' },
  { number: '3', name: '박민수', gender: '남', note: '비고 예시' },
  { number: '4', name: '최지은', gender: '여', note: '' },
  { number: '5', name: '정대호', gender: '남', note: '' },
  { number: '6', name: '강수진', gender: '여', note: '' },
  { number: '7', name: '조현우', gender: '남', note: '' },
  { number: '8', name: '한서연', gender: '여', note: '' },
];

export const ROSTER_PREVIEW_MAX_ROWS = 50;
export const ROSTER_CSV_FILENAME = 'class_roster_template.csv';
