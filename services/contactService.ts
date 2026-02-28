import { generateUUID } from '../src/utils/uuid';

export interface Inquiry {
  id: string;
  type: 'qna' | 'feature';
  author: string;
  content: string;
  createdAt: string;
  status: 'unread' | 'read' | 'completed';
}

const LS_KEY = 'edu_contact_messages';

export const getInquiries = (): Inquiry[] => {
  const stored = localStorage.getItem(LS_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const addInquiry = (type: 'qna' | 'feature', author: string, content: string): Inquiry => {
  const all = getInquiries();
  const newInquiry: Inquiry = {
    id: generateUUID(),
    type,
    author,
    content,
    createdAt: new Date().toISOString(),
    status: 'unread'
  };
  localStorage.setItem(LS_KEY, JSON.stringify([newInquiry, ...all]));
  return newInquiry;
};

export const deleteInquiry = (id: string) => {
    const all = getInquiries();
    const updated = all.filter(i => i.id !== id);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
};

export const updateStatus = (id: string, status: 'unread' | 'read' | 'completed') => {
    const all = getInquiries();
    const updated = all.map(i => i.id === id ? { ...i, status } : i);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
};
