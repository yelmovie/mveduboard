
import { PointStudent } from '../types';
import * as studentService from './studentService';

const LS_KEY = 'edu_point_students';

const AVATAR_IDS = [
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
  '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆',
  '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋'
];

export const getStudents = (): PointStudent[] => {
  const stored = localStorage.getItem(LS_KEY);
  const roster = studentService.getRoster();
  
  let students: PointStudent[] = [];

  if (stored) {
      students = JSON.parse(stored);
      
      const existingIds = new Set(students.map(s => s.id));
      const rosterIds = new Set(roster.map(s => s.id));

      // Add missing from roster
      roster.forEach((s, i) => {
          if (!existingIds.has(s.id)) {
              students.push({
                  id: s.id,
                  number: s.number,
                  name: s.name,
                  points: 0,
                  avatarId: AVATAR_IDS[i % AVATAR_IDS.length]
              });
          } else {
              // Update name/number if changed
              const existing = students.find(es => es.id === s.id);
              if (existing) {
                  existing.name = s.name;
                  existing.number = s.number;
              }
          }
      });

      // Remove deleted
      students = students.filter(s => rosterIds.has(s.id));
      
      // Sort by number
      students.sort((a, b) => a.number - b.number);
      
      localStorage.setItem(LS_KEY, JSON.stringify(students));
  } else {
      // Init
      students = roster.map((s, i) => ({
        id: s.id,
        number: s.number,
        name: s.name,
        points: 0,
        avatarId: AVATAR_IDS[i % AVATAR_IDS.length],
      }));
      localStorage.setItem(LS_KEY, JSON.stringify(students));
  }
  return students;
};

export const updatePoints = (studentIds: string[], amount: number, reason: string) => {
  const students = getStudents();
  const updated = students.map(s => {
    if (studentIds.includes(s.id)) {
      return { ...s, points: s.points + amount };
    }
    return s;
  });
  localStorage.setItem(LS_KEY, JSON.stringify(updated));
  return updated;
};

export const resetPoints = () => {
  const students = getStudents();
  const updated = students.map(s => ({ ...s, points: 0 }));
  localStorage.setItem(LS_KEY, JSON.stringify(updated));
  return updated;
}

export const getRewardCategories = () => [
    { label: '발표를 잘해요', score: 1, type: 'good' },
    { label: '친구를 도와줘요', score: 1, type: 'good' },
    { label: '정리를 잘해요', score: 1, type: 'good' },
    { label: '집중을 잘해요', score: 1, type: 'good' },
    { label: '과제를 완료했어요', score: 1, type: 'good' },
];

export const getPenaltyCategories = () => [
    { label: '준비물을 안 가져왔어요', score: -1, type: 'bad' },
    { label: '수업 방해를 했어요', score: -1, type: 'bad' },
    { label: '지각을 했어요', score: -1, type: 'bad' },
];
