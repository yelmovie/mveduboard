
import { LunchData, LunchMenu } from '../types';

const LS_KEY = 'edu_lunch_data';
const INIT_KEY = 'edu_lunch_initialized';

const initializeLunch = () => {
    if (!localStorage.getItem(INIT_KEY)) {
        const today = new Date().toISOString().split('T')[0];
        // Create 5 days of dummy data
        const menus: LunchMenu[] = [];
        const baseDate = new Date();
        
        for(let i=0; i<5; i++) {
            const d = new Date();
            d.setDate(baseDate.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            menus.push({
                date: dateStr,
                menu: i === 0 ? '현미밥\n쇠고기미역국\n돼지갈비찜\n숙주나물\n배추김치\n우리밀케이크' : `맛있는 급식 메뉴 ${i+1}`,
                allergy: '1, 5, 10'
            });
        }

        const data: LunchData = {
            updatedAt: new Date().toISOString(),
            imageUrl: 'https://via.placeholder.com/600x800?text=Lunch+Schedule',
            menus: menus
        };
        
        localStorage.setItem(LS_KEY, JSON.stringify(data));
        localStorage.setItem(INIT_KEY, 'true');
    }
}

export const getLunchData = (): LunchData | null => {
  initializeLunch();
  const stored = localStorage.getItem(LS_KEY);
  return stored ? JSON.parse(stored) : null;
};

export const saveLunchData = (data: LunchData) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("LocalStorage Limit Exceeded.");
    // Throw error so the caller knows it failed
    throw new Error("저장 공간이 부족하여 식단표를 저장할 수 없습니다.\n이미지 용량이 너무 큽니다.");
  }
};

export const clearLunchData = () => {
  localStorage.removeItem(LS_KEY);
};

export const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

// Helper: Compress Image
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
export const uploadLunchSchedule = async (file: File): Promise<LunchData> => {
    let base64Full = await blobToBase64(file);
    
    // Compress to ensure it fits in LocalStorage
    base64Full = await compressImage(base64Full);

    const newData: LunchData = {
        updatedAt: new Date().toISOString(),
        imageUrl: base64Full,
        menus: [] // Initialize empty, teacher can fill manually if needed
    };

    saveLunchData(newData);
    return newData;
};
