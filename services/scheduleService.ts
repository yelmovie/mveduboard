import { ScheduleItem, ScheduleItemType } from '../types';
import { generateUUID } from '../src/utils/uuid';

const LS_KEY = 'edu_personal_schedule';

// Helper to get current user's key suffix
// In a real app, this would be handled by a proper backend. 
// Here we just use a simple key, filtering by studentId in logic.
// For this demo, we can assume data is stored in one big array in LS for simplicity.

export const getAllSchedules = (): ScheduleItem[] => {
  const stored = localStorage.getItem(LS_KEY);
  const parsed: ScheduleItem[] = stored ? JSON.parse(stored) : [];

  // Prune records older than 1 year (rolling)
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  cutoff.setHours(0, 0, 0, 0);

  const filtered = parsed.filter((item) => {
    const date = new Date(item.date);
    if (Number.isNaN(date.getTime())) return true;
    return date >= cutoff;
  });

  if (filtered.length !== parsed.length) {
    localStorage.setItem(LS_KEY, JSON.stringify(filtered));
  }

  return filtered;
};

export const getSchedulesByDate = (studentId: string, date: string): ScheduleItem[] => {
  const all = getAllSchedules();
  return all.filter(item => item.studentId === studentId && item.date === date);
};

export const getSchedulesByMonth = (studentId: string, year: number, month: number): ScheduleItem[] => {
  const all = getAllSchedules();
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return all.filter(item => item.studentId === studentId && item.date.startsWith(prefix));
};

export const addSchedule = (
  studentId: string, 
  date: string, 
  type: ScheduleItemType, 
  content: string, 
  time?: string
): ScheduleItem => {
  const all = getAllSchedules();
  const newItem: ScheduleItem = {
    id: generateUUID(),
    studentId,
    date,
    type,
    time,
    content,
    isCompleted: false
  };
  localStorage.setItem(LS_KEY, JSON.stringify([...all, newItem]));
  return newItem;
};

export const deleteSchedule = (id: string) => {
  const all = getAllSchedules();
  const updated = all.filter(item => item.id !== id);
  localStorage.setItem(LS_KEY, JSON.stringify(updated));
};

export const toggleScheduleComplete = (id: string) => {
  const all = getAllSchedules();
  const updated = all.map(item => item.id === id ? { ...item, isCompleted: !item.isCompleted } : item);
  localStorage.setItem(LS_KEY, JSON.stringify(updated));
};

// Clear all data for a specific date (useful for Meal Plan reset if needed, though rarely used)
export const clearDateSchedules = (studentId: string, date: string, type?: ScheduleItemType) => {
    let all = getAllSchedules();
    all = all.filter(item => {
        if (item.studentId !== studentId) return true;
        if (item.date !== date) return true;
        if (type && item.type !== type) return true;
        return false; // Remove
    });
    localStorage.setItem(LS_KEY, JSON.stringify(all));
}