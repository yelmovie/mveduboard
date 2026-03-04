/**
 * 할일 목록 서비스 - Supabase 연동 + localStorage 폴백
 * studyService, handbookFileService와 동일한 패턴
 */
import { TodoTask, TodoRecord, TodoStatus, Participant } from '../types';
import * as studentService from './studentService';
import { generateUUID } from '../src/utils/uuid';
import { supabase } from '../src/lib/supabase/client';
import { getCurrentUserProfile } from '../src/lib/supabase/auth';

const LS_KEY = 'edu_todo_data';
const LEGACY_TASKS = 'edu_todo_tasks';
const LEGACY_RECORDS = 'edu_todo_records';
const INIT_KEY = 'edu_todo_initialized';
let suppressTodoDataColumnError = false;
let lastKnownClassId: string | null = null;

export interface TodoDataPayload {
  tasks: TodoTask[];
  records: TodoRecord[];
}

const getTodoKey = (classId?: string | null) => (classId ? `${LS_KEY}_${classId}` : LS_KEY);
const getInitKey = (classId?: string | null) => (classId ? `${INIT_KEY}_${classId}` : INIT_KEY);

/** 기존 localStorage 데이터를 새 형식으로 마이그레이션 */
const migrateLegacyToNewFormat = (classId?: string | null): TodoDataPayload => {
  const tasks: TodoTask[] = JSON.parse(localStorage.getItem(LEGACY_TASKS) || '[]');
  const records: TodoRecord[] = JSON.parse(localStorage.getItem(LEGACY_RECORDS) || '[]');
  if (tasks.length > 0 || records.length > 0) {
    const payload: TodoDataPayload = { tasks, records };
    saveLocal(payload, classId);
    localStorage.removeItem(LEGACY_TASKS);
    localStorage.removeItem(LEGACY_RECORDS);
    localStorage.removeItem(INIT_KEY);
    return payload;
  }
  return { tasks: [], records: [] };
};

const getLocal = (classId?: string | null): TodoDataPayload => {
  const key = getTodoKey(classId);
  const stored = localStorage.getItem(key);
  if (stored) return JSON.parse(stored) as TodoDataPayload;
  const legacy = migrateLegacyToNewFormat(classId);
  if (legacy.tasks.length > 0 || legacy.records.length > 0) return legacy;
  const fallback = localStorage.getItem(LS_KEY);
  if (fallback) return JSON.parse(fallback) as TodoDataPayload;
  return { tasks: [], records: [] };
};

const saveLocal = (data: TodoDataPayload, classId?: string | null) => {
  const key = getTodoKey(classId);
  try {
    localStorage.setItem(key, JSON.stringify(data));
    if (classId) localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {
    console.warn('[todoService] localStorage quota exceeded');
  }
};

const initializeTodo = (classId?: string | null) => {
  const initKey = getInitKey(classId);
  if (!localStorage.getItem(initKey)) {
    const today = new Date().toISOString().split('T')[0];
    const task: TodoTask = {
      id: generateUUID(),
      date: today,
      content: '수학익힘책 34~35쪽 풀기',
      created_at: new Date().toISOString(),
    };
    const payload: TodoDataPayload = { tasks: [task], records: [] };
    saveLocal(payload, classId);
    localStorage.setItem(initKey, 'true');
  }
};

/** Supabase에서 할일 데이터 로드 후 localStorage에 병합 */
export const loadTodoDataAsync = async (): Promise<void> => {
  let profile = await getCurrentUserProfile();
  if (!profile?.class_id && supabase) {
    await new Promise((r) => setTimeout(r, 500));
    profile = await getCurrentUserProfile();
  }
  const classId = profile?.class_id ?? null;
  lastKnownClassId = classId;
  const local = getLocal(classId);
  if (!supabase || !classId || suppressTodoDataColumnError) {
    return;
  }
  const { data, error } = await supabase
    .from('classes')
    .select('todo_data')
    .eq('id', classId)
    .maybeSingle();
  if (error) {
    if (error.message?.includes('todo_data')) suppressTodoDataColumnError = true;
    return;
  }
  const remote = data?.todo_data as TodoDataPayload | null;
  if (remote && (Array.isArray(remote.tasks) || Array.isArray(remote.records))) {
    const merged: TodoDataPayload = {
      tasks: Array.isArray(remote.tasks) ? remote.tasks : local.tasks,
      records: Array.isArray(remote.records) ? remote.records : local.records,
    };
    saveLocal(merged, classId);
  }
};

/** localStorage 데이터를 Supabase에 동기화 (수동 저장용 export) */
export const saveTodoDataToSupabase = async (): Promise<boolean> => {
  const profile = await getCurrentUserProfile();
  const classId = lastKnownClassId ?? profile?.class_id ?? null;
  if (!supabase || !classId || profile?.role !== 'teacher' || suppressTodoDataColumnError) return false;
  const local = getLocal(classId);
  const { error } = await supabase
    .from('classes')
    .update({ todo_data: local })
    .eq('id', classId);
  if (error) {
    if (error.message?.includes('todo_data')) suppressTodoDataColumnError = true;
    return false;
  }
  return true;
};

const syncTodoDataToSupabase = () => saveTodoDataToSupabase();

const getEffectiveClassId = (): string | null => {
  if (lastKnownClassId) return lastKnownClassId;
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(`${LS_KEY}_`));
  if (keys.length > 0) return keys[0].replace(`${LS_KEY}_`, '');
  return null;
};

