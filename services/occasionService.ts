
import { OccasionMonth, OccasionTopic, CommonOccasionTopic, OccasionMaterial } from '../types';
import { generateUUID } from '../src/utils/uuid';

// --- LocalStorage Logic ---
const LS_KEY = 'edu_occasion_custom_materials';
const LS_SHARED_KEY = 'edu_occasion_shared_materials';

// Shared Material Interface (extends existing with stats)
export interface SharedMaterial extends OccasionMaterial {
    sharedAt: string;
    downloads: number;
    likes: number;
    originalAuthor: string;
}

const getStoredCustomMaterials = (): Record<string, OccasionMaterial[]> => {
    const stored = localStorage.getItem(LS_KEY);
    return stored ? JSON.parse(stored) : {};
};

export const saveCustomMaterial = (month: number | string, topicId: string, material: OccasionMaterial) => {
    const allCustom = getStoredCustomMaterials();
    // Use a composite key for mapping: "month-topicId" (month can be 'common' for common topics)
    const key = `${month}-${topicId}`;
    
    if (!allCustom[key]) {
        allCustom[key] = [];
    }
    
    // Check if ID exists (update) or new
    const existingIdx = allCustom[key].findIndex(m => m.id === material.id);
    if (existingIdx > -1) {
        allCustom[key][existingIdx] = material;
    } else {
        allCustom[key] = [material, ...allCustom[key]];
    }
    
    localStorage.setItem(LS_KEY, JSON.stringify(allCustom));
};

const LS_HIDDEN_KEY = 'edu_occasion_hidden_materials';

const getHiddenIds = (): string[] => {
    const stored = localStorage.getItem(LS_HIDDEN_KEY);
    return stored ? JSON.parse(stored) : [];
};

export const deleteMaterial = (month: number | string, topicId: string, materialId: string) => {
    const allCustom = getStoredCustomMaterials();
    const key = `${month}-${topicId}`;
    const customList = allCustom[key] || [];
    const isCustom = customList.some(m => m.id === materialId);

    if (isCustom) {
        allCustom[key] = customList.filter(m => m.id !== materialId);
        localStorage.setItem(LS_KEY, JSON.stringify(allCustom));
    } else {
        const hidden = getHiddenIds();
        if (!hidden.includes(materialId)) {
            hidden.push(materialId);
            localStorage.setItem(LS_HIDDEN_KEY, JSON.stringify(hidden));
        }
    }
};

// --- Shared / Community Logic ---

const INITIAL_SHARED: SharedMaterial[] = [
    {
        id: 'share-1',
        title: '식목일 나무 심기 캠페인 영상',
        types: ['영상'],
        thumbnailUrl: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=600&q=80',
        topic: '식목일',
        author: '환경지킴이쌤',
        link: 'https://www.youtube.com/results?search_query=식목일',
        sharedAt: new Date(Date.now() - 86400000).toISOString(),
        downloads: 15,
        likes: 23,
        originalAuthor: '환경지킴이쌤'
    },
    {
        id: 'share-2',
        title: '독도의 날 계기교육 PPT 자료',
        types: ['슬라이드'],
        thumbnailUrl: 'https://images.unsplash.com/photo-1623633276807-6b4d32439343?auto=format&fit=crop&w=600&q=80',
        topic: '독도의 날',
        author: '역사사랑',
        link: '#',
        sharedAt: new Date(Date.now() - 172800000).toISOString(),
        downloads: 42,
        likes: 56,
        originalAuthor: '역사사랑'
    },
    {
        id: 'share-3',
        title: '장애인의 날 이해 교육 활동지',
        types: ['활동지', 'PDF'],
        thumbnailUrl: 'https://images.unsplash.com/photo-1589330694653-4a8b74c644db?auto=format&fit=crop&w=600&q=80',
        topic: '장애인의 날',
        author: '함께하는우리',
        link: '#',
        sharedAt: new Date(Date.now() - 250000000).toISOString(),
        downloads: 8,
        likes: 12,
        originalAuthor: '함께하는우리'
    }
];

export const getSharedMaterials = (): SharedMaterial[] => {
    const stored = localStorage.getItem(LS_SHARED_KEY);
    if (!stored) {
        localStorage.setItem(LS_SHARED_KEY, JSON.stringify(INITIAL_SHARED));
        return INITIAL_SHARED;
    }
    return JSON.parse(stored);
};

export const shareMaterialToCommunity = (material: OccasionMaterial, authorName: string) => {
    const allShared = getSharedMaterials();
    // Check duplication
    if (allShared.some(s => s.id === material.id)) return;

    const newShared: SharedMaterial = {
        ...material,
        sharedAt: new Date().toISOString(),
        downloads: 0,
        likes: 0,
        originalAuthor: authorName
    };
    
    localStorage.setItem(LS_SHARED_KEY, JSON.stringify([newShared, ...allShared]));
};

