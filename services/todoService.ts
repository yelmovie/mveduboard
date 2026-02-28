
import { TodoTask, TodoRecord, TodoStatus, Participant } from '../types';
import * as studentService from './studentService';
import { generateUUID } from '../src/utils/uuid';

const LS_KEYS = {
  TASKS: 'edu_todo_tasks',
  RECORDS: 'edu_todo_records',
  INIT: 'edu_todo_initialized'
};

const initializeTodo = () => {
    if (!localStorage.getItem(LS_KEYS.INIT)) {
        const today = new Date().toISOString().split('T')[0];
        const taskId = generateUUID();
        
        const task: TodoTask = {
            id: taskId,
            date: today,
            content: '수학익힘책 34~35쪽 풀기',
            created_at: new Date().toISOString()
        };
        
        localStorage.setItem(LS_KEYS.TASKS, JSON.stringify([task]));
        localStorage.setItem(LS_KEYS.INIT, 'true');
    }
}

export const getRoster = () => {
    return studentService.getRoster().map(s => ({
        id: s.id, // Using the roster's ID
        name: `${s.number}. ${s.name}`, // Format for display
        pureName: s.name // Original name
    }));
}

export const getTasks = (date: string): TodoTask[] => {
  initializeTodo();
  const allTasks: TodoTask[] = JSON.parse(localStorage.getItem(LS_KEYS.TASKS) || '[]');
  return allTasks.filter(t => t.date === date).sort((a, b) => {
      // Sort priority first, then date
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

  const allTasks: TodoTask[] = JSON.parse(localStorage.getItem(LS_KEYS.TASKS) || '[]');
  const newTask: TodoTask = {
    id: generateUUID(),
    date,
    content,
    isImportant,
    created_at: new Date().toISOString(),
  };

  localStorage.setItem(LS_KEYS.TASKS, JSON.stringify([...allTasks, newTask]));
  return newTask;
};

// Copy tasks from source date to target date (Carry over functionality)
export const copyTasksToDate = (sourceDate: string, targetDate: string, taskIds: string[]) => {
    const allTasks: TodoTask[] = JSON.parse(localStorage.getItem(LS_KEYS.TASKS) || '[]');
    const tasksToCopy = allTasks.filter(t => t.date === sourceDate && taskIds.includes(t.id));
    
    const newTasks = tasksToCopy.map(t => ({
        id: generateUUID(),
        date: targetDate,
        content: `[이월] ${t.content}`, // Mark as carried over
        isImportant: t.isImportant || false,
        created_at: new Date().toISOString()
    }));

    localStorage.setItem(LS_KEYS.TASKS, JSON.stringify([...allTasks, ...newTasks]));
};

export const deleteTask = (taskId: string) => {
  const allTasks: TodoTask[] = JSON.parse(localStorage.getItem(LS_KEYS.TASKS) || '[]');
  const updated = allTasks.filter(t => t.id !== taskId);
  localStorage.setItem(LS_KEYS.TASKS, JSON.stringify(updated));
  
  // Clean up records
  const allRecords: TodoRecord[] = JSON.parse(localStorage.getItem(LS_KEYS.RECORDS) || '[]');
  const updatedRecords = allRecords.filter(r => r.task_id !== taskId);
  localStorage.setItem(LS_KEYS.RECORDS, JSON.stringify(updatedRecords));
};

export const getRecords = (taskId: string): TodoRecord[] => {
  const allRecords: TodoRecord[] = JSON.parse(localStorage.getItem(LS_KEYS.RECORDS) || '[]');
  return allRecords.filter(r => r.task_id === taskId);
};

export const getDailyRecords = (date: string): TodoRecord[] => {
  const tasks = getTasks(date);
  const taskIds = tasks.map(t => t.id);
  const allRecords: TodoRecord[] = JSON.parse(localStorage.getItem(LS_KEYS.RECORDS) || '[]');
  return allRecords.filter(r => taskIds.includes(r.task_id));
}

export const updateStudentStatus = (taskId: string, student: Participant | {id: string, nickname: string}, status: TodoStatus) => {
  const allRecords: TodoRecord[] = JSON.parse(localStorage.getItem(LS_KEYS.RECORDS) || '[]');
  const existingIndex = allRecords.findIndex(r => r.task_id === taskId && r.student_id === student.id);
  
  if (existingIndex > -1) {
    allRecords[existingIndex].status = status;
    allRecords[existingIndex].updated_at = new Date().toISOString();
  } else {
    allRecords.push({
      id: generateUUID(),
      task_id: taskId,
      student_id: student.id,
      student_name: student.nickname,
      status,
      updated_at: new Date().toISOString(),
    });
  }

  localStorage.setItem(LS_KEYS.RECORDS, JSON.stringify(allRecords));
};

export const approveRecord = (recordId: string) => {
    const allRecords: TodoRecord[] = JSON.parse(localStorage.getItem(LS_KEYS.RECORDS) || '[]');
    const record = allRecords.find(r => r.id === recordId);
    if(record) {
        record.status = 'approved';
        record.updated_at = new Date().toISOString();
        localStorage.setItem(LS_KEYS.RECORDS, JSON.stringify(allRecords));
    }
}

export const approveAllForTask = (taskId: string) => {
    const allRecords: TodoRecord[] = JSON.parse(localStorage.getItem(LS_KEYS.RECORDS) || '[]');
    const updated = allRecords.map(r => {
        if (r.task_id === taskId && r.status === 'done') {
            return { ...r, status: 'approved' as TodoStatus, updated_at: new Date().toISOString() };
        }
        return r;
    });
    localStorage.setItem(LS_KEYS.RECORDS, JSON.stringify(updated));
}

// Check if student has incomplete tasks before today
export const checkPastIncomplete = (studentId: string, currentDate: string): number => {
    initializeTodo();
    const allTasks: TodoTask[] = JSON.parse(localStorage.getItem(LS_KEYS.TASKS) || '[]');
    const allRecords: TodoRecord[] = JSON.parse(localStorage.getItem(LS_KEYS.RECORDS) || '[]');
    
    // Filter tasks strictly BEFORE today
    const pastTasks = allTasks.filter(t => t.date < currentDate);
    
    let incompleteCount = 0;
    
    pastTasks.forEach(task => {
        const record = allRecords.find(r => r.task_id === task.id && r.student_id === studentId);
        // If no record exists, or status is incomplete -> count it
        if (!record || record.status === 'incomplete') {
            incompleteCount++;
        }
    });
    
    return incompleteCount;
}
