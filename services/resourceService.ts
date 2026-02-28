import { generateUUID } from '../src/utils/uuid';

// Types for Footer Resources

export interface CommunityPost {
  id: string;
  title: string;
  content: string;
  author: string;
  tag: string;
  likes: number;
  comments: number;
  createdAt: string;
}

export interface MaterialItem {
  id: string;
  title: string;
  type: string; // PDF, PPT, HWP, IMG, etc.
  size: string;
  downloadCount: number;
  createdAt: string;
  fileData?: string; // Optional: Base64 for small files (demo purpose)
}

const LS_KEYS = {
  COMMUNITY: 'edu_footer_community',
  MATERIALS: 'edu_footer_materials',
  INIT: 'edu_footer_initialized'
};

const INITIAL_POSTS: CommunityPost[] = [
  { id: 'p1', title: '학급 규칙 정하기 팁 공유합니다!', author: '햇살반쌤', content: '아이들과 함께 규칙을 정하니 책임감이 더 생기는 것 같아요.', tag: '학급경영', likes: 45, comments: 12, createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'p2', title: '이번 주 미술 수업 도안 자료 (고학년용)', author: '미술조아', content: '젠탱글 도안입니다. 파일 첨부해요.', tag: '수업자료', likes: 128, comments: 34, createdAt: new Date(Date.now() - 172800000).toISOString() },
  { id: 'p3', title: '현장체험학습 가정통신문 예시입니다.', author: '부장님', content: '수정해서 사용하세요.', tag: '서식', likes: 56, comments: 8, createdAt: new Date(Date.now() - 250000000).toISOString() },
  { id: 'p4', title: '아이들이 싸웠을 때 어떻게 지도하시나요?', author: '신규교사', content: '서로 사과하게 하는 게 너무 어려워요.', tag: 'Q&A', likes: 23, comments: 15, createdAt: new Date(Date.now() - 300000000).toISOString() },
  { id: 'p5', title: '빙고 게임 단어 목록 모음집', author: '게임왕', content: '주제별로 정리했습니다.', tag: '놀이', likes: 89, comments: 22, createdAt: new Date(Date.now() - 400000000).toISOString() },
];

const INITIAL_MATERIALS: MaterialItem[] = [
  { id: 'm1', title: '3학년 1학기 사회 핵심 요약 PPT', type: 'PPT', size: '12MB', downloadCount: 120, createdAt: new Date().toISOString() },
  { id: 'm2', title: '환경 교육 활동지 모음 (저학년)', type: 'PDF', size: '5MB', downloadCount: 85, createdAt: new Date().toISOString() },
  { id: 'm3', title: '과학 실험 보고서 양식', type: 'HWP', size: '1MB', downloadCount: 230, createdAt: new Date().toISOString() },
  { id: 'm4', title: '영어 단어 카드 (음식, 동물)', type: 'PDF', size: '8MB', downloadCount: 45, createdAt: new Date().toISOString() },
  { id: 'm5', title: '학급 회장 선거 포스터 도안', type: 'IMG', size: '15MB', downloadCount: 67, createdAt: new Date().toISOString() },
  { id: 'm6', title: '역사 연표 만들기 키트', type: 'PDF', size: '20MB', downloadCount: 12, createdAt: new Date().toISOString() },
];

const initialize = () => {
    if (!localStorage.getItem(LS_KEYS.INIT)) {
        localStorage.setItem(LS_KEYS.COMMUNITY, JSON.stringify(INITIAL_POSTS));
        localStorage.setItem(LS_KEYS.MATERIALS, JSON.stringify(INITIAL_MATERIALS));
        localStorage.setItem(LS_KEYS.INIT, 'true');
    }
}

// --- Community Service ---

export const getPosts = (): CommunityPost[] => {
    initialize();
    const stored = localStorage.getItem(LS_KEYS.COMMUNITY);
    return stored ? JSON.parse(stored) : [];
};

export const addPost = (title: string, content: string, tag: string, author: string): CommunityPost => {
    const posts = getPosts();
    const newPost: CommunityPost = {
        id: generateUUID(),
        title,
        content,
        author,
        tag,
        likes: 0,
        comments: 0,
        createdAt: new Date().toISOString()
    };
    localStorage.setItem(LS_KEYS.COMMUNITY, JSON.stringify([newPost, ...posts]));
    return newPost;
};

export const toggleLike = (id: string) => {
    const posts = getPosts();
    const updated = posts.map(p => p.id === id ? { ...p, likes: p.likes + 1 } : p);
    localStorage.setItem(LS_KEYS.COMMUNITY, JSON.stringify(updated));
};

// --- Material Service ---

export const getMaterials = (): MaterialItem[] => {
    initialize();
    const stored = localStorage.getItem(LS_KEYS.MATERIALS);
    return stored ? JSON.parse(stored) : [];
};

export const uploadMaterial = (file: File): MaterialItem => {
    const materials = getMaterials();
    
    // Simulate file size string
    const size = (file.size / (1024 * 1024)).toFixed(1) + 'MB';
    const type = file.name.split('.').pop()?.toUpperCase() || 'FILE';

    const newItem: MaterialItem = {
        id: generateUUID(),
        title: file.name,
        type,
        size,
        downloadCount: 0,
        createdAt: new Date().toISOString()
    };

    localStorage.setItem(LS_KEYS.MATERIALS, JSON.stringify([newItem, ...materials]));
    return newItem;
};

export const increaseDownloadCount = (id: string) => {
    const materials = getMaterials();
    const updated = materials.map(m => m.id === id ? { ...m, downloadCount: m.downloadCount + 1 } : m);
    localStorage.setItem(LS_KEYS.MATERIALS, JSON.stringify(updated));
}
