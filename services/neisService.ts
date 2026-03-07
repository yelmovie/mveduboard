/**
 * 나이스(NEIS) 교육정보 개방 포털 API 연동
 * - 학교 기본정보: 학교명으로 시도교육청코드·학교코드 조회
 * - 급식식단정보: 해당 학교의 오늘 급식 조회
 * @see https://open.neis.go.kr/portal/guide/apiGuidePage.do
 * 인증키: https://open.neis.go.kr/portal/guide/actKeyPage.do
 */

const NEIS_BASE = 'https://open.neis.go.kr/hub';
const CACHE_KEY_OFFICE = 'neis_office_code';
const CACHE_KEY_SCHOOL = 'neis_school_code';
const CACHE_KEY_SCHOOL_NAME = 'neis_school_name';
const CACHE_DAYS = 30;

function getApiKey(): string {
  const key = typeof import.meta !== 'undefined' && import.meta.env?.VITE_NEIS_API_KEY;
  return typeof key === 'string' ? key.trim() : '';
}

export interface NeisSchoolInfo {
  officeCode: string;
  schoolCode: string;
  schoolName: string;
}

/**
 * 학교명으로 NEIS 학교 코드(교육청코드, 학교코드) 조회
 */
export async function searchSchoolByName(schoolName: string): Promise<NeisSchoolInfo | null> {
  const key = getApiKey();
  if (!key) return null;

  const name = schoolName.trim().replace(/\s+/g, ' ');
  if (!name) return null;

  const params = new URLSearchParams({
    KEY: key,
    Type: 'json',
    pIndex: '1',
    pSize: '1',
    SCHUL_NM: name,
  });

  try {
    const res = await fetch(`${NEIS_BASE}/schoolInfo?${params.toString()}`, { method: 'GET' });
    if (!res.ok) return null;
    const data = await res.json();

    const resultInfo = data?.schoolInfo?.[0]?.RESULT;
    if (resultInfo && resultInfo.CODE !== 'INFO-000') return null;

    const list = data?.schoolInfo?.[1]?.row;
    if (!Array.isArray(list) || list.length === 0) return null;

    const row = list[0];
    const officeCode = row?.ATPT_OFCDC_SC_CODE;
    const schoolCode = row?.SD_SCHUL_CODE;
    const schoolNameFromApi = row?.SCHUL_NM;
    if (!officeCode || !schoolCode) return null;

    const result: NeisSchoolInfo = {
      officeCode: String(officeCode),
      schoolCode: String(schoolCode),
      schoolName: schoolNameFromApi ? String(schoolNameFromApi) : name,
    };

    try {
      localStorage.setItem(CACHE_KEY_OFFICE, result.officeCode);
      localStorage.setItem(CACHE_KEY_SCHOOL, result.schoolCode);
      localStorage.setItem(CACHE_KEY_SCHOOL_NAME, result.schoolName);
      const exp = new Date();
      exp.setDate(exp.getDate() + CACHE_DAYS);
      localStorage.setItem('neis_cache_exp', exp.toISOString());
    } catch {
      // ignore storage errors
    }

    return result;
  } catch {
    return null;
  }
}

/**
 * 캐시된 학교 코드 반환 (학교명이 일치할 때만)
 */
function getCachedSchoolCodes(schoolName: string): { officeCode: string; schoolCode: string } | null {
  try {
    const exp = localStorage.getItem('neis_cache_exp');
    if (exp && new Date(exp) < new Date()) return null;
    const cachedName = localStorage.getItem(CACHE_KEY_SCHOOL_NAME);
    if (!cachedName || !schoolName.trim()) return null;
    if (cachedName.trim() !== schoolName.trim()) return null;
    const officeCode = localStorage.getItem(CACHE_KEY_OFFICE);
    const schoolCode = localStorage.getItem(CACHE_KEY_SCHOOL);
    if (!officeCode || !schoolCode) return null;
    return { officeCode, schoolCode };
  } catch {
    return null;
  }
}

