
import { MangaTask, MangaEpisode, MangaPanel, MangaLayout, MangaComment } from '../types';
import { generateText, getOpenAIApiKey } from './openaiClient';
import { generateUUID } from '../src/utils/uuid';

const LS_KEYS = {
  TASKS: 'edu_manga_tasks',
  EPISODES: 'edu_manga_episodes',
  INIT: 'edu_manga_initialized'
};

const initializeManga = () => {
    if (!localStorage.getItem(LS_KEYS.INIT)) {
        const taskId = generateUUID();
        
        const task: MangaTask = {
            id: taskId,
            title: '나의 주말 이야기',
            description: '주말에 있었던 즐거운 일을 만화로 그려보세요.',
            allowSerials: false,
            isActive: true,
            createdAt: new Date().toISOString()
        };

        const episode: MangaEpisode = {
            id: generateUUID(),
            taskId: taskId,
            studentId: 'student-1',
            studentName: '김민수',
            episodeNumber: 1,
            layout: 4,
            panels: [
                { index: 0, type: 'ai', imageUrl: 'https://picsum.photos/seed/manga1/400/400', dialogue: '일요일 아침, 날씨가 정말 좋았다.', speechBubbles: [] },
                { index: 1, type: 'ai', imageUrl: 'https://picsum.photos/seed/manga2/400/400', dialogue: '친구들과 축구를 하러 나갔다.', speechBubbles: [] },
                { index: 2, type: 'ai', imageUrl: 'https://picsum.photos/seed/manga3/400/400', dialogue: '열심히 뛰었더니 땀이 뻘뻘 났다.', speechBubbles: [] },
                { index: 3, type: 'ai', imageUrl: 'https://picsum.photos/seed/manga4/400/400', dialogue: '시원한 아이스크림을 먹으니 행복했다!', speechBubbles: [] }
            ],
            status: 'approved',
            likes: 5,
            comments: [
                { id: 'c1', author: '이영희', content: '그림이 너무 귀여워!', createdAt: new Date().toISOString() }
            ],
            createdAt: new Date().toISOString()
        };

        localStorage.setItem(LS_KEYS.TASKS, JSON.stringify([task]));
        localStorage.setItem(LS_KEYS.EPISODES, JSON.stringify([episode]));
        localStorage.setItem(LS_KEYS.INIT, 'true');
    }
}

// --- Tasks (Teacher) ---

export const getTasks = (): MangaTask[] => {
  initializeManga();
  const stored = localStorage.getItem(LS_KEYS.TASKS);
  return stored ? JSON.parse(stored) : [];
};

