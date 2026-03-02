
export type UserRole = 'teacher' | 'student' | 'viewer';

export type LayoutType = 'table' | 'timeline';

export type PostStatus = 'pending' | 'approved' | 'rejected';

export type PostColor = 'white' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink';

export interface ClassStudent {
  id: string;
  number: number;
  name: string;
  gender?: 'male' | 'female';
  executiveRole?: 'president' | 'vice';
}

export interface Participant {
  id: string;
  nickname: string;
  session_hash: string;
}

export interface BoardSettings {
  allow_comments: boolean;
  allow_likes: boolean;
  allow_download: boolean;
  require_approval: boolean;
}

export interface Board {
  id: string;
  title: string;
  description: string;
  layout: LayoutType;
  join_code: string;
  settings: BoardSettings;
  created_at: string;
  background?: string; // 'slate' | 'cork' | 'sky' | 'paper'
}

export interface Post {
  id: string;
  board_id: string;
  author_participant_id?: string; // Null if teacher
  author_name: string; // Display name
  title: string;
  body: string;
  event_date?: string; // Required for timeline
  status: PostStatus;
  likes: number;
  created_at: string;
  attachment_url?: string; // Simplified for demo
  attachment_urls?: string[]; // For multi-image posts (album)
  attachment_type?: 'image' | 'video' | 'file';
  color?: PostColor;
  sticker?: string;
  // Math Board Specific
  math_page_range?: string; // e.g. "P.10 ~ 11"
  is_corrected?: boolean; // Checkbox for "Corrected wrong answers"
}

export interface Comment {
  id: string;
  post_id: string;
  author_name: string;
  body: string;
  body_filtered: string; // Masked content
  created_at: string;
}

export interface BannedWord {
  word: string;
}

// --- Chat Types ---

export type ChatRoomType = 'class' | 'group';

export interface ChatUser {
  id: string;
  roomId: string;
  name: string;
  role: 'teacher' | 'student';
  isMuted: boolean; // Teacher can mute specific students
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  text: string;
  type: 'chat' | 'system';
  timestamp: number;
  isHidden?: boolean;
}

export interface ChatRoom {
  id: string;
  code: string;
  type: ChatRoomType;
  isLocked: boolean; // Controls if students can chat
  createdAt: number;
  groupId?: string;
  groupName?: string;
}

export interface ChatGroup {
  id: string;
  name: string;
  code: string;
  memberNames: string[];
}

// --- Notice Types ---

export interface Notice {
  date: string; // YYYY-MM-DD
  content: string;
  updatedAt: string;
}

// --- Lunch Types ---

export interface LunchMenu {
  date: string; // YYYY-MM-DD
  menu: string;
  allergy: string;
}

export interface LunchData {
  updatedAt: string;
  imageUrl?: string; // Original schedule image
  menus: LunchMenu[];
}

// --- Career World Cup Types ---

export type IntelligenceType = 
  | 'linguistic' 
  | 'logical' 
  | 'spatial' 
  | 'bodily' 
  | 'musical' 
  | 'interpersonal' 
  | 'intrapersonal' 
  | 'naturalist';

export interface Career {
  id: string;
  name: string;
  intelligence: IntelligenceType;
  description: string;
  icon?: string; // Generic icon name or emoji
}

export interface IntelligenceInfo {
  type: IntelligenceType;
  name: string; // Korean name (e.g., 언어지능)
  description: string;
  traits: string[];
}

// --- Todo Check Types ---

export type TodoStatus = 'incomplete' | 'done' | 'approved';

export interface TodoTask {
  id: string;
  date: string; // YYYY-MM-DD
  content: string;
  created_at: string;
  isImportant?: boolean; // New: Highlight as pink/must-do
}

export interface TodoRecord {
  id: string;
  task_id: string;
  student_id: string;
  student_name: string;
  status: TodoStatus;
  updated_at: string;
}

// --- Lucky Draw Types ---

export interface DrawState {
  isActive: boolean; // Is the draw screen active?
  result: string[]; // Current winners
  isAnimating: boolean; // Is the animation playing?
  timestamp: number; // For forcing updates
}

// --- Timer Types ---

export type TimerType = 'digital' | 'analog' | 'hourglass' | 'pie' | 'balloon' | 'stopwatch';

