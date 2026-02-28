
import { Board, Post, Comment, Participant, PostStatus } from '../types';
import { logBetaEvent } from '../src/lib/supabase/events';
import { MOCK_BOARD, INITIAL_POSTS, INITIAL_COMMENTS, BANNED_WORDS } from '../constants';
import { WRITING_TOPIC_LS_KEY } from '../src/constants/writing';
import { generateUUID } from '../src/utils/uuid';

// Keys for LocalStorage
const LS_KEYS = {
  BOARD: 'edu_board_data',
  POSTS: 'edu_posts_data',
  COMMENTS: 'edu_comments_data',
  SESSION: 'edu_participant_session',
};

const safeParseJson = <T,>(raw: string | null, fallback: T, onError?: () => void): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    onError?.();
    return fallback;
  }
};

const trySavePosts = (key: string, posts: Post[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(posts));
    return true;
  } catch {
    return false;
  }
};

// Helper to filter bad words
const filterProfanity = (text: string): string => {
  let filtered = text;
  BANNED_WORDS.forEach(word => {
    const mask = '*'.repeat(word.length);
    filtered = filtered.split(word).join(mask);
  });
  return filtered;
};

const containsBannedWord = (text: string): boolean => {
  const lower = text.toLowerCase();
  return BANNED_WORDS.some(word => lower.includes(word.toLowerCase()));
};

// --- Initial Sample Data for New Boards ---

const getSampleBoardConfig = (boardId: string): Partial<Board> => {
    switch (boardId) {
        case 'writing':
            return {
                id: 'writing',
                title: '주제 글쓰기',
                description: '이번 주 주제: "나의 보물 1호"에 대해 자유롭게 써보세요 💎',
                background: 'paper'
            };
        case 'reading':
            return {
                id: 'reading',
                title: '독서록',
                description: '재미있게 읽은 책을 친구들에게 소개해주세요 📚',
                background: 'sky'
            };
        case 'math':
            return {
                id: 'math',
                title: '수학 오답노트',
                description: '틀린 문제를 다시 풀어보며 실력을 키워요! 🧮 (페이지, 수정여부 체크)',
                background: 'slate'
            };
        case 'learning':
            return {
                id: 'learning',
                title: '배움 노트',
                description: '오늘 수업 시간에 배운 내용을 정리해봅시다 ✏️',
                background: 'cork'
            };
        // 'schedule' removed from here, handled by custom ScheduleApp
        case 'schoolplan':
            return {
                id: 'schoolplan',
                title: '학교 월간 계획',
                description: '이번 달 학교 주요 행사와 일정입니다 🏫',
                background: 'cork',
                layout: 'timeline'
            };
        case 'album':
            return {
                id: 'album',
                title: '우리반 사진첩',
                description: '우리들의 즐거운 추억을 모아보아요 📸',
                background: 'paper',
                layout: 'table'
            };
        case 'gallery':
            return {
                id: 'gallery',
                title: '작품 갤러리',
                description: '미술 시간, 만들기 시간에 만든 멋진 작품들 🎨',
                background: 'slate',
                layout: 'table'
            };
        case 'refine':
            return {
                id: 'refine',
                title: '문장 다듬기 교실',
                description: '어색한 문장을 자연스럽고 바르게 고쳐보아요 ✍️',
                background: 'paper',
                layout: 'table'
            };
        case 'roster':
            return {
                id: 'roster',
                title: '우리반 학급 명부',
                description: '학생 비상연락망 및 기초 조사 자료 (선생님용) 📋',
                background: 'slate',
                layout: 'table'
            };
        case 'handbook':
            return {
                id: 'handbook',
                title: '교무 수첩',
                description: '업무 메모, 회의록, 학급 경영 아이디어 노트 📒',
                background: 'cork',
                layout: 'table'
            };
        case 'notice_board':
            return {
                id: 'notice_board',
                title: '공지사항 게시판',
                description: '선생님이 올린 자료와 공지사항을 확인하고 다운로드할 수 있어요 📌',
                background: 'paper',
                layout: 'table'
            };
        default:
            return MOCK_BOARD;
    }
};