export interface NeisMealItem {
  dishName: string;
  allergyInfo: string;
  calorie?: string;
  nutrition?: string;
}

export interface NeisMealResult {
  date: string;
  mealCode: string;
  mealName: string;
  items: NeisMealItem[];
  rawMenu: string;
}

/**
 * 특정 일자의 급식 조회 (중식 기본)
 * MMEAL_SC_CODE: 1=조식, 2=중식, 3=석식
 */
export async function getMealByDate(
  officeCode: string,
  schoolCode: string,
  dateStr: string,
  mealCode: '1' | '2' | '3' = '2'
): Promise<NeisMealResult | null> {
  const key = getApiKey();
  if (!key) return null;

  const ymd = dateStr.replace(/-/g, '');
  if (ymd.length !== 8) return null;

  const params = new URLSearchParams({
    KEY: key,
    Type: 'json',
    pIndex: '1',
    pSize: '100',
    ATPT_OFCDC_SC_CODE: officeCode,
    SD_SCHUL_CODE: schoolCode,
    MLSV_YMD: ymd,
    MMEAL_SC_CODE: mealCode,
  });

  try {
    const res = await fetch(`${NEIS_BASE}/mealServiceDietInfo?${params.toString()}`, { method: 'GET' });
    if (!res.ok) return null;
    const data = await res.json();

    const resultInfo = data?.mealServiceDietInfo?.[0]?.RESULT;
    if (resultInfo && resultInfo.CODE !== 'INFO-000') return null;

    const list = data?.mealServiceDietInfo?.[1]?.row;
    if (!Array.isArray(list) || list.length === 0) return null;

    const mealNames: Record<string, string> = { '1': '조식', '2': '중식', '3': '석식' };
    const items: NeisMealItem[] = [];
    let rawMenu = '';

    for (const row of list) {
      const dishName = row?.DDISH_NM ?? '';
      const allergy = row?.ALLRGY_INFO ?? '';
      const calorie = row?.MLSV_FGR ?? row?.CAL_INFO;
      const nutrition = row?.NTR_INFO;
      if (dishName) {
        rawMenu += (rawMenu ? '\n' : '') + dishName.replace(/\s*[0-9.]+\s*$/g, '').trim();
        items.push({
          dishName: dishName.replace(/\s*[0-9.]+\s*$/g, '').trim(),
          allergyInfo: String(allergy || '').trim(),
          calorie: calorie ? String(calorie) : undefined,
          nutrition: nutrition ? String(nutrition) : undefined,
        });
      }
    }

    return {
      date: dateStr,
      mealCode,
      mealName: mealNames[mealCode] || '중식',
      items,
      rawMenu,
    };
  } catch {
    return null;
  }
}

/**
 * 교사가 입력한 학교명으로 오늘의 급식(중식) 조회
 * - 캐시된 교육청/학교코드가 있으면 재사용, 없으면 학교명으로 검색 후 조회
 */
export async function getTodayMealBySchoolName(schoolName: string): Promise<NeisMealResult | null> {
  const name = schoolName.trim();
  if (!name) return null;

  let officeCode: string;
  let schoolCode: string;

  const cached = getCachedSchoolCodes(name);
  if (cached) {
    officeCode = cached.officeCode;
    schoolCode = cached.schoolCode;
  } else {
    const info = await searchSchoolByName(name);
    if (!info) return null;
    officeCode = info.officeCode;
    schoolCode = info.schoolCode;
  }

  const today = new Date();
  const ymd =
    String(today.getFullYear()) +
    String(today.getMonth() + 1).padStart(2, '0') +
    String(today.getDate()).padStart(2, '0');
  const dateStr = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;

  return getMealByDate(officeCode, schoolCode, dateStr, '2');
}

export function isNeisConfigured(): boolean {
  return getApiKey().length > 0;
}
