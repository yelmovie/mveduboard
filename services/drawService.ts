
import { DrawState } from '../types';
import * as studentService from './studentService';

const LS_KEY = 'edu_draw_state';
const TEACHER_LS_KEY = 'edu_draw_teacher_config';

export const getClassRoster = () => {
    return studentService.getRoster().map(s => s.name);
}

export const updateDrawState = (state: Partial<DrawState>) => {
  const current = getDrawState();
  const newState = { ...current, ...state, timestamp: Date.now() };
  localStorage.setItem(LS_KEY, JSON.stringify(newState));
};

export const getDrawState = (): DrawState => {
  const stored = localStorage.getItem(LS_KEY);
  return stored ? JSON.parse(stored) : {
    isActive: false,
    result: [],
    isAnimating: false,
    timestamp: 0
  };
};

export const clearDrawState = () => {
  localStorage.removeItem(LS_KEY);
  localStorage.removeItem(TEACHER_LS_KEY);
};

// --- Teacher Persistence ---

export interface TeacherDrawConfig {
  setupMode: 'number' | 'name';
  numRange: { min: number; max: number };
  nameList: string[];
  drawCount: number;
  allowDuplicates: boolean;
  showAnimation: boolean;
  pool: string[];
  isPlaying: boolean; 
}

export const saveTeacherConfig = (config: TeacherDrawConfig) => {
  localStorage.setItem(TEACHER_LS_KEY, JSON.stringify(config));
};

export const getTeacherConfig = (): TeacherDrawConfig | null => {
  const stored = localStorage.getItem(TEACHER_LS_KEY);
  return stored ? JSON.parse(stored) : null;
};