export const importSharedMaterial = (material: SharedMaterial, targetMonth: number | string, targetTopicId: string) => {
    // 1. Increment download count
    const allShared = getSharedMaterials();
    const updatedShared = allShared.map(s => s.id === material.id ? { ...s, downloads: s.downloads + 1 } : s);
    localStorage.setItem(LS_SHARED_KEY, JSON.stringify(updatedShared));

    // 2. Save to my custom materials
    // Create a copy to dissociate from shared stats
    const myCopy: OccasionMaterial = {
        id: `imported-${generateUUID()}`,
        title: material.title,
        types: material.types,
        thumbnailUrl: material.thumbnailUrl,
        topic: material.topic,
        author: `${material.originalAuthor} (공유됨)`,
        link: material.link,
        notebookLM: material.notebookLM
    };
    
    saveCustomMaterial(targetMonth, targetTopicId, myCopy);
};

// --- Static Data ---
const OCCASION_DB: Record<number, OccasionTopic[]> = {
  3: [
    {
      id: 'topic-3-1', day: 1, title: '삼일절', description: '1919년 3월 1일, 대한독립만세를 외친 그날의 함성',
      materials: [
        { id: 'm-3-1-1', title: '[역사채널e] 그날의 함성, 3.1운동', types: ['영상'], thumbnailUrl: 'https://images.unsplash.com/photo-1575399539227-2c13e45903b7?auto=format&fit=crop&w=600&q=80', topic: '독립운동', author: 'EBS History', link: 'https://www.youtube.com/results?search_query=3.1운동+교육영상' },
      ]
    },
    { id: 'topic-3-22', day: 22, title: '세계 물의 날', description: '물의 소중함을 되새기는 날', materials: [] }
  ],
  4: [
    { id: 'topic-4-5', day: 5, title: '식목일', description: '지구를 위해 나무를 심어요', materials: [] },
    { id: 'topic-4-16', day: 16, title: '국민 안전의 날', description: '안전한 대한민국, 잊지 않겠습니다', materials: [] },
    { id: 'topic-4-21', day: 21, title: '과학의 날', description: '상상이 현실이 되는 과학의 세계', materials: [] }
  ],
  5: [
    { id: 'topic-5-5', day: 5, title: '어린이날', description: '어린이가 행복한 세상', materials: [] },
    { id: 'topic-5-8', day: 8, title: '어버이날', description: '낳아주시고 길러주신 부모님께 감사해요', materials: [] },
    { id: 'topic-5-15', day: 15, title: '스승의 날', description: '선생님의 가르침과 사랑에 감사합니다', materials: [] }
  ],
  6: [
    { id: 'topic-6-6', day: 6, title: '현충일', description: '나라를 위해 목숨 바친 분들을 기립니다', materials: [] },
    { id: 'topic-6-25', day: 25, title: '6.25 전쟁', description: '잊지 말아야 할 아픈 역사', materials: [] }
  ],
  7: [
    { id: 'topic-7-17', day: 17, title: '제헌절', description: '대한민국 헌법이 만들어진 것을 기념하는 날', materials: [] }
  ],
  8: [
    { id: 'topic-8-15', day: 15, title: '광복절', description: '빛을 되찾은 날, 대한독립만세!', materials: [] }
  ],
  9: [],
  10: [
    { id: 'topic-10-3', day: 3, title: '개천절', description: '하늘이 열린 날, 우리 민족의 시작', materials: [] },
    { id: 'topic-10-9', day: 9, title: '한글날', description: '세종대왕이 만든 위대한 글자', materials: [] },
    { id: 'topic-10-25', day: 25, title: '독도의 날', description: '독도는 우리 땅', materials: [] }
  ],
  11: [
    { id: 'topic-11-11', day: 11, title: '농업인의 날', description: '우리 농산물을 사랑해요', materials: [] }
  ],
  12: [
    { id: 'topic-12-25', day: 25, title: '크리스마스', description: '사랑과 나눔의 기쁨을 함께해요', materials: [] }
  ],
  1: [], 2: []
};

const COMMON_OCCASION_DB: CommonOccasionTopic[] = [
    { id: 'common-ict', title: '정보통신활용교육', description: '올바른 정보 활용과 디지털 예절', materials: [] },
    { id: 'common-env', title: '환경지속가능발전교육', description: '지구를 지키는 작은 실천', materials: [] },
    { id: 'common-saf', title: '안전교육', description: '나를 지키는 안전 수칙', materials: [] },
    { id: 'common-car', title: '진로교육', description: '나의 꿈을 찾아서', materials: [] },
    { id: 'common-mul', title: '다문화교육', description: '다름을 존중하고 함께하는 우리', materials: [] }
];

// --- Getters with Merge Logic ---

export const getOccasionData = (month: number): OccasionTopic[] => {
  const staticData = OCCASION_DB[month] || [];
  const customMaterials = getStoredCustomMaterials();
  const hidden = getHiddenIds();

  return staticData.map(topic => {
      const key = `${month}-${topic.id}`;
      const custom = customMaterials[key] || [];
      return {
          ...topic,
          materials: [...custom, ...topic.materials].filter(m => !hidden.includes(m.id))
      };
  });
};

export const getCommonOccasionData = (): CommonOccasionTopic[] => {
    const customMaterials = getStoredCustomMaterials();
    const hidden = getHiddenIds();
    return COMMON_OCCASION_DB.map(topic => {
        const key = `common-${topic.id}`;
        const custom = customMaterials[key] || [];
        return {
            ...topic,
            materials: [...custom, ...topic.materials].filter(m => !hidden.includes(m.id))
        };
    });
}

export const getAcademicMonths = (): number[] => {
  return [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2];
};
