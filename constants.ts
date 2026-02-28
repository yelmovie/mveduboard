import { Board, Post, Comment } from './types';

// Simple Korean banned words for demonstration masking
export const BANNED_WORDS = ['바보', '멍청이', '짜증', '싫어', '똥개'];

export const MOCK_BOARD: Board = {
  id: 'board-123',
  title: '3학년 2반 과학 신문 만들기',
  description: '우리 주변의 생물을 관찰하고 기록해봅시다! 📸',
  layout: 'table', // Default to table, can switch to timeline
  join_code: '123456',
  settings: {
    allow_comments: true,
    allow_likes: true,
    allow_download: false,
    require_approval: true,
  },
  background: 'cork',
  created_at: new Date().toISOString(),
};

// Initial Mock Posts
export const INITIAL_POSTS: Post[] = [
  {
    id: 'post-1',
    board_id: 'board-123',
    author_name: '김선생님',
    title: '과제 안내',
    body: '학교 화단에서 봄꽃을 찾아 사진을 찍어 올려주세요.',
    status: 'approved',
    likes: 5,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    event_date: '2023-04-01',
    color: 'white',
    sticker: '📢',
  },
  {
    id: 'post-2',
    board_id: 'board-123',
    author_participant_id: 'student-1',
    author_name: '3-2 민지',
    title: '민들레를 찾았어요',
    body: '노란색 민들레가 정말 예뻐요!',
    status: 'approved',
    likes: 12,
    created_at: new Date(Date.now() - 40000000).toISOString(),
    event_date: '2023-04-02',
    attachment_url: 'https://picsum.photos/400/300',
    attachment_type: 'image',
    color: 'yellow',
    sticker: '💯',
  },
  {
    id: 'post-3',
    board_id: 'board-123',
    author_participant_id: 'student-2',
    author_name: '3-2 철수',
    title: '개미 관찰',
    body: '개미가 줄을 지어 가고 있어요. 신기해요.',
    status: 'pending', // Pending approval
    likes: 0,
    created_at: new Date().toISOString(),
    event_date: '2023-04-03',
    color: 'white',
  }
];

export const INITIAL_COMMENTS: Comment[] = [
  {
    id: 'c-1',
    post_id: 'post-2',
    author_name: '김선생님',
    body: '관찰을 아주 잘 했네요!',
    body_filtered: '관찰을 아주 잘 했네요!',
    created_at: new Date().toISOString(),
  }
];