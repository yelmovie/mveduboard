import { Agenda, AgendaStatus } from '../types';
import { generateUUID } from '../src/utils/uuid';

const LS_KEY = 'edu_meeting_agendas';
const INIT_KEY = 'edu_meeting_initialized';

const initializeMeeting = () => {
    if (!localStorage.getItem(INIT_KEY)) {
        const samples: Agenda[] = [
            { id: generateUUID(), title: '체육대회 반티 정하기', description: '동물 잠옷 vs 축구 유니폼', author: '김철수', likes: 5, status: 'proposed', createdAt: new Date().toISOString(), votes: {} },
            { id: generateUUID(), title: '급식 줄서기 규칙 정하기', description: '번호순으로 설까요?', author: '이영희', likes: 12, status: 'discussing', createdAt: new Date().toISOString(), votes: { 'student-1': 'agree', 'student-2': 'disagree' } },
            { id: generateUUID(), title: '교실 청소 구역 나누기', description: '1분단이 창가쪽 맡기', author: '선생님', likes: 8, status: 'decided', result: '1주마다 로테이션 하기로 결정함', createdAt: new Date().toISOString(), votes: { 'student-1': 'agree', 'student-2': 'agree', 'student-3': 'agree' } },
        ];
        localStorage.setItem(LS_KEY, JSON.stringify(samples));
        localStorage.setItem(INIT_KEY, 'true');
    }
}

export const getAgendas = (): Agenda[] => {
  initializeMeeting();
  const stored = localStorage.getItem(LS_KEY);
  const agendas: Agenda[] = stored ? JSON.parse(stored) : [];
  // Ensure votes object exists for old data
  return agendas.map(a => ({ ...a, votes: a.votes || {} }));
};

export const createAgenda = (title: string, description: string, author: string): Agenda => {
  const agendas = getAgendas();
  const newAgenda: Agenda = {
    id: generateUUID(),
    title,
    description,
    author,
    likes: 0,
    status: 'proposed',
    createdAt: new Date().toISOString(),
    votes: {}
  };
  localStorage.setItem(LS_KEY, JSON.stringify([...agendas, newAgenda]));
  return newAgenda;
};

export const updateAgendaStatus = (id: string, status: AgendaStatus, result?: string) => {
  const agendas = getAgendas();
  const updated = agendas.map(a => a.id === id ? { ...a, status, result } : a);
  localStorage.setItem(LS_KEY, JSON.stringify(updated));
};

export const toggleLike = (id: string) => {
  const agendas = getAgendas();
  const updated = agendas.map(a => a.id === id ? { ...a, likes: a.likes + 1 } : a);
  localStorage.setItem(LS_KEY, JSON.stringify(updated));
};

export const voteAgenda = (agendaId: string, userId: string, voteType: 'agree' | 'disagree') => {
    const agendas = getAgendas();
    const updated = agendas.map(a => {
        if (a.id === agendaId) {
            const currentVotes = a.votes || {};
            // One vote per person: ignore if already voted
            if (currentVotes[userId]) {
                return a;
            }
            return { ...a, votes: { ...currentVotes, [userId]: voteType } };
        }
        return a;
    });
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
};

export const deleteAgenda = (id: string) => {
  const agendas = getAgendas();
  const updated = agendas.filter(a => a.id !== id);
  localStorage.setItem(LS_KEY, JSON.stringify(updated));
};