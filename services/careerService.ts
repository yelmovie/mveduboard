import { Career, IntelligenceInfo, IntelligenceType } from '../types';
import { BookOpen, Calculator, Palette, Dumbbell, Music, Users, Brain, Leaf } from 'lucide-react';

// 1. One Source of Truth: Multiple Intelligences Definitions
export const INTELLIGENCE_DATA: Record<IntelligenceType, IntelligenceInfo> = {
  linguistic: {
    type: 'linguistic',
    name: '언어지능',
    description: '말과 글을 잘 사용하고, 이야기를 좋아해요.',
    traits: ['책 읽기', '글쓰기', '발표하기'],
  },
  logical: {
    type: 'logical',
    name: '논리수학지능',
    description: '숫자와 규칙을 다루는 것을 좋아하고, 논리적으로 생각해요.',
    traits: ['수학 문제', '실험', '추리'],
  },
  spatial: {
    type: 'spatial',
    name: '공간지능',
    description: '그림 그리기, 만들기, 공간을 꾸미는 것을 좋아해요.',
    traits: ['그림', '블록 조립', '지도 보기'],
  },
  bodily: {
    type: 'bodily',
    name: '신체운동지능',
    description: '몸을 움직이는 활동을 잘하고, 손재주가 좋아요.',
    traits: ['달리기', '춤추기', '만들기'],
  },
  musical: {
    type: 'musical',
    name: '음악지능',
    description: '리듬과 멜로디에 민감하고, 음악을 즐겨요.',
    traits: ['노래하기', '악기 연주', '음악 감상'],
  },
  interpersonal: {
    type: 'interpersonal',
    name: '대인관계지능',
    description: '친구들의 마음을 잘 이해하고, 함께하는 것을 좋아해요.',
    traits: ['대화하기', '도와주기', '리더십'],
  },
  intrapersonal: {
    type: 'intrapersonal',
    name: '개인이해지능',
    description: '나 자신에 대해 깊이 생각하고, 목표를 세워 실천해요.',
    traits: ['일기 쓰기', '계획하기', '성찰'],
  },
  naturalist: {
    type: 'naturalist',
    name: '자연친화지능',
    description: '동물과 식물을 사랑하고, 자연을 관찰하는 것을 좋아해요.',
    traits: ['동물 돌보기', '식물 키우기', '환경 보호'],
  },
};

// 2. Job Database Mapped to Intelligences
export const CAREER_DB: Career[] = [
  // Linguistic
  { id: 'l1', name: '작가', intelligence: 'linguistic', description: '재미있는 이야기를 글로 써요.', icon: '✍️' },
  { id: 'l2', name: '기자', intelligence: 'linguistic', description: '세상의 소식을 전해줘요.', icon: '📰' },
  { id: 'l3', name: '아나운서', intelligence: 'linguistic', description: '방송에서 말을 조리 있게 해요.', icon: '🎤' },
  
  // Logical
  { id: 'm1', name: '과학자', intelligence: 'logical', description: '새로운 사실을 연구하고 발견해요.', icon: '🔬' },
  { id: 'm2', name: '프로그래머', intelligence: 'logical', description: '컴퓨터 언어로 프로그램을 만들어요.', icon: '💻' },
  { id: 'm3', name: '발명가', intelligence: 'logical', description: '생활을 편리하게 하는 물건을 만들어요.', icon: '💡' },

  // Spatial
  { id: 's1', name: '건축가', intelligence: 'spatial', description: '멋진 건물을 디자인하고 지어요.', icon: '🏗️' },
  { id: 's2', name: '디자이너', intelligence: 'spatial', description: '옷, 로고, 제품 등을 예쁘게 꾸며요.', icon: '🎨' },
  { id: 's3', name: '웹툰작가', intelligence: 'spatial', description: '그림으로 이야기를 전달해요.', icon: '🖌️' },

  // Bodily
  { id: 'b1', name: '운동선수', intelligence: 'bodily', description: '몸을 단련해 경기에 나가요.', icon: '⚽' },
  { id: 'b2', name: '무용가', intelligence: 'bodily', description: '춤으로 감정을 표현해요.', icon: '💃' },
  { id: 'b3', name: '소방관', intelligence: 'bodily', description: '위험한 곳에서 사람들을 구해요.', icon: '🚒' },

  // Musical
  { id: 'mu1', name: '가수', intelligence: 'musical', description: '목소리로 노래를 불러요.', icon: '🎤' },
  { id: 'mu2', name: '작곡가', intelligence: 'musical', description: '아름다운 음악을 만들어요.', icon: '🎼' },
  { id: 'mu3', name: '연주자', intelligence: 'musical', description: '악기를 멋지게 연주해요.', icon: '🎻' },

  // Interpersonal
  { id: 'p1', name: '초등교사', intelligence: 'interpersonal', description: '학생들을 가르치고 도와줘요.', icon: '🏫' },
  { id: 'p2', name: '상담사', intelligence: 'interpersonal', description: '고민을 들어주고 해결을 도와요.', icon: '💬' },
  { id: 'p3', name: '경찰관', intelligence: 'interpersonal', description: '시민의 안전을 지켜줘요.', icon: '👮' },

  // Intrapersonal
  { id: 'in1', name: '심리학자', intelligence: 'intrapersonal', description: '마음의 원리를 연구해요.', icon: '🧠' },
  { id: 'in2', name: 'CEO (경영자)', intelligence: 'intrapersonal', description: '회사의 목표를 세우고 이끌어요.', icon: '👔' },
  { id: 'in3', name: '작가(에세이)', intelligence: 'intrapersonal', description: '자신의 생각을 글로 표현해요.', icon: '📝' },

  // Naturalist
  { id: 'n1', name: '수의사', intelligence: 'naturalist', description: '아픈 동물을 치료해줘요.', icon: '🐶' },
  { id: 'n2', name: '환경연구원', intelligence: 'naturalist', description: '지구를 깨끗하게 지켜요.', icon: '🌍' },
  { id: 'n3', name: '요리사', intelligence: 'naturalist', description: '자연의 재료로 맛있는 음식을 만들어요.', icon: '🍳' },
];

// Helper: Shuffle array
const shuffle = <T>(array: T[]): T[] => {
  return array.sort(() => Math.random() - 0.5);
};

// Start Tournament: Pick 16 random careers (2 from each category if possible, or fully random but ensuring variety)
// For this MVP, we will try to pick 16 distinct ones randomly to simulate a "World Cup" feel.
export const startTournament = (count: number = 16): Career[] => {
  const shuffled = shuffle([...CAREER_DB]);
  return shuffled.slice(0, count);
};

export const getRelatedCareers = (type: IntelligenceType, excludeId: string): Career[] => {
  return CAREER_DB.filter(c => c.intelligence === type && c.id !== excludeId);
};