const getSamplePosts = (boardId: string): Post[] => {
    const commonProps = {
        board_id: boardId,
        status: 'approved' as PostStatus,
        likes: 0,
        created_at: new Date().toISOString()
    };

    switch (boardId) {
        case 'writing':
            return [
                { ...commonProps, id: 'w1', author_name: '김철수', title: '나의 보물 1호는?', body: '제 보물 1호는 할머니가 사주신 강아지입니다. 이름은 뽀삐이고 정말 귀엽습니다.', color: 'green', likes: 5 },
                { ...commonProps, id: 'w2', author_name: '이영희', title: '소중한 가족사진', body: '우리 가족이 다 함께 찍은 사진이 제 보물입니다. 볼 때마다 힘이 납니다.', color: 'purple', likes: 3 }
            ];
        case 'reading':
            return [
                { ...commonProps, id: 'r1', author_name: '박민수', title: '홍길동전을 읽고', body: '홍길동이 동에 번쩍 서에 번쩍 하는 모습이 정말 신기하고 멋있었다. 나도 그런 능력이 있었으면 좋겠다.', color: 'blue', likes: 8 },
                { ...commonProps, id: 'r2', author_name: '최지우', title: '마틸다', body: '책을 좋아하는 마틸다가 초능력으로 나쁜 어른들을 혼내주는 내용이 통쾌했다.', color: 'purple', likes: 4 }
            ];
        case 'math':
            return [
                { ...commonProps, id: 'm1', author_name: '정우성', title: '3단원 나눗셈', body: '345 나누기 5를 할 때 자릿수를 맞추는 것을 깜빡해서 틀렸다. 다음에는 세로셈을 할 때 줄을 잘 맞춰야겠다.', color: 'red', likes: 2, math_page_range: 'P.40~41', is_corrected: true },
                { ...commonProps, id: 'm2', author_name: '강다니엘', title: '도형의 이동', body: '도형을 뒤집고 돌리는 것이 헷갈린다. 직접 종이를 오려서 돌려보니까 이해가 잘 되었다.', color: 'yellow', likes: 1, math_page_range: 'P.52', is_corrected: false }
            ];
        case 'learning':
            return [
                { ...commonProps, id: 'l1', author_name: '아이유', title: '오늘의 배움 (사회)', body: '우리 고장의 문화유산에 대해 배웠다. 우리 동네에 이렇게 오래된 문화재가 있는지 몰랐다. 주말에 가보고 싶다.', color: 'orange', likes: 6 },
                { ...commonProps, id: 'l2', author_name: '유재석', title: '과학 실험', body: '자석의 성질을 이용해 나침반을 만들었다. 물에 띄운 바늘이 북쪽을 가리키는 것이 신기했다.', color: 'green', likes: 4 }
            ];
        // 'schedule' removed from here
        case 'schoolplan':
            const today = new Date();
            const y = today.getFullYear();
            const m = String(today.getMonth() + 1).padStart(2, '0');
            return [
                { ...commonProps, id: 'sp1', author_name: '선생님', title: '현장체험학습', body: '장소: 국립중앙박물관\n준비물: 도시락, 물', event_date: `${y}-${m}-15`, color: 'green', sticker: '🚌', likes: 20 },
                { ...commonProps, id: 'sp2', author_name: '선생님', title: '학부모 공개수업', body: '2교시: 국어\n3교시: 수학', event_date: `${y}-${m}-20`, color: 'orange', sticker: '👨‍👩‍👧‍👦', likes: 10 },
                { ...commonProps, id: 'sp3', author_name: '선생님', title: '생일파티', body: '이번 달 생일인 친구들을 축하해줘요!', event_date: `${y}-${m}-28`, color: 'pink', sticker: '🎂', likes: 15 }
            ];
        case 'album':
            return [
                { ...commonProps, id: 'a1', author_name: '선생님', title: '봄 체육대회', body: '줄다리기 영차영차!', attachment_url: 'https://picsum.photos/id/1015/400/300', attachment_type: 'image', color: 'white', likes: 25 },
                { ...commonProps, id: 'a2', author_name: '김민지', title: '급식실 가는 길', body: '벚꽃이 예뻐서 찍었어요', attachment_url: 'https://picsum.photos/id/1016/400/300', attachment_type: 'image', color: 'pink', likes: 12 },
                { ...commonProps, id: 'a3', author_name: '선생님', title: '과학 만들기 수업', body: '다들 정말 집중했네요', attachment_url: 'https://picsum.photos/id/1018/400/300', attachment_type: 'image', color: 'green', likes: 18 }
            ];
        case 'gallery':
            return [
                { ...commonProps, id: 'g1', author_name: '최지우', title: '지점토로 만든 컵', body: '물감을 칠해서 알록달록하게 꾸몄어요.', attachment_url: 'https://picsum.photos/id/104/400/300', attachment_type: 'image', color: 'white', likes: 8 },
                { ...commonProps, id: 'g2', author_name: '강다니엘', title: '상상 속 동물', body: '날개 달린 사자입니다.', attachment_url: 'https://picsum.photos/id/106/400/300', attachment_type: 'image', color: 'yellow', likes: 6 },
                { ...commonProps, id: 'g3', author_name: '아이유', title: '수채화 풍경', body: '우리 학교 운동장을 그렸습니다.', attachment_url: 'https://picsum.photos/id/10/400/300', attachment_type: 'image', color: 'blue', likes: 10 }
            ];
        case 'refine':
            return [
                { ...commonProps, id: 'rf1', author_name: '선생님', title: '연습문제 1', body: '다음 문장을 자연스럽게 고쳐보세요:\n"나는 밥을 먹고 학교에 가서 공부를 하고 밥을 먹었다."', color: 'white', likes: 2 },
                { ...commonProps, id: 'rf2', author_name: '선생님', title: '연습문제 2', body: '어색한 부분을 찾아보세요:\n"어제 비가 와서 우산을 쓰고 갔는데 비가 그쳐서 우산을 잃어버렸다."', color: 'yellow', likes: 1 }
            ];
        case 'roster':
            return [
                { ...commonProps, id: 'rost1', author_name: '선생님', title: '전체 학생 명단', body: '1. 권도훈\n2. 김강후\n3. 김나현\n4. 김다윤\n5. 김보아\n6. 김수정\n7. 김시형\n8. 김은율\n9. 김주신\n10. 김지유\n11. 남승재\n12. 박수빈\n13. 박주한\n14. 박하준\n15. 반지원\n16. 배윤호\n17. 유민선\n18. 이가연\n19. 이가율\n20. 이도연', color: 'blue', likes: 0 },
                { ...commonProps, id: 'rost2', author_name: '선생님', title: '특이사항 메모', body: '1. 권도훈: 우유 알레르기 있음\n4. 김다윤: 안경 착용 (앞자리 선호)\n15. 반지원: 방과후 영어(월,수)', color: 'red', likes: 0 }
            ];
        case 'handbook':
            return [
                { ...commonProps, id: 'hb1', author_name: '선생님', title: '3월 학급 경영 목표', body: '1. 서로 존중하는 말 사용하기\n2. 1인 1역 책임감 있게 수행하기\n3. 등교 시간 잘 지키기', color: 'green', likes: 0 },
                { ...commonProps, id: 'hb2', author_name: '선생님', title: '학부모 상담 주간 일정', body: '기간: 3월 20일 ~ 3월 24일\n방식: 전화 상담 및 방문 상담', color: 'orange', likes: 0 }
            ];
        default:
            return INITIAL_POSTS;
    }
};

