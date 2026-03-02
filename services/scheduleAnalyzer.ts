/**
 * 주간학습안내 파일(이미지/PDF)을 OpenAI Vision API로 분석하여
 * 요일별 시간표(StudyPeriod[])를 추출하는 모듈
 */
import { StudyPeriod } from '../types';
import { getOpenAIApiKey } from './openaiClient';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const ANALYSIS_MODEL = 'gpt-4o';

const SYSTEM_PROMPT = `당신은 초등학교 주간학습안내(주간 시간표) 이미지를 분석하는 전문가입니다.
이미지에서 월~금 각 요일의 교시별 과목과 학습 내용을 추출하세요.

반드시 아래 JSON 형식으로만 답하세요. 다른 텍스트는 절대 포함하지 마세요.
{
  "monday": [{"period":1,"subject":"국어","content":"이야기 읽기"}],
  "tuesday": [...],
  "wednesday": [...],
  "thursday": [...],
  "friday": [...]
}

규칙:
1. period는 1부터 시작하는 교시 번호
2. subject는 과목명 (국어, 수학, 영어, 사회, 과학, 체육, 음악, 미술, 도덕, 실과, 창체 등)
3. content는 학습 내용 요약 (없으면 빈 문자열)
4. 이미지에서 읽을 수 없는 내용은 빈 문자열로
5. JSON만 반환, 마크다운 코드블록 금지`;

type DayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';
type AnalysisResult = Record<DayKey, StudyPeriod[]>;

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function pdfToImageBase64(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  const scale = 2;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport }).promise;

  return canvas.toDataURL('image/jpeg', 0.85);
}

function extractJsonBlock(text: string): string {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }
  return '';
}

function getWeekDates(baseDate?: string): Record<DayKey, string> {
  const d = baseDate ? new Date(baseDate) : new Date();
  const kst = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const dayOfWeek = kst.getDay() || 7;
  const monday = new Date(kst);
  monday.setDate(kst.getDate() - (dayOfWeek - 1));

  const result: Record<string, string> = {};
  const keys: DayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  keys.forEach((key, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    result[key] = date.toISOString().split('T')[0];
  });
  return result as Record<DayKey, string>;
}

export async function analyzeScheduleFromFile(
  file: File
): Promise<Record<string, StudyPeriod[]>> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) throw new Error('OpenAI API 키가 설정되지 않았습니다.');

  let imageDataUrl: string;
  if (file.type === 'application/pdf') {
    imageDataUrl = await pdfToImageBase64(file);
  } else {
    imageDataUrl = await fileToBase64(file);
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ANALYSIS_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: '이 주간학습안내 이미지에서 월~금 각 요일의 시간표를 추출해주세요.' },
            { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI 분석 실패 (${response.status}): ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI 응답이 비어 있습니다.');

  let parsed: AnalysisResult;
  try {
    parsed = JSON.parse(content);
  } catch {
    const extracted = extractJsonBlock(content);
    if (!extracted) throw new Error('AI 응답을 파싱할 수 없습니다.');
    parsed = JSON.parse(extracted);
  }

  const weekDates = getWeekDates();
  const schedules: Record<string, StudyPeriod[]> = {};
  const dayKeys: DayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

  dayKeys.forEach((key) => {
    const dateStr = weekDates[key];
    const periods = parsed[key];
    if (Array.isArray(periods) && periods.length > 0) {
      schedules[dateStr] = periods
        .filter((p) => p.subject || p.content)
        .map((p) => ({
          period: Number(p.period) || 1,
          subject: String(p.subject || '').trim(),
          content: String(p.content || '').trim(),
        }));
    }
  });

  return schedules;
}
