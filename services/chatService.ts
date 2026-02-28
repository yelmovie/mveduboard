
import { ChatRoom, ChatUser, ChatMessage, ChatRoomType, ChatGroup } from '../types';
import { generateUUID } from '../src/utils/uuid';

const LS_KEYS = {
  ROOMS: 'edu_chat_rooms',
  MESSAGES: 'edu_chat_messages',
  USERS: 'edu_chat_users',
  INIT: 'edu_chat_initialized',
  ACTIVE_CODE: 'edu_chat_active_code',
  GROUPS: 'edu_chat_groups',
};

const generateRoomCode = () => Math.floor(100000 + Math.random() * 900000).toString();
const normalizeCode = (code?: string | null) => (code || '').trim();
const getGroupKey = (classCode?: string | null) =>
  classCode ? `${LS_KEYS.GROUPS}_${classCode}` : LS_KEYS.GROUPS;

const initializeChat = () => {
    if (!localStorage.getItem(LS_KEYS.INIT)) {
        // Create Default Room (Locked by default)
        const room: ChatRoom = {
            id: 'room-1',
            code: '123456',
            type: 'class',
            isLocked: true, 
            createdAt: Date.now()
        };
        
        // Sample Messages
        const msgs: ChatMessage[] = [
            { id: 'msg-1', roomId: 'room-1', senderId: 'system', senderName: '알림', text: '선생님이 입장했습니다.', type: 'system', timestamp: Date.now() - 100000, isHidden: false },
            { id: 'msg-2', roomId: 'room-1', senderId: 'teacher-1', senderName: '선생님', text: '얘들아 안녕! 오늘 하루도 즐겁게 보내자 😄', type: 'chat', timestamp: Date.now() - 90000, isHidden: false },
            { id: 'msg-3', roomId: 'room-1', senderId: 'student-1', senderName: '김민수', text: '안녕하세요 선생님!', type: 'chat', timestamp: Date.now() - 80000, isHidden: false },
            { id: 'msg-4', roomId: 'room-1', senderId: 'student-2', senderName: '이영희', text: '오늘 급식 뭐예요?', type: 'chat', timestamp: Date.now() - 50000, isHidden: false },
        ];

        localStorage.setItem(LS_KEYS.ROOMS, JSON.stringify([room]));
        localStorage.setItem(LS_KEYS.MESSAGES, JSON.stringify(msgs));
        localStorage.setItem(LS_KEYS.INIT, 'true');
    }
}

// --- Room Management ---

export const getRoom = (roomId: string): ChatRoom | undefined => {
    const rooms: ChatRoom[] = JSON.parse(localStorage.getItem(LS_KEYS.ROOMS) || '[]');
    return rooms.find(r => r.id === roomId);
}

export const getRoomByCode = (code: string): ChatRoom | undefined => {
  const rooms: ChatRoom[] = JSON.parse(localStorage.getItem(LS_KEYS.ROOMS) || '[]');
  const target = normalizeCode(code);
  return rooms.find((r) => r.code === target);
};

export const listRooms = (): ChatRoom[] => {
  const rooms: ChatRoom[] = JSON.parse(localStorage.getItem(LS_KEYS.ROOMS) || '[]');
  return rooms;
};

export const createRoom = (
  type: ChatRoomType,
  options?: { code?: string; groupId?: string; groupName?: string }
): ChatRoom => {
  const rooms: ChatRoom[] = JSON.parse(localStorage.getItem(LS_KEYS.ROOMS) || '[]');
  
  const newRoom: ChatRoom = {
    id: generateUUID(),
    code: options?.code || generateRoomCode(),
    type,
    isLocked: true, // Default locked
    createdAt: Date.now(),
    groupId: options?.groupId,
    groupName: options?.groupName,
  };

  rooms.push(newRoom);
  localStorage.setItem(LS_KEYS.ROOMS, JSON.stringify(rooms));
  localStorage.setItem(LS_KEYS.ACTIVE_CODE, newRoom.code);
  return newRoom;
};