// --- Mock API Services ---

export const getBoard = async (boardId: string = 'board'): Promise<Board> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));
  const normalizeWritingTopic = (value: string) => {
    const trimmed = value.trim();
    const splitIndex = trimmed.indexOf(' - ');
    return splitIndex >= 0 ? trimmed.slice(splitIndex + 3) : trimmed;
  };
  
  const key = `${LS_KEYS.BOARD}_${boardId}`;
  const stored = localStorage.getItem(key);
  
  if (!stored) {
    // If not exists, create with sample config
    const sampleConfig = getSampleBoardConfig(boardId);
    const newBoard: Board = {
        ...MOCK_BOARD,
        ...sampleConfig,
        id: boardId // Ensure ID matches
    };
    localStorage.setItem(key, JSON.stringify(newBoard));
    if (boardId === 'writing') {
      const currentTopic = localStorage.getItem(WRITING_TOPIC_LS_KEY);
      if (currentTopic) {
        const normalized = normalizeWritingTopic(currentTopic);
        return { ...newBoard, description: `이번 주 주제: "${normalized}"에 대해 자유롭게 써보세요 💎` };
      }
    }
    return newBoard;
  }
  const parsed = safeParseJson<Board>(stored, {
    ...MOCK_BOARD,
    ...getSampleBoardConfig(boardId),
    id: boardId,
  }, () => {
    localStorage.removeItem(key);
  });
  if (boardId === 'writing') {
    const currentTopic = localStorage.getItem(WRITING_TOPIC_LS_KEY);
    if (currentTopic) {
      const normalized = normalizeWritingTopic(currentTopic);
      return { ...parsed, description: `이번 주 주제: "${normalized}"에 대해 자유롭게 써보세요 💎` };
    }
  }
  return parsed;
};

