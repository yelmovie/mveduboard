import { WeeklyStudyData, StudyPeriod, BellScheduleItem } from '../types';
import { generateUUID } from '../src/utils/uuid';
import { supabase } from '../src/lib/supabase/client';
import { getCurrentUserProfile } from '../src/lib/supabase/auth';

const LS_KEY = 'edu_study_data';
const INIT_KEY = 'edu_study_initialized';
const STUDY_BUCKET = 'board-images';
let suppressStudyDataColumnError = false;

const DEFAULT_BELL_SCHEDULE: BellScheduleItem[] = [
    { label: '등교시간', time: '8:40 ~ 9:00', isBreak: true },
    { label: '1교시', time: '9:00 ~ 9:40' },
    { label: '2교시', time: '9:50 ~ 10:30' },
    { label: '놀이시간', time: '10:30 ~ 10:50', isBreak: true },
    { label: '3교시', time: '10:50 ~ 11:30' },
    { label: '4교시', time: '11:40 ~ 12:20' },
    { label: '5교시', time: '12:30 ~ 13:10' },
    { label: '점심시간', time: '13:10 ~ 14:00', isBreak: true },
    { label: '6교시', time: '14:00 ~ 14:40' },
];

const getKstDateString = () => {
    const kstDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    return `${kstDate.getFullYear()}-${String(kstDate.getMonth() + 1).padStart(2, '0')}-${String(kstDate.getDate()).padStart(2, '0')}`;
};

const getStudyKey = (classId?: string | null) => (classId ? `${LS_KEY}_${classId}` : LS_KEY);
const getInitKey = (classId?: string | null) => (classId ? `${INIT_KEY}_${classId}` : INIT_KEY);

const initializeStudy = (classId?: string | null) => {
    const initKey = getInitKey(classId);
    if (!localStorage.getItem(initKey)) {
        const dateStr = getKstDateString();
        
        const samplePeriods: StudyPeriod[] = [
            { period: 1, subject: '국어', content: '이야기 속 인물의 마음 알기' },
            { period: 2, subject: '수학', content: '세 자리 수 덧셈과 뺄셈' },
            { period: 3, subject: '영어', content: 'Hello, how are you?' },
            { period: 4, subject: '체육', content: '공 굴리기 게임' },
            { period: 5, subject: '창체', content: '동아리 활동 안내' }
        ];

        const schedules: Record<string, StudyPeriod[]> = {};
        schedules[dateStr] = samplePeriods;

        const data: WeeklyStudyData = {
            id: generateUUID(),
            weekStartDate: dateStr,
            fileUrl: '', // No file for sample
            fileType: 'image',
            schedules,
            bellSchedule: DEFAULT_BELL_SCHEDULE,
            fileStorage: 'local',
            updatedAt: new Date().toISOString()
        };
        
        localStorage.setItem(getStudyKey(classId), JSON.stringify(data));
        localStorage.setItem(initKey, 'true');
    }
}

const getStudyDataLocal = (classId?: string | null): WeeklyStudyData | null => {
  const key = getStudyKey(classId);
  const stored = localStorage.getItem(key);
  if (stored) {
    return JSON.parse(stored) as WeeklyStudyData;
  }
  if (classId) {
    const legacy = localStorage.getItem(LS_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as WeeklyStudyData;
      saveStudyDataLocal(parsed, classId);
      localStorage.setItem(getInitKey(classId), 'true');
      return parsed;
    }
  }
  initializeStudy(classId);
  const initialized = localStorage.getItem(key);
  return initialized ? JSON.parse(initialized) : null;
};

const saveStudyDataLocal = (data: WeeklyStudyData, classId?: string | null) => {
  const key = getStudyKey(classId);
  try {
    localStorage.setItem(key, JSON.stringify(data));
    if (classId) {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    }
  } catch (e) {
    console.warn("LocalStorage Limit Exceeded. Saving without file attachment.");
    // Fallback: Save without the file if it's too big
    const fallbackData = { ...data, fileUrl: '' };
    try {
        localStorage.setItem(key, JSON.stringify(fallbackData));
        alert("파일 용량이 너무 커서 브라우저에 원본을 저장할 수 없습니다. (5MB 제한)\n텍스트 일정만 저장됩니다.");
    } catch (e2) {
        console.error("Critical storage failure", e2);
        alert("저장 공간이 부족하여 데이터를 저장할 수 없습니다.");
    }
  }
};

const ensureSignedUrl = async (data: WeeklyStudyData | null) => {
  if (!data) return data;
  if (!supabase || data.fileStorage !== 'supabase' || !data.filePath) return data;
  const { data: signed, error } = await supabase
    .storage
    .from(STUDY_BUCKET)
    .createSignedUrl(data.filePath, 60 * 60 * 24 * 7);
  if (error || !signed?.signedUrl) return data;
  return { ...data, fileUrl: signed.signedUrl };
};

export const getStudyData = (): WeeklyStudyData | null => {
  return getStudyDataLocal(null);
};