export interface TimerState {
  type: TimerType;
  isRunning: boolean;
  totalDuration: number; // in seconds (initial set time)
  remainingTime: number; // in seconds (current snapshot)
  lastUpdated: number; // timestamp for syncing
  isMuted: boolean;
}

export interface PomodoroState {
  status: 'work' | 'rest';
  remaining: number;
  isRunning: boolean;
}

// --- Manga Types ---

export type MangaLayout = 4 | 6 | 8;
export type MangaPanelType = 'ai' | 'draw' | 'photo';
export type MangaStatus = 'pending' | 'approved' | 'revision';

export interface MangaPanel {
  index: number;
  type: MangaPanelType;
  imageUrl?: string;
  dialogue: string;
  aiPrompt?: string; // For reference
  storyboardText?: string; // Planning text
  speechBubbles?: SpeechBubble[];
}

export type SpeechBubbleShape = 'oval' | 'round' | 'rect' | 'cloud';

export interface SpeechBubble {
  id: string;
  text: string;
  shape: SpeechBubbleShape;
  x: number; // percent (0-100)
  y: number; // percent (0-100)
  width: number; // percent (0-100)
  height: number; // percent (0-100)
  tailX: number; // percent (0-100)
  tailY: number; // percent (0-100)
  color: string; // hex
  opacity: number; // 0-1
  borderColor: string; // hex
  borderWidth: number; // px
}

export interface MangaComment {
    id: string;
    author: string;
    content: string;
    createdAt: string;
}

export interface MangaEpisode {
  id: string;
  taskId: string;
  episodeNumber: number;
  studentId: string;
  studentName: string;
  layout: MangaLayout; // Layout chosen by student
  panels: MangaPanel[];
  status: MangaStatus;
  feedback?: string; // Teacher feedback
  likes: number;
  comments: MangaComment[];
  createdAt: string;
}

export interface MangaTask {
  id: string;
  title: string;
  description: string; // "Theme"
  allowSerials: boolean;
  isActive: boolean;
  createdAt: string;
}

// --- Bingo Types ---

export type BingoSize = 3 | 4 | 5 | 6 | 8;
export type BingoGameStatus = 'preparing' | 'playing' | 'ended';

export interface BingoCell {
  index: number;
  text: string;
  isMarked: boolean;
}

export interface BingoPlayer {
  studentId: string;
  studentName: string;
  board: BingoCell[]; // The randomized board for this student
  bingoCount: number; // Number of lines completed
  lastBingoTime?: number; // For showing recent winners
}

export interface BingoGame {
  id: string;
  title: string;
  size: BingoSize;
  words: string[]; // The master list of words provided by teacher
  status: BingoGameStatus;
  isLocked: boolean; // Pause checking/interaction
  createdAt: string;
}

export type BingoRoomStatus = 'draft' | 'open' | 'running' | 'ended';
export type BingoRoomRole = 'host' | 'student';

export interface BingoRoom {
  id: string;
  code: string;
  title: string;
  host_user_id: string | null;
  size: BingoSize;
  words: string[];
  status: BingoRoomStatus;
  revealed_student_id: string | null;
  created_at: string;
}

export interface BingoRoomPlayer {
  id: string;
  room_id: string;
  display_name: string;
  role: BingoRoomRole;
  joined_at: string;
}

export interface BingoRoomBoard {
  id: string;
  room_id: string;
  player_id: string;
  layout: string[];
  marks: boolean[];
  bingo_lines: number;
  submitted: boolean;
  updated_at: string;
}

// --- Seat Picking Types ---

export interface SeatStudent {
  id: string;
  name: string;
}

export interface SeatLayout {
  rows: number;
  cols: number;
  assignments: (SeatStudent | null)[]; // Flat array of grid
  seatMap?: boolean[]; // NEW: Map of active desks vs aisles (true = desk, false = aisle)
  updatedAt: string;
}

// --- Coupon Types ---

export interface Coupon {
  id: string;
  studentName: string;
  type: string; // e.g., "Homework Pass"
  issuedDate: string;
  isUsed: boolean;
}

// --- Meeting Types ---

export type AgendaStatus = 'proposed' | 'discussing' | 'decided';

export interface AgendaComment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface Agenda {
  id: string;
  title: string;
  description: string;
  author: string;
  likes: number;
  status: AgendaStatus;
  createdAt: string;
  result?: string;
  votes?: Record<string, 'agree' | 'disagree'>;
  comments?: AgendaComment[];
  secretaryId?: string;
  secretaryName?: string;
  notes?: string;
}