export const getActiveRoomCode = (): string | null => {
  return localStorage.getItem(LS_KEYS.ACTIVE_CODE);
};

export const setActiveRoomCode = (code: string) => {
  localStorage.setItem(LS_KEYS.ACTIVE_CODE, code);
};

// --- Group Management ---

export const getGroups = (classCode?: string | null): ChatGroup[] => {
  const stored = localStorage.getItem(getGroupKey(classCode));
  if (!stored) return [];
  try {
    return JSON.parse(stored) as ChatGroup[];
  } catch (e) {
    console.warn('[chat] failed to parse groups', e);
    return [];
  }
};

export const saveGroups = (classCode: string, groups: ChatGroup[]) => {
  localStorage.setItem(getGroupKey(classCode), JSON.stringify(groups));
};

export const findGroupByCode = (classCode: string, code: string): ChatGroup | undefined => {
  const groups = getGroups(classCode);
  return groups.find((g) => g.code === normalizeCode(code));
};

export const generateUniqueGroupCode = (classCode: string, existingCodes: string[] = []) => {
  const normalized = new Set(existingCodes.map(normalizeCode));
  normalized.add(normalizeCode(classCode));
  let attempts = 0;
  while (attempts < 1000) {
    const code = generateRoomCode();
    if (!normalized.has(code)) return code;
    attempts += 1;
  }
  return generateRoomCode();
};

export const updateRoomLock = (roomId: string, isLocked: boolean) => {
    const rooms: ChatRoom[] = JSON.parse(localStorage.getItem(LS_KEYS.ROOMS) || '[]');
    const updatedRooms = rooms.map(r => r.id === roomId ? { ...r, isLocked } : r);
    localStorage.setItem(LS_KEYS.ROOMS, JSON.stringify(updatedRooms));
    
    // Send system message
    const msg = isLocked ? '선생님이 채팅방을 닫았습니다.' : '선생님이 채팅방을 열었습니다.';
    sendSystemMessage(roomId, msg);
}

export const joinRoom = (code: string, name: string, role: 'teacher' | 'student'): { room: ChatRoom, user: ChatUser } => {
  initializeChat(); // Ensure demo room exists
  const rooms: ChatRoom[] = JSON.parse(localStorage.getItem(LS_KEYS.ROOMS) || '[]');
  const room = rooms.find(r => r.code === normalizeCode(code));

  if (!room) {
    throw new Error('방 코드를 찾을 수 없습니다.');
  }

  const users: ChatUser[] = JSON.parse(localStorage.getItem(LS_KEYS.USERS) || '[]');
  
  // Check for existing user in this room to reuse session
  const existingUser = users.find(u => u.roomId === room.id && u.name === name && u.role === role);
  if (existingUser) {
      const joinedKey = `edu_chat_joined_${room.id}_${existingUser.id}`;
      if (!localStorage.getItem(joinedKey)) {
        sendSystemMessage(room.id, `${name}님이 입장했습니다.`);
        localStorage.setItem(joinedKey, String(Date.now()));
      }
      return { room, user: existingUser };
  }

  const newUser: ChatUser = {
    id: generateUUID(),
    roomId: room.id,
    name,
    role,
    isMuted: false,
  };

  users.push(newUser);
  localStorage.setItem(LS_KEYS.USERS, JSON.stringify(users));

  sendSystemMessage(room.id, `${name}님이 입장했습니다.`);
  localStorage.setItem(`edu_chat_joined_${room.id}_${newUser.id}`, String(Date.now()));

  return { room, user: newUser };
};

// --- Messaging ---

export const getMessages = (roomId: string): ChatMessage[] => {
  initializeChat();
  const allMessages: ChatMessage[] = JSON.parse(localStorage.getItem(LS_KEYS.MESSAGES) || '[]');
  return allMessages.filter(m => m.roomId === roomId).sort((a, b) => a.timestamp - b.timestamp);
};

