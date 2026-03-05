
import { PrivateMessage } from '../types';
import * as studentService from './studentService';
import { generateUUID } from '../src/utils/uuid';
import { loadWithSupabaseFallback, saveClassColumn } from '../lib/classDataSync';

const LS_KEY = 'edu_private_messages';
const INIT_KEY = 'edu_messages_initialized';

const normalizeStudentName = (rawName: string): string => {
    const trimmed = rawName.trim();
    if (!trimmed) return trimmed;
    if (/^\d+\.\s*/u.test(trimmed)) {
        return trimmed.replace(/\s+/g, ' ');
    }
    const roster = studentService.getRoster();
    const matched = roster.find((s) => s.name === trimmed);
    if (matched) {
        return `${matched.number}. ${matched.name}`;
    }
    return trimmed;
};

// generateUUID is imported from utils (uuid v4)

const initializeMessages = () => {
    if (!localStorage.getItem(INIT_KEY)) {
        const msgs: PrivateMessage[] = [
            { id: generateUUID(), studentName: '1. 권도훈', content: '선생님, 오늘 숙제 너무 어려워요 ㅠㅠ', sender: 'student', timestamp: Date.now() - 3600000, isRead: false },
            { id: generateUUID(), studentName: '1. 권도훈', content: '도훈아, 어떤 부분이 어렵니? 내일 아침에 같이 보자.', sender: 'teacher', timestamp: Date.now() - 3500000, isRead: true },
            { id: generateUUID(), studentName: '2. 김강후', content: '선생님 저 오늘 병원 가야 해서 청소 못해요.', sender: 'student', timestamp: Date.now() - 1000000, isRead: false }
        ];
        localStorage.setItem(LS_KEY, JSON.stringify(msgs));
        localStorage.setItem(INIT_KEY, 'true');
    }
}

const syncMessagesToSupabase = (msgs: PrivateMessage[]) => {
  saveClassColumn('message_data', msgs).catch(() => {});
};

export const getAllMessages = (): PrivateMessage[] => {
  initializeMessages();
  const stored = localStorage.getItem(LS_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const loadMessageDataAsync = async (): Promise<void> => {
  await loadWithSupabaseFallback<PrivateMessage[]>(
    'message_data',
    () => {
      initializeMessages();
      const s = localStorage.getItem(LS_KEY);
      return s ? JSON.parse(s) : [];
    },
    (d) => { localStorage.setItem(LS_KEY, JSON.stringify(d)); localStorage.setItem(INIT_KEY, 'true'); },
    (d) => !Array.isArray(d) || d.length === 0
  );
};

export const getMessagesForStudent = (studentName: string): PrivateMessage[] => {
  const all = getAllMessages();
  const normalized = normalizeStudentName(studentName);
  const raw = studentName.trim();
  return all
    .filter(m => m.studentName === normalized || (raw && m.studentName === raw))
    .sort((a, b) => a.timestamp - b.timestamp);
};

export const sendMessage = (studentName: string, content: string, sender: 'teacher' | 'student'): PrivateMessage => {
  const all = getAllMessages();
  const normalized = normalizeStudentName(studentName);
  const newMessage: PrivateMessage = {
    id: generateUUID(),
    studentName: normalized,
    content,
    sender,
    timestamp: Date.now(),
    isRead: false,
  };
  const updated = [...all, newMessage];
  localStorage.setItem(LS_KEY, JSON.stringify(updated));
  syncMessagesToSupabase(updated);
  return newMessage;
};

export const markAsRead = (studentName: string, viewerRole: 'teacher' | 'student') => {
  const all = getAllMessages();
  const normalized = normalizeStudentName(studentName);
  const raw = studentName.trim();
  const updated = all.map(m => {
    const isTarget = m.studentName === normalized || (raw && m.studentName === raw);
    if (viewerRole === 'student' && isTarget && m.sender === 'teacher') {
        return { ...m, isRead: true };
    }
    if (viewerRole === 'teacher' && isTarget && m.sender === 'student') {
        return { ...m, isRead: true };
    }
    return m;
  });
  localStorage.setItem(LS_KEY, JSON.stringify(updated));
  syncMessagesToSupabase(updated);
};


export const getUnreadCount = (studentName: string, viewerRole: 'teacher' | 'student'): number => {
    const messages = getMessagesForStudent(studentName);
    if (viewerRole === 'student') {
        return messages.filter(m => m.sender === 'teacher' && !m.isRead).length;
    } else {
        return messages.filter(m => m.sender === 'student' && !m.isRead).length;
    }
}

export const clearMessagesForStudent = (studentName: string) => {
  const all = getAllMessages();
  const normalized = normalizeStudentName(studentName);
  const raw = studentName.trim();
  const filtered = all.filter(m => m.studentName !== normalized && (!raw || m.studentName !== raw));
  localStorage.setItem(LS_KEY, JSON.stringify(filtered));
  syncMessagesToSupabase(filtered);
};

// Get combined list of default roster + any student who has sent a message
export const getActiveStudentList = (): string[] => {
    const all = getAllMessages();
    // Get official roster names with numbers
    const rosterNames = studentService.getRoster().map(s => `${s.number}. ${s.name}`);
    
    // Also include anyone who has sent a message (even if removed from roster, to preserve chat)
    const activeNames = new Set(all.map(m => m.studentName));
    
    const combined = new Set([...rosterNames, ...Array.from(activeNames)]);
    
    return Array.from(combined).sort((a, b) => {
        const numA = parseInt(a.split('.')[0]) || 999;
        const numB = parseInt(b.split('.')[0]) || 999;
        if (numA !== numB) return numA - numB;
        return a.localeCompare(b);
    });
}