export const updateBoardSettings = async (board: Board, boardId: string = 'board'): Promise<Board> => {
  const key = `${LS_KEYS.BOARD}_${boardId}`;
  localStorage.setItem(key, JSON.stringify(board));
  return board;
};

export const joinBoard = async (code: string, nickname: string): Promise<Participant | null> => {
  // Join code verification is skipped/simplified for new boards to allow easy demo
  // In real app, each board would have specific code or centralized class code
  if (code !== '123456') {
    throw new Error('참여 코드가 올바르지 않습니다.');
  }

  const newParticipant: Participant = {
    id: generateUUID(),
    nickname,
    session_hash: generateUUID(),
  };
  
  // Persist session locally
  localStorage.setItem(LS_KEYS.SESSION, JSON.stringify(newParticipant));
  return newParticipant;
};

export const getStoredParticipant = (): Participant | null => {
  const stored = localStorage.getItem(LS_KEYS.SESSION);
  return stored ? JSON.parse(stored) : null;
};

export const logoutParticipant = () => {
  localStorage.removeItem(LS_KEYS.SESSION);
};

export const getPosts = async (boardId: string): Promise<Post[]> => {
  const key = `${LS_KEYS.POSTS}_${boardId}`;
  const stored = localStorage.getItem(key);
  
  if (!stored) {
    const samples = getSamplePosts(boardId);
    localStorage.setItem(key, JSON.stringify(samples));
    return samples;
  }
  const parsed = safeParseJson<Post[]>(stored, [], () => {
    localStorage.removeItem(key);
  });
  if (!Array.isArray(parsed)) {
    const samples = getSamplePosts(boardId);
    localStorage.setItem(key, JSON.stringify(samples));
    return samples;
  }
  return parsed;
};

export const createPost = async (
  postData: Omit<Post, 'id' | 'created_at' | 'likes' | 'status'>,
  isTeacher: boolean
): Promise<Post> => {
  const posts = await getPosts(postData.board_id);
  const newPost: Post = {
    ...postData,
    id: generateUUID(),
    created_at: new Date().toISOString(),
    likes: 0,
    status: isTeacher ? 'approved' : 'pending', // Logic: Teacher auto-approves, student pending
    color: postData.color || 'white',
    // Ensure math fields are passed if present
    math_page_range: postData.math_page_range,
    is_corrected: postData.is_corrected || false,
  };
  
  const updatedPosts = [...posts, newPost];
  const key = `${LS_KEYS.POSTS}_${postData.board_id}`;

  if (!trySavePosts(key, updatedPosts)) {
      console.error("Storage full");
      const hasAttachment = Boolean(
        (newPost.attachment_url || (newPost.attachment_urls && newPost.attachment_urls.length > 0)) &&
        newPost.attachment_type
      );
      if (hasAttachment) {
          alert("저장 공간이 부족하여 이미지는 제외하고 텍스트만 저장됩니다. 😢");
          newPost.attachment_url = undefined;
          newPost.attachment_urls = undefined;
          newPost.attachment_type = undefined;
      }

      const fallbackPosts = [...posts, newPost];
      if (!trySavePosts(key, fallbackPosts)) {
          // As a last resort, remove oldest posts until we can save
          let compact = [...fallbackPosts];
          let removed = 0;
          while (compact.length > 0) {
              compact.shift();
              removed += 1;
              if (trySavePosts(key, compact)) {
                  alert(`저장 공간이 부족하여 오래된 게시물 ${removed}개를 정리하고 저장했어요.`);
                  break;
              }
          }

          if (compact.length === 0) {
              alert("저장 공간이 너무 부족하여 게시물을 저장할 수 없습니다.");
              throw new Error('storage_full');
          }
      }
  }
  await logBetaEvent('post_created');
  return newPost;
};

export const updatePostStatus = async (postId: string, status: PostStatus, boardId: string = 'board'): Promise<void> => {
  const posts = await getPosts(boardId);
  const updatedPosts = posts.map(p => p.id === postId ? { ...p, status } : p);
  const key = `${LS_KEYS.POSTS}_${boardId}`;
  try {
    localStorage.setItem(key, JSON.stringify(updatedPosts));
  } catch (e) {
    alert("저장 공간 부족으로 상태 변경을 저장할 수 없습니다.");
  }
};

export const deletePost = async (postId: string, boardId: string = 'board'): Promise<void> => {
  const posts = await getPosts(boardId);
  const updatedPosts = posts.filter(p => p.id !== postId);
  const key = `${LS_KEYS.POSTS}_${boardId}`;
  try {
    localStorage.setItem(key, JSON.stringify(updatedPosts));
  } catch (e) {
    alert("저장 공간 부족으로 삭제를 반영할 수 없습니다.");
  }
};