export const getRoster = () => {
  return studentService.getRoster().map((s) => ({
    id: s.id,
    name: `${s.number}. ${s.name}`,
    pureName: s.name,
  }));
};

export const getTasks = (date: string): TodoTask[] => {
  const classId = getEffectiveClassId();
  initializeTodo(classId);
  const { tasks } = getLocal(classId);
  return tasks
    .filter((t) => t.date === date)
    .sort((a, b) => {
      if (a.isImportant && !b.isImportant) return -1;
      if (!a.isImportant && b.isImportant) return 1;
      return a.created_at.localeCompare(b.created_at);
    });
};

export const createTask = (date: string, content: string, isImportant: boolean = false): TodoTask => {
  const currentTasks = getTasks(date);
  if (currentTasks.length >= 10) {
    throw new Error('하루에 최대 10개까지만 과제를 만들 수 있습니다.');
  }
  const classId = getEffectiveClassId();
  const { tasks, records } = getLocal(classId);
  const newTask: TodoTask = {
    id: generateUUID(),
    date,
    content,
    isImportant,
    created_at: new Date().toISOString(),
  };
  saveLocal({ tasks: [...tasks, newTask], records }, classId);
  syncTodoDataToSupabase();
  return newTask;
};

export const copyTasksToDate = (sourceDate: string, targetDate: string, taskIds: string[]) => {
  const classId = getEffectiveClassId();
  const { tasks, records } = getLocal(classId);
  const tasksToCopy = tasks.filter((t) => t.date === sourceDate && taskIds.includes(t.id));
  const newTasks = tasksToCopy.map((t) => ({
    id: generateUUID(),
    date: targetDate,
    content: `[이월] ${t.content}`,
    isImportant: t.isImportant || false,
    created_at: new Date().toISOString(),
  }));
  saveLocal({ tasks: [...tasks, ...newTasks], records }, classId);
  syncTodoDataToSupabase();
};

export const deleteTask = (taskId: string) => {
  const classId = getEffectiveClassId();
  const { tasks, records } = getLocal(classId);
  const updatedTasks = tasks.filter((t) => t.id !== taskId);
  const updatedRecords = records.filter((r) => r.task_id !== taskId);
  saveLocal({ tasks: updatedTasks, records: updatedRecords }, classId);
  syncTodoDataToSupabase();
};

export const getRecords = (taskId: string): TodoRecord[] => {
  const classId = getEffectiveClassId();
  const { records } = getLocal(classId);
  return records.filter((r) => r.task_id === taskId);
};

export const getDailyRecords = (date: string): TodoRecord[] => {
  const tasks = getTasks(date);
  const taskIds = tasks.map((t) => t.id);
  const classId = getEffectiveClassId();
  const { records } = getLocal(classId);
  return records.filter((r) => taskIds.includes(r.task_id));
};

export const updateStudentStatus = (
  taskId: string,
  student: Participant | { id: string; nickname: string },
  status: TodoStatus
) => {
  const classId = getEffectiveClassId();
  const { tasks, records } = getLocal(classId);
  const existingIndex = records.findIndex((r) => r.task_id === taskId && r.student_id === student.id);
  let nextRecords: TodoRecord[];
  if (existingIndex > -1) {
    records[existingIndex].status = status;
    records[existingIndex].updated_at = new Date().toISOString();
    nextRecords = records;
  } else {
    nextRecords = [
      ...records,
      {
        id: generateUUID(),
        task_id: taskId,
        student_id: student.id,
        student_name: student.nickname,
        status,
        updated_at: new Date().toISOString(),
      },
    ];
  }
  saveLocal({ tasks, records: nextRecords }, classId);
  syncTodoDataToSupabase();
};

export const approveRecord = (recordId: string) => {
  const classId = getEffectiveClassId();
  const { tasks, records } = getLocal(classId);
  const record = records.find((r) => r.id === recordId);
  if (record) {
    record.status = 'approved';
    record.updated_at = new Date().toISOString();
    saveLocal({ tasks, records }, classId);
    syncTodoDataToSupabase();
  }
};

export const approveAllForTask = (taskId: string) => {
  const classId = getEffectiveClassId();
  const { tasks, records } = getLocal(classId);
  const updated = records.map((r) => {
    if (r.task_id === taskId && r.status === 'done') {
      return { ...r, status: 'approved' as TodoStatus, updated_at: new Date().toISOString() };
    }
    return r;
  });
  saveLocal({ tasks, records: updated }, classId);
  syncTodoDataToSupabase();
};

export const checkPastIncomplete = (studentId: string, currentDate: string): number => {
  const classId = getEffectiveClassId();
  initializeTodo(classId);
  const { tasks, records } = getLocal(classId);
  const pastTasks = tasks.filter((t) => t.date < currentDate);
  let incompleteCount = 0;
  pastTasks.forEach((task) => {
    const record = records.find((r) => r.task_id === task.id && r.student_id === studentId);
    if (!record || record.status === 'incomplete') incompleteCount++;
  });
  return incompleteCount;
};