// --- 1인 1역 (Role Assignment) Types ---

export interface RoleItem {
  id: string;
  title: string;
}

export interface RoleStudent {
  id: string;
  name: string;
}

export interface RoleAssignment {
  studentId: string;
  roleId: string | null; // null if no role assigned (unlikely but possible)
  isLocked: boolean; // Teacher can lock this assignment before shuffle
}

export interface RoleHistoryItem {
    studentId: string;
    roleId: string;
}

export interface RoleHistory {
    date: string; // YYYY-MM
    assignments: RoleAssignment[];
}

export interface RoleData {
    students: RoleStudent[];
    roles: RoleItem[];
    currentAssignments: RoleAssignment[];
    history: RoleHistory[];
}

// --- Word Search Types ---

export interface WordSearchCell {
  row: number;
  col: number;
  char: string;
}

export interface WordSearchGame {
  id: string;
  title: string;
  size: number;
  words: string[]; // List of words to find
  grid: string[][]; // The board
  foundWords: string[]; // Shared found words (cooperative)
}

// --- Study Guide Types ---

export interface StudyPeriod {
  period: number;
  subject: string;
  content: string;
}

export interface BellScheduleItem {
  label: string;
  time: string;
  isBreak?: boolean;
}

export interface WeeklyStudyData {
  id: string;
  weekStartDate: string; // YYYY-MM-DD of Monday
  fileUrl: string; // Base64 or URL
  fileType: 'pdf' | 'image';
  schedules: Record<string, StudyPeriod[]>; // Key: YYYY-MM-DD
  bellSchedule?: BellScheduleItem[];
  fileStorage?: 'local' | 'supabase';
  filePath?: string;
  updatedAt: string;
}

// --- Private Message Types ---

export interface PrivateMessage {
  id: string;
  studentName: string; // Key to identify conversation
  content: string;
  sender: 'teacher' | 'student';
  timestamp: number;
  isRead: boolean;
}

// --- Point Types ---

export interface PointStudent {
  id: string;
  number: number;
  name: string;
  points: number;
  avatarId: string; // For 3D avatar mapping
}

export interface PointHistory {
  id: string;
  studentIds: string[];
  reason: string;
  amount: number;
  timestamp: number;
}

// --- Occasion Education Types ---

export interface OccasionQuiz {
    question: string;
    options: string[]; // 4 options
    answer: number; // 0-3 index
}

export interface NotebookLMData {
    youtubeUrl: string;
    summary: string; // Infographic text content
    quizzes: OccasionQuiz[];
    sourceUrl?: string; // NotebookLM share link if available
    videoFile?: {
        name: string;
        type: string;
        dataUrl: string;
    };
    infographicImage?: {
        name: string;
        type: string;
        dataUrl: string;
    };
}

export interface OccasionMaterial {
  id: string;
  title: string;
  types: string[]; // e.g., "영상", "활동지", "슬라이드", "도안", "NotebookLM"
  thumbnailUrl: string;
  topic: string;
  author: string;
  link?: string; // Optional external link
  notebookLM?: NotebookLMData; // Optional NotebookLM generated content
}

export interface OccasionTopic {
  id: string;
  day: number; // e.g., 1 (for 1st day of month)
  title: string; // e.g., "삼일절"
  description: string;
  materials: OccasionMaterial[];
}

export interface CommonOccasionTopic {
  id: string;
  title: string; // e.g., "정보통신활용교육"
  description: string;
  materials: OccasionMaterial[];
}

export interface OccasionMonth {
  month: number;
  topics: OccasionTopic[];
}

// --- Schedule/Planner Types ---

export type ScheduleItemType = 
  | 'schedule' 
  | 'goal' 
  | 'reflection' 
  | 'gratitude' 
  | 'remember'
  | 'handbook_log'
  | 'handbook_memo'
  | 'handbook_prep'
  | 'handbook_weather'
  | 'handbook_daily_table'
  | 'handbook_yearly'
  | 'yearly_plan'
  | 'monthly_goal'
  | 'weekly_plan';

export interface ScheduleItem {
  id: string;
  studentId: string; // To separate user data
  date: string; // YYYY-MM-DD
  type: ScheduleItemType;
  time?: string; // HH:mm
  content: string;
  isCompleted?: boolean;
}