export const getStudyDataAsync = async (): Promise<WeeklyStudyData | null> => {
  const profile = await getCurrentUserProfile();
  const classId = profile?.class_id ?? null;
  const localData = getStudyDataLocal(classId);
  if (!supabase || !classId) return localData;
  if (suppressStudyDataColumnError) return ensureSignedUrl(localData);

  const { data, error } = await supabase
    .from('classes')
    .select('study_data')
    .eq('id', classId)
    .maybeSingle();
  if (error) {
    if (!suppressStudyDataColumnError && error.message?.includes('study_data')) {
      suppressStudyDataColumnError = true;
    } else {
      console.warn('[studyService] getStudyDataAsync supabase error', error.message);
    }
    return ensureSignedUrl(localData);
  }
  if (data?.study_data) {
    saveStudyDataLocal(data.study_data, classId);
    return ensureSignedUrl(data.study_data as WeeklyStudyData);
  }
  return ensureSignedUrl(localData);
};

export const saveStudyDataAsync = async (data: WeeklyStudyData) => {
  const profile = await getCurrentUserProfile();
  const classId = profile?.class_id ?? null;
  saveStudyDataLocal(data, classId);
  if (!supabase || !classId || profile?.role !== 'teacher') return;
  if (suppressStudyDataColumnError) return;
  const { error } = await supabase
    .from('classes')
    .update({ study_data: data })
    .eq('id', classId);
  if (error) {
    if (error.message?.includes('study_data')) {
      suppressStudyDataColumnError = true;
    }
    console.warn('[studyService] saveStudyDataAsync supabase error', error.message);
  }
};

export const updateDailySchedule = async (date: string, periods: StudyPeriod[]) => {
    const data = await getStudyDataAsync();
    if (!data) return;
    
    periods.sort((a, b) => a.period - b.period);
    
    data.schedules[date] = periods;
    data.updatedAt = new Date().toISOString();
    await saveStudyDataAsync(data);
};

export const deleteDailyScheduleAsync = async (date: string) => {
    const data = await getStudyDataAsync();
    if (!data) return;
    delete data.schedules[date];
    data.updatedAt = new Date().toISOString();
    await saveStudyDataAsync(data);
};

export const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

// Helper: Compress Image to avoid LocalStorage Quota Exceeded
const compressImage = (base64Str: string, maxWidth = 1024, quality = 0.7): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height *= maxWidth / width;
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            } else {
                resolve(base64Str); // Fallback
            }
        };
        img.onerror = () => resolve(base64Str); // Fallback
    });
};

// Simply upload file without AI analysis
export const uploadStudySchedule = async (file: File): Promise<WeeklyStudyData> => {
    const isPdf = file.type === 'application/pdf';

    // Set week start date to this Monday (approximate)
    const today = new Date();
    const day = today.getDay() || 7; 
    if(day !== 1) today.setHours(-24 * (day - 1));
    const mondayStr = today.toISOString().split('T')[0];

    const baseData: WeeklyStudyData = {
        id: generateUUID(),
        weekStartDate: mondayStr,
        fileType: isPdf ? 'pdf' : 'image',
        schedules: {}, // Initialize empty, teacher can fill manually if needed
        updatedAt: new Date().toISOString()
    };
    const profile = await getCurrentUserProfile();
    const canUploadToSupabase = !!supabase && !!profile?.class_id && !!profile?.school_id && profile.role === 'teacher';
    if (canUploadToSupabase) {
        const ext = isPdf ? 'pdf' : 'png';
        const filename = `weekly-${Date.now()}.${ext}`;
        const path = `school/${profile.school_id}/class/${profile.class_id}/study/weekly/${filename}`;
        const { error } = await supabase.storage.from(STUDY_BUCKET).upload(path, file, {
            contentType: file.type,
            upsert: true,
        });
        if (!error) {
            const data = {
                ...baseData,
                fileUrl: '',
                fileStorage: 'supabase' as const,
                filePath: path,
            };
            await saveStudyDataAsync(data);
            const hydrated = await ensureSignedUrl(data);
            return hydrated ?? data;
        }
    }

    let base64Full = await blobToBase64(file);
    if (file.type.startsWith('image/')) {
        base64Full = await compressImage(base64Full, 720, 0.6);
    }

    const localData: WeeklyStudyData = {
        ...baseData,
        fileUrl: base64Full,
        fileStorage: 'local',
    };

    await saveStudyDataAsync(localData);
    return localData;
};

export const getTodaySchedule = (): { date: string, periods: StudyPeriod[] } => {
    const data = getStudyDataLocal(null);
    const dateStr = getKstDateString();

    if (!data || !data.schedules[dateStr]) {
        return { date: dateStr, periods: [] };
    }
    return { date: dateStr, periods: data.schedules[dateStr] };
};

export const deleteStudyFileAsync = async () => {
    const data = await getStudyDataAsync();
    if (!data) return;
    if (supabase && data.fileStorage === 'supabase' && data.filePath) {
        await supabase.storage.from(STUDY_BUCKET).remove([data.filePath]);
    }
    const next: WeeklyStudyData = {
        ...data,
        fileUrl: '',
        filePath: undefined,
        fileStorage: 'local',
        fileType: 'image',
        updatedAt: new Date().toISOString(),
    };
    await saveStudyDataAsync(next);
};

export const getTodayScheduleAsync = async (): Promise<{ date: string, periods: StudyPeriod[] }> => {
    const data = await getStudyDataAsync();
    const dateStr = getKstDateString();
    if (!data || !data.schedules[dateStr]) {
        return { date: dateStr, periods: [] };
    }
    return { date: dateStr, periods: data.schedules[dateStr] };
};