export const toggleLike = async (postId: string): Promise<void> => {
  const knownBoards = ['board', 'writing', 'reading', 'math', 'learning', 'schedule', 'schoolplan', 'album', 'gallery', 'refine', 'roster', 'handbook'];
  
  for (const bid of knownBoards) {
      const key = `${LS_KEYS.POSTS}_${bid}`;
      const stored = localStorage.getItem(key);
      if (stored) {
          const posts: Post[] = JSON.parse(stored);
          const postIndex = posts.findIndex(p => p.id === postId);
          if (postIndex > -1) {
              posts[postIndex].likes += 1;
              try {
                localStorage.setItem(key, JSON.stringify(posts));
              } catch (e) {
                // Silent fail for likes if full
                console.error("Failed to save like due to quota");
              }
              return;
          }
      }
  }
};

export const addSticker = async (postId: string, sticker: string): Promise<void> => {
  const knownBoards = ['board', 'writing', 'reading', 'math', 'learning', 'schedule', 'schoolplan', 'album', 'gallery', 'refine', 'roster', 'handbook'];
  for (const bid of knownBoards) {
      const key = `${LS_KEYS.POSTS}_${bid}`;
      const stored = localStorage.getItem(key);
      if (stored) {
          const posts: Post[] = JSON.parse(stored);
          const postIndex = posts.findIndex(p => p.id === postId);
          if (postIndex > -1) {
              posts[postIndex].sticker = sticker;
              try {
                localStorage.setItem(key, JSON.stringify(posts));
              } catch(e) {
                alert("저장 공간 부족으로 스티커를 붙일 수 없습니다.");
              }
              return;
          }
      }
  }
};

// Toggle "Corrected" Check for Math Board
export const toggleMathCorrection = async (postId: string, boardId: string): Promise<void> => {
    const posts = await getPosts(boardId);
    const updatedPosts = posts.map(p => {
        if (p.id === postId) {
            return { ...p, is_corrected: !p.is_corrected };
        }
        return p;
    });
    
    const key = `${LS_KEYS.POSTS}_${boardId}`;
    try {
        localStorage.setItem(key, JSON.stringify(updatedPosts));
    } catch (e) {
        alert("저장 공간 부족으로 체크 상태를 저장할 수 없습니다.");
    }
}

export const getComments = async (postId: string): Promise<Comment[]> => {
  const stored = localStorage.getItem(LS_KEYS.COMMENTS);
  let allComments: Comment[] = safeParseJson<Comment[]>(stored, INITIAL_COMMENTS, () => {
    localStorage.removeItem(LS_KEYS.COMMENTS);
  });
  if (!stored || !Array.isArray(allComments)) {
    allComments = INITIAL_COMMENTS;
    localStorage.setItem(LS_KEYS.COMMENTS, JSON.stringify(INITIAL_COMMENTS));
  }
  
  return allComments.filter(c => c.post_id === postId).sort((a,b) => a.created_at.localeCompare(b.created_at));
};

export const addComment = async (postId: string, authorName: string, body: string): Promise<Comment> => {
  if (containsBannedWord(body)) {
    throw new Error('비속어/금칙어가 포함되어 있어 댓글을 등록할 수 없어요.');
  }
  const stored = localStorage.getItem(LS_KEYS.COMMENTS);
  const allComments: Comment[] = stored ? JSON.parse(stored) : INITIAL_COMMENTS;

  const newComment: Comment = {
    id: generateUUID(),
    post_id: postId,
    author_name: authorName,
    body: body,
    body_filtered: filterProfanity(body), // Apply filter immediately
    created_at: new Date().toISOString(),
  };

  try {
    localStorage.setItem(LS_KEYS.COMMENTS, JSON.stringify([...allComments, newComment]));
  } catch (e) {
    alert("저장 공간 부족으로 댓글을 등록할 수 없습니다.");
    throw e;
  }
  return newComment;
};

// Stats for chart
export const getBoardStats = async (boardId: string = 'board') => {
    const posts = await getPosts(boardId);
    const approved = posts.filter(p => p.status === 'approved').length;
    const pending = posts.filter(p => p.status === 'pending').length;
    const rejected = posts.filter(p => p.status === 'rejected').length;
    return [
        { name: '승인됨', value: approved, fill: '#4ade80' },
        { name: '대기중', value: pending, fill: '#facc15' },
        { name: '반려됨', value: rejected, fill: '#f87171' },
    ];
}