export const createTask = (title: string, description: string, serials: boolean): MangaTask => {
  const tasks = getTasks();
  const newTask: MangaTask = {
    id: generateUUID(),
    title,
    description,
    allowSerials: serials,
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(LS_KEYS.TASKS, JSON.stringify([...tasks, newTask]));
  return newTask;
};

export const deleteTask = (taskId: string) => {
    const tasks = getTasks();
    localStorage.setItem(LS_KEYS.TASKS, JSON.stringify(tasks.filter(t => t.id !== taskId)));
    const episodes = getEpisodes();
    localStorage.setItem(LS_KEYS.EPISODES, JSON.stringify(episodes.filter(e => e.taskId !== taskId)));
};

// --- Episodes (Student/Gallery) ---

export const getEpisodes = (): MangaEpisode[] => {
  const stored = localStorage.getItem(LS_KEYS.EPISODES);
  const episodes = stored ? JSON.parse(stored) : [];
  // Migration support for old data without comments or layout
  return episodes.map((e: any) => ({
      ...e,
      layout: e.layout || 4,
      comments: e.comments || [],
      panels: (e.panels || []).map((panel: any) => ({
        ...panel,
        speechBubbles: (panel.speechBubbles || []).map((bubble: any) => ({
          width: 30,
          height: 15,
          borderColor: '#1F2937',
          borderWidth: 2,
          ...bubble,
        })),
      })),
  }));
};

export const getTaskEpisodes = (taskId: string): MangaEpisode[] => {
  return getEpisodes().filter(e => e.taskId === taskId);
};

export const submitEpisode = (
  taskId: string,
  studentId: string,
  studentName: string,
  episodeNum: number,
  layout: MangaLayout,
  panels: MangaPanel[],
  isTeacher: boolean = false
): MangaEpisode => {
  const episodes = getEpisodes();
  const newEpisode: MangaEpisode = {
    id: generateUUID(),
    taskId,
    studentId,
    studentName,
    episodeNumber: episodeNum,
    layout,
    panels,
    status: isTeacher ? 'approved' : 'pending', // Teachers bypass approval
    likes: 0,
    comments: [],
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(LS_KEYS.EPISODES, JSON.stringify([...episodes, newEpisode]));
  return newEpisode;
};

export const updateEpisodeStatus = (episodeId: string, status: 'approved' | 'revision', feedback?: string) => {
  const episodes = getEpisodes();
  const updated = episodes.map(e => {
    if (e.id === episodeId) {
      return { ...e, status, feedback };
    }
    return e;
  });
  localStorage.setItem(LS_KEYS.EPISODES, JSON.stringify(updated));
};

export const toggleLike = (episodeId: string) => {
    const episodes = getEpisodes();
    const updated = episodes.map(e => e.id === episodeId ? {...e, likes: e.likes + 1} : e);
    localStorage.setItem(LS_KEYS.EPISODES, JSON.stringify(updated));
}

// --- Comments ---

export const addComment = (episodeId: string, author: string, content: string): MangaComment => {
    const episodes = getEpisodes();
    const newComment: MangaComment = {
        id: generateUUID(),
        author,
        content,
        createdAt: new Date().toISOString()
    };

    const updated = episodes.map(e => {
        if (e.id === episodeId) {
            return { ...e, comments: [...e.comments, newComment] };
        }
        return e;
    });
    localStorage.setItem(LS_KEYS.EPISODES, JSON.stringify(updated));
    return newComment;
}

// --- AI Services (Gemini) ---

export const generateAiImage = async (prompt: string): Promise<string> => {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
      throw new Error('OPENAI_API_KEY_REQUIRED');
  }

  try {
      const keywordPrompt = `
        Create 4-6 short English keywords for a kid-friendly comic-style scene.
        Include one or two simple objects and one emotion. Comma-separated.
        Scene context: ${prompt}
      `;
      const keywordText = await generateText(keywordPrompt, { maxTokens: 80 });
      const keywords = keywordText
        .split(/[,|\n]+/)
        .map(word => word.trim())
        .filter(Boolean)
        .slice(0, 6)
        .join(',');

      const query = encodeURIComponent(keywords || 'kids,illustration,comic,smile');
      return `https://source.unsplash.com/400x400/?${query}`;
  } catch (e) {
      console.error(e);
      throw new Error('OPENAI_IMAGE_GENERATION_FAILED');
  }
};

const HINTS = [
  "주인공의 표정을 더 크게 그려서 감정을 보여주면 어떨까요?",
  "이 장면에서 갈등이 드러나면 이야기가 더 흥미로워져요.",
  "말풍선 대신 행동으로 보여줄 수 있는 부분은 없나요?",
  "다음 장면이 궁금해지게 끝내보세요!",
  "배경을 조금 더 자세히 묘사하면 분위기가 살아날 것 같아요.",
  "등장인물의 성격이 드러나는 대사를 넣어보세요.",
  "반전이 있는 장면인가요? 강조선을 넣어보세요!"
];

export const getAssistantHint = async (): Promise<string> => {
  await new Promise(resolve => setTimeout(resolve, 800));
  return HINTS[Math.floor(Math.random() * HINTS.length)];
};