export const sendMessage = (roomId: string, user: ChatUser, text: string) => {
  // Check lock status again
  const rooms: ChatRoom[] = JSON.parse(localStorage.getItem(LS_KEYS.ROOMS) || '[]');
  const room = rooms.find(r => r.id === roomId);
  if (room && room.isLocked && user.role !== 'teacher') {
      throw new Error('채팅방이 닫혀있습니다.');
  }

  const users: ChatUser[] = JSON.parse(localStorage.getItem(LS_KEYS.USERS) || '[]');
  const currentUser = users.find(u => u.id === user.id);
  if (currentUser?.isMuted) {
    throw new Error('선생님에 의해 채팅이 금지되었습니다.');
  }

  const allMessages: ChatMessage[] = JSON.parse(localStorage.getItem(LS_KEYS.MESSAGES) || '[]');
  
  const newMessage: ChatMessage = {
    id: generateUUID(),
    roomId,
    senderId: user.id,
    senderName: user.name,
    text,
    type: 'chat',
    timestamp: Date.now(),
  };

  localStorage.setItem(LS_KEYS.MESSAGES, JSON.stringify([...allMessages, newMessage]));
  return newMessage;
};

export const sendSystemMessage = (roomId: string, text: string) => {
  const allMessages: ChatMessage[] = JSON.parse(localStorage.getItem(LS_KEYS.MESSAGES) || '[]');
  
  const newMessage: ChatMessage = {
    id: generateUUID(),
    roomId,
    senderId: 'system',
    senderName: '알림',
    text,
    type: 'system',
    timestamp: Date.now(),
  };

  localStorage.setItem(LS_KEYS.MESSAGES, JSON.stringify([...allMessages, newMessage]));
};

// --- Teacher Controls ---

export const deleteMessage = (messageId: string) => {
  const allMessages: ChatMessage[] = JSON.parse(localStorage.getItem(LS_KEYS.MESSAGES) || '[]');
  const updatedMessages = allMessages.filter(m => m.id !== messageId);
  localStorage.setItem(LS_KEYS.MESSAGES, JSON.stringify(updatedMessages));
};

export const toggleHideMessage = (messageId: string, hidden: boolean) => {
  const allMessages: ChatMessage[] = JSON.parse(localStorage.getItem(LS_KEYS.MESSAGES) || '[]');
  const updatedMessages = allMessages.map(m =>
    m.id === messageId ? { ...m, isHidden: hidden } : m
  );
  localStorage.setItem(LS_KEYS.MESSAGES, JSON.stringify(updatedMessages));
};

export const muteUser = (userId: string) => {
  const users: ChatUser[] = JSON.parse(localStorage.getItem(LS_KEYS.USERS) || '[]');
  const updatedUsers = users.map(u => u.id === userId ? { ...u, isMuted: true } : u);
  localStorage.setItem(LS_KEYS.USERS, JSON.stringify(updatedUsers));
};

export const leaveRoom = (userId: string) => {
  const users: ChatUser[] = JSON.parse(localStorage.getItem(LS_KEYS.USERS) || '[]');
  const updatedUsers = users.filter(u => u.id !== userId);
  localStorage.setItem(LS_KEYS.USERS, JSON.stringify(updatedUsers));
};

export const getRoomUsers = (roomId: string): ChatUser[] => {
  const users: ChatUser[] = JSON.parse(localStorage.getItem(LS_KEYS.USERS) || '[]');
  return users.filter((u) => u.roomId === roomId);
};

export const kickUser = (roomId: string, userId: string, userName: string) => {
  leaveRoom(userId);
  sendSystemMessage(roomId, `${userName}님이 내보내기 되었습니다.`);
};

export const downloadChatLog = (roomId: string) => {
  const messages = getMessages(roomId);
  let content = `[우리교실 톡톡 대화 저장]\n저장일시: ${new Date().toLocaleString()}\n\n`;

  messages.forEach(m => {
    const time = new Date(m.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    if (m.type === 'system') {
        content += `[${time}] <시스템> ${m.text}\n`;
    } else {
        content += `[${time}] ${m.senderName}: ${m.text}\n`;
    }
  });

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `chat_log_${new Date().toISOString().slice(0,10)}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
