
import React, { useState, useEffect, useRef } from 'react';
import { Send, LogOut, Users, Download, Trash2, Ban, MessageCircle, Home, Lock, Unlock, EyeOff, Eye, Smile, Settings, Shuffle, X } from 'lucide-react';
import * as chatService from '../services/chatService';
import { ChatRoom, ChatUser, ChatMessage, Participant, ChatGroup, ClassStudent } from '../types';
import * as studentService from '../services/studentService';
import { generateUUID } from '../src/utils/uuid';

interface ChatAppProps {
  onBack: () => void;
  isTeacherMode: boolean;
  student: Participant | null;
  embedded?: boolean;
}

export const ChatApp: React.FC<ChatAppProps> = ({ onBack, isTeacherMode, student, embedded = false }) => {
  const [step, setStep] = useState<'login' | 'room'>('login');
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [user, setUser] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [roomUsers, setRoomUsers] = useState<ChatUser[]>([]);
  
  // Login State
  const [joinCode, setJoinCode] = useState('');
  const [nickname, setNickname] = useState(isTeacherMode ? '선생님' : '');
  const [error, setError] = useState('');

  // Chat State
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGroupManager, setShowGroupManager] = useState(true);
  const [showGroupOverview, setShowGroupOverview] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<number | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Group State (Teacher)
  const [roster, setRoster] = useState<ClassStudent[]>([]);
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [groupAssignments, setGroupAssignments] = useState<Record<string, string>>({});

  // --- Auto Login Effect ---
  useEffect(() => {
      // If user is globally logged in (Teacher or Student), auto-join the default class room
      if (step === 'login') {
          const classCode = localStorage.getItem('edu_join_code');
          const defaultCode = classCode || chatService.getActiveRoomCode() || '123456';
          if (isTeacherMode) {
              try {
                  const { room: r, user: u } = chatService.joinRoom(defaultCode, '선생님', 'teacher');
                  setRoom(r);
                  setUser(u);
                  setIsLocked(r.isLocked);
                  setStep('room');
                  chatService.setActiveRoomCode(r.code);
              } catch (e) {
                  console.log('Auto login failed', e);
              }
          } else if (student) {
              try {
                  const { room: r, user: u } = chatService.joinRoom(defaultCode, student.nickname, 'student');
                  setRoom(r);
                  setUser(u);
                  setIsLocked(r.isLocked);
                  setStep('room');
              } catch (e) {
                  console.log('Auto login failed', e);
              }
          }
      }
  }, [isTeacherMode, student]);

  // --- Effects ---

  useEffect(() => {
    if (step === 'room' && room) {
      // Initial Load
      setMessages(chatService.getMessages(room.id));
      setRoomUsers(chatService.getRoomUsers(room.id));
      scrollToBottom();

      // Poll for messages and room status (Simulation of real-time)
      pollingRef.current = window.setInterval(() => {
        const msgs = chatService.getMessages(room.id);
        const currentRoom = chatService.getRoom(room.id);
        const users = chatService.getRoomUsers(room.id);
        
        if (currentRoom) {
            setIsLocked(currentRoom.isLocked);
        }

        setMessages(prev => {
            // Only update if length changed to prevent flicker/scroll issues (simplified)
            if (prev.length !== msgs.length) {
                return msgs;
            }
            return prev;
        });
        setRoomUsers(users);
      }, 1000);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [step, room]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!isTeacherMode || step !== 'login') return;
    const classCode = localStorage.getItem('edu_join_code') || '';
    setJoinCode(classCode);
    setRoster(studentService.getRoster());
    studentService.fetchRosterFromDb().then(setRoster).catch(() => {});
    if (classCode) {
      const savedGroups = chatService.getGroups(classCode);
      setGroups(savedGroups);
      const nextAssignments: Record<string, string> = {};
      savedGroups.forEach((g) => {
        g.memberNames.forEach((name) => {
          nextAssignments[name] = g.id;
        });
      });
      setGroupAssignments(nextAssignments);
    }
  }, [isTeacherMode, step]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!emojiPickerRef.current) return;
      if (!emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getClassCode = () => (localStorage.getItem('edu_join_code') || '').trim();

  const ensureGroupAssignments = (nextGroups: ChatGroup[]) => {
    const nextAssignments: Record<string, string> = {};
    nextGroups.forEach((g) => {
      g.memberNames.forEach((name) => {
        nextAssignments[name] = g.id;
      });
    });
    setGroupAssignments(nextAssignments);
  };

  const handleAddGroup = () => {
    const next = [
      ...groups,
      {
        id: generateUUID(),
        name: `모둠 ${groups.length + 1}`,
        code: '',
        memberNames: [],
      },
    ];
    setGroups(next);
  };

  const handleRemoveGroup = (groupId: string) => {
    const next = groups.filter((g) => g.id !== groupId);
    const nextAssignments = { ...groupAssignments };
    Object.keys(nextAssignments).forEach((name) => {
      if (nextAssignments[name] === groupId) delete nextAssignments[name];
    });
    setGroups(next);
    setGroupAssignments(nextAssignments);
  };

  const handleGenerateGroupCode = (groupId: string) => {
    const classCode = getClassCode();
    if (!classCode) {
      setError('학급 코드가 없습니다. 먼저 학급 코드를 생성해주세요.');
      return;
    }
    const existingCodes = groups.map((g) => g.code).filter(Boolean);
    const code = chatService.generateUniqueGroupCode(classCode, existingCodes);
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, code } : g)));
  };

  const handleAssignStudent = (studentName: string, groupId: string) => {
    setGroupAssignments((prev) => ({ ...prev, [studentName]: groupId }));
  };

  const handleSaveGroups = () => {
    const classCode = getClassCode();
    if (!classCode) {
      setError('학급 코드가 없습니다. 먼저 학급 코드를 생성해주세요.');
      return;
    }
    const rosterNames = roster.map((s) => s.name);
    const nextGroups = groups.map((g) => ({
      ...g,
      memberNames: rosterNames.filter((name) => groupAssignments[name] === g.id),
    }));
    chatService.saveGroups(classCode, nextGroups);
    setGroups(nextGroups);
    ensureGroupAssignments(nextGroups);

    nextGroups.forEach((g) => {
      if (!g.code) return;
      const existingRoom = chatService.getRoomByCode(g.code);
      if (!existingRoom) {
        chatService.createRoom('group', { code: g.code, groupId: g.id, groupName: g.name });
      }
    });
    setError('');
  };

  const handlePrepareGroupSetup = () => {
    setShowGroupManager(true);
  };

  const handleKickUser = (target: ChatUser) => {
    if (!room) return;
    if (!confirm(`${target.name} 학생을 내보낼까요?`)) return;
    chatService.kickUser(room.id, target.id, target.name);
    setRoomUsers(chatService.getRoomUsers(room.id));
  };

  const validateGroupJoin = (code: string, name: string) => {
    const classCode = getClassCode();
    if (!classCode) return;
    const group = chatService.findGroupByCode(classCode, code);
    if (!group) return;
    if (!group.memberNames.includes(name.trim())) {
      throw new Error('이 모둠의 구성원만 입장할 수 있습니다.');
    }
  };

  // --- Handlers ---

  const handleCreateRoom = (type: 'class' | 'group') => {
    const classCode = getClassCode();
    if (!classCode) {
        setError('학급 코드가 없습니다. 먼저 학급 코드를 생성해주세요.');
        return;
    }
    if (type === 'group') {
        handlePrepareGroupSetup();
        return;
    }
    const newRoom = chatService.createRoom(type, { code: classCode });
    try {
        const { user: newUser } = chatService.joinRoom(newRoom.code, '선생님', 'teacher');
        setRoom(newRoom);
        setUser(newUser);
        setIsLocked(newRoom.isLocked);
        setStep('room');
        chatService.setActiveRoomCode(newRoom.code);
    } catch (e) {
        setError('방 생성 중 오류가 발생했습니다.');
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
        setError('이름을 입력해주세요.');
        return;
    }
    try {
        if (!isTeacherMode) {
          validateGroupJoin(joinCode, nickname);
        }
        const { room: joinedRoom, user: joinedUser } = chatService.joinRoom(joinCode, nickname, isTeacherMode ? 'teacher' : 'student');
        setRoom(joinedRoom);
        setUser(joinedUser);
        setIsLocked(joinedRoom.isLocked);
        setStep('room');
        if (isTeacherMode) {
          chatService.setActiveRoomCode(joinedRoom.code);
        }
    } catch (e: any) {
        setError(e.message);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !room || !user) return;

    try {
        chatService.sendMessage(room.id, user, inputText);
        setInputText('');
        // Instant update local
        setMessages(chatService.getMessages(room.id));
    } catch (e: any) {
        alert(e.message);
    }
  };

  const EMOJIS = ['😀','😄','😆','😍','🥳','😇','🤩','😎','🥰','😉','😊','🤗','🫶','💖','⭐','🌈','🍀','🐣','🧸','🎈'];

  const handleLeave = () => {
    if (room && user) {
        // chatService.sendSystemMessage(room.id, `${user.name}님이 퇴장했습니다.`);
        // Don't announce exit for simple navigation
        chatService.leaveRoom(user.id);
    }
    if (pollingRef.current) clearInterval(pollingRef.current);
    setRoom(null);
    setUser(null);
    setStep('login');
    setMessages([]);
    setJoinCode('');
  };

  const handleExitToMain = () => {
    if (step === 'room') {
        if (pollingRef.current) clearInterval(pollingRef.current);
    }
    onBack();
  };

  // Teacher Actions
  const handleToggleLock = () => {
      if (!room) return;
      chatService.updateRoomLock(room.id, !isLocked);
      setIsLocked(!isLocked);
  };

  const handleDeleteMessage = (msgId: string) => {
    if (!window.confirm('이 메시지를 삭제하시겠습니까? (학생 화면에서도 사라집니다)')) return;
    chatService.deleteMessage(msgId);
    if(room) setMessages(chatService.getMessages(room.id));
  };

  const handleToggleHideMessage = (msgId: string, nextHidden: boolean) => {
    if (!isTeacherMode) return;
    chatService.toggleHideMessage(msgId, nextHidden);
    if (room) setMessages(chatService.getMessages(room.id));
  };

  const handleMuteUser = (userId: string, userName: string) => {
    if (!window.confirm(`'${userName}' 학생의 채팅을 차단하시겠습니까?`)) return;
    chatService.muteUser(userId);
    if(room) chatService.sendSystemMessage(room.id, `${userName}님의 채팅 권한이 제한되었습니다.`);
  };

  const handleExport = () => {
    if(room) chatService.downloadChatLog(room.id);
  };

  // --- Render ---

  if (showGroupOverview && isTeacherMode) {
    const classCode = getClassCode();
    const groupList = classCode ? chatService.getGroups(classCode) : [];
    const rooms = chatService.listRooms();
    return (
      <div className={`${embedded ? 'h-full' : 'min-h-screen'} bg-rose-50 flex flex-col font-sans`}>
        <header className="bg-white p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowGroupOverview(false)} className="p-2 rounded-lg hover:bg-gray-100">
              <X size={20} />
            </button>
            <h2 className="font-bold text-gray-800">모둠 채팅 전체 보기</h2>
          </div>
          <button onClick={handleExitToMain} className="h-12 px-4 rounded-xl font-bold text-red-500 bg-red-50 hover:bg-red-100 flex items-center gap-2">
            <LogOut size={18}/> 나가기
          </button>
        </header>
        <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto">
          {groupList.length === 0 && (
            <div className="col-span-full text-center text-gray-500">설정된 모둠이 없습니다.</div>
          )}
          {groupList.map((g) => {
            const room = rooms.find((r) => r.code === g.code);
            const last = room ? chatService.getMessages(room.id).slice(-1)[0] : null;
            return (
              <div key={g.id} className="bg-white rounded-2xl border border-rose-100 shadow-sm p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-gray-800">{g.name}</div>
                  <span className="text-xs font-mono bg-rose-50 text-rose-600 px-2 py-1 rounded-full">{g.code || '코드 없음'}</span>
                </div>
                <div className="text-xs text-gray-500">
                  구성원: {g.memberNames.length ? g.memberNames.join(', ') : '미배정'}
                </div>
                <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2 min-h-[60px]">
                  {last ? `${last.senderName}: ${last.text}` : '대화 없음'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (step === 'login') {
    return (
        <div className={`${embedded ? 'h-full rounded-2xl overflow-hidden' : 'min-h-screen'} bg-rose-50 flex items-center justify-center p-4 font-sans relative`}>
             <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-up relative">
                <div className="bg-rose-500 p-6 text-white text-center relative">
                    {/* Back Button positioned inside the header */}
                    {!embedded && (
                        <button onClick={onBack} className="absolute top-6 left-6 text-white/80 hover:text-white transition-colors" title="첫 화면으로">
                            <Home size={24} />
                        </button>
                    )}
                    
                    <MessageCircle size={48} className="mx-auto mb-2 opacity-90" />
                    <h1 className="font-hand text-3xl font-bold">우리교실 톡톡 💬</h1>
                    <p className="opacity-90 mt-2">친구들과 즐겁게 이야기해요</p>
                </div>

                <div className="p-8">
                    {isTeacherMode ? (
                        <div className="space-y-6">
                            <div className="text-center">
                                <h3 className="font-bold text-gray-800 text-lg mb-2">선생님, 수업 방을 만들까요?</h3>
                                <p className="text-sm text-gray-500 mb-6">수업 목적에 맞는 방 유형을 선택하세요.</p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    onClick={() => handleCreateRoom('class')}
                                    className="bg-rose-100 hover:bg-rose-200 text-rose-700 p-4 rounded-2xl flex flex-col items-center gap-2 transition-all border-2 border-transparent hover:border-rose-300"
                                >
                                    <Users size={32} />
                                    <span className="font-bold">학급 전체용</span>
                                </button>
                                <button 
                                    onClick={() => handleCreateRoom('group')}
                                    className="bg-orange-100 hover:bg-orange-200 text-orange-700 p-4 rounded-2xl flex flex-col items-center gap-2 transition-all border-2 border-transparent hover:border-orange-300"
                                >
                                    <Users size={32} className="opacity-70" />
                                    <span className="font-bold">모둠 활동용</span>
                                </button>
                            </div>
                            
                            <div className="relative flex py-2 items-center">
                                <div className="flex-grow border-t border-gray-300"></div>
                                <span className="flex-shrink mx-4 text-gray-400 text-xs">또는 기존 방 입장</span>
                                <div className="flex-grow border-t border-gray-300"></div>
                            </div>
                        </div>
                    ) : null}
                    
                    {/* Join Form */}
                    <form onSubmit={handleJoinRoom} className="space-y-4 mt-2">
                        {!isTeacherMode && (
                            <div className="text-center mb-6">
                                <p className="text-gray-600">선생님이 알려주신 번호를 입력하세요</p>
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">방 코드 (6자리)</label>
                            <input 
                                type="text"
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value)} 
                                placeholder="123456"
                                className="w-full text-center text-3xl tracking-[0.5em] p-3 border rounded-xl focus:ring-2 focus:ring-rose-500 font-mono"
                                maxLength={6}
                                required
                            />
                        </div>

                        {!isTeacherMode && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">내 이름 (실명)</label>
                                <input 
                                    type="text"
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)} 
                                    placeholder="예: 김민수(토끼)"
                                    className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-rose-500"
                                    required
                                />
                            </div>
                        )}

                        {error && <p className="text-red-500 text-center text-sm">{error}</p>}

                        <button type="submit" className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-all text-lg mt-4">
                            입장하기 🚀
                        </button>
                    </form>

                    {isTeacherMode && showGroupManager && (
                      <div className="mt-8 border-t pt-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-gray-800 flex items-center gap-2"><Settings size={18}/> 모둠 설정</h4>
                          <button
                            type="button"
                            onClick={handleAddGroup}
                            className="text-sm font-bold text-rose-600 hover:text-rose-700"
                          >
                            + 모둠 추가
                          </button>
                        </div>

                        {groups.length === 0 && (
                          <div className="text-sm text-gray-500">모둠을 추가해주세요.</div>
                        )}

                        {groups.map((group) => (
                          <div key={group.id} className="bg-rose-50/60 border border-rose-100 rounded-2xl p-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <input
                                value={group.name}
                                onChange={(e) =>
                                  setGroups((prev) =>
                                    prev.map((g) => (g.id === group.id ? { ...g, name: e.currentTarget.value } : g))
                                  )
                                }
                                className="flex-1 bg-white border rounded-lg px-3 py-2 text-sm font-bold"
                                placeholder="모둠 이름"
                              />
                              <button
                                type="button"
                                onClick={() => handleGenerateGroupCode(group.id)}
                                className="px-3 py-2 rounded-lg bg-rose-500 text-white text-xs font-bold flex items-center gap-1"
                              >
                                <Shuffle size={14} /> 랜덤 코드
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveGroup(group.id)}
                                className="px-2 py-2 rounded-lg text-rose-500 hover:bg-rose-100 text-xs font-bold"
                              >
                                삭제
                              </button>
                            </div>
                            <div className="text-xs text-gray-500">
                              코드: <span className="font-mono text-rose-600">{group.code || '미생성'}</span>
                            </div>
                          </div>
                        ))}

                        {roster.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-sm font-bold text-gray-700">학생 배정</div>
                            <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                              {roster.map((studentInfo) => (
                                <div key={studentInfo.id} className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-gray-700 w-28">{studentInfo.name}</span>
                                  <select
                                    value={groupAssignments[studentInfo.name] || ''}
                                    onChange={(e) => handleAssignStudent(studentInfo.name, e.currentTarget.value)}
                                    className="flex-1 border rounded-lg px-2 py-2 text-sm"
                                  >
                                    <option value="">미배정</option>
                                    {groups.map((g) => (
                                      <option key={g.id} value={g.id}>{g.name}</option>
                                    ))}
                                  </select>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={handleSaveGroups}
                          className="w-full bg-rose-600 text-white font-bold py-3 rounded-xl shadow-md"
                        >
                          모둠 저장
                        </button>
                      </div>
                    )}
                </div>
             </div>
        </div>
    );
  }

  // --- Locked View for Students ---
  if (!isTeacherMode && isLocked && step === 'room') {
      return (
          <div className={`${embedded ? 'h-full' : 'min-h-screen'} bg-gray-100 flex flex-col font-sans max-w-2xl mx-auto shadow-2xl relative`}>
              <header className="bg-white p-4 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                      {!embedded && <button onClick={handleExitToMain} className="p-2 hover:bg-gray-100 rounded-lg"><Home size={20}/></button>}
                      <h2 className="font-bold text-gray-800">우리교실 톡톡</h2>
                  </div>
                  <button onClick={handleLeave} className="h-12 px-4 rounded-xl font-bold text-red-500 bg-red-50 hover:bg-red-100 flex items-center gap-2">
                    <LogOut size={18}/> 나가기
                  </button>
              </header>
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-rose-50/50">
                  <div className="bg-white p-8 rounded-full shadow-lg mb-6 animate-bounce">
                      <Lock size={64} className="text-rose-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-3">채팅방이 닫혀있어요</h2>
                  <p className="text-gray-600">선생님이 채팅방을 열어주실 때까지<br/>잠시만 기다려주세요.</p>
              </div>
          </div>
      )
  }

  return (
    <div className={`${embedded ? 'h-full' : 'min-h-screen'} bg-gray-100 flex flex-col font-sans max-w-2xl mx-auto shadow-2xl relative`}>
        {/* Chat Header */}
        <header className="bg-white p-4 shadow-sm flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-3">
                {!embedded && (
                    <button 
                        onClick={handleExitToMain}
                        className="p-2 bg-gray-50 text-gray-500 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors"
                        title="처음으로"
                    >
                        <Home size={20} />
                    </button>
                )}
                
                {!embedded && <div className="h-6 w-px bg-gray-200"></div>}

                <div className="bg-rose-100 p-2 rounded-full text-rose-600">
                    <MessageCircle size={24} />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="font-bold text-gray-800 text-lg">
                            {room?.type === 'class' ? '우리반 채팅방' : '모둠 채팅방'}
                        </h2>
                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-mono border">
                            CODE: {room?.code}
                        </span>
                    </div>
                    <p className="text-xs text-gray-500">
                        참여자: <strong>{user?.name}</strong> {isTeacherMode && '(선생님)'}
                    </p>
                </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {isTeacherMode && (
                    <>
                        {room?.type === 'group' && (
                          <button
                            onClick={() => setShowGroupOverview(true)}
                            className="h-12 px-4 rounded-xl font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center gap-2 w-full sm:w-auto justify-center"
                          >
                            <Users size={18} /> 모둠 전체 보기
                          </button>
                        )}
                        <button
                            onClick={handleToggleLock}
                            className={`h-12 px-4 rounded-xl font-bold transition-colors w-full sm:w-auto flex items-center justify-center gap-2 ${
                                isLocked
                                    ? 'bg-rose-600 text-white hover:bg-rose-700'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                            title={isLocked ? "채팅방 열기" : "채팅방 잠그기"}
                        >
                            {isLocked ? <Unlock size={18} /> : <Lock size={18} />}
                            {isLocked ? '채팅 시작 허용' : '채팅 잠금'}
                        </button>
                        <button 
                            onClick={handleExport}
                            className="h-12 px-3 text-gray-500 hover:bg-gray-100 hover:text-blue-600 rounded-xl transition-colors flex items-center justify-center"
                            title="대화 저장"
                        >
                            <Download size={20} />
                        </button>
                    </>
                )}
                <button 
                    onClick={handleLeave}
                    className="h-12 px-4 rounded-xl font-bold text-red-500 bg-red-50 hover:bg-red-100 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
                    title="나가기"
                >
                    <LogOut size={18} /> 나가기
                </button>
            </div>
        </header>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#b2c7d9]/30">
            {isTeacherMode && isLocked && (
                <div className="bg-rose-100 border border-rose-200 text-rose-700 px-4 py-2 rounded-lg text-center text-sm font-bold mb-4 flex items-center justify-center gap-2">
                    <Lock size={16} /> 현재 학생들은 채팅을 입력할 수 없습니다. (잠금 상태)
                </div>
            )}

            {isTeacherMode && roomUsers.length > 0 && (
              <div className="bg-white/80 border border-rose-100 rounded-2xl p-3">
                <div className="text-sm font-bold text-gray-700 mb-2">참여자</div>
                <div className="flex flex-wrap gap-2">
                  {roomUsers
                    .filter((u) => u.role === 'student')
                    .map((u) => (
                      <div key={u.id} className="flex items-center gap-2 bg-rose-50 px-3 py-1.5 rounded-full text-xs">
                        <span className="font-bold text-rose-700">{u.name}</span>
                        <button
                          type="button"
                          onClick={() => handleKickUser(u)}
                          className="text-rose-500 hover:text-rose-700"
                        >
                          내보내기
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="text-center py-4">
                <span className="bg-gray-200/80 text-gray-600 px-3 py-1 rounded-full text-xs">
                    {new Date(room!.createdAt).toLocaleDateString()} 채팅방이 열렸습니다.
                </span>
            </div>

            {messages.filter((msg) => (isTeacherMode ? true : !msg.isHidden)).map((msg) => {
                const isMe = msg.senderId === user?.id;
                const isSystem = msg.type === 'system';

                if (isSystem) {
                    return (
                        <div key={msg.id} className="flex justify-center my-2">
                             <span className="bg-black/20 text-white px-3 py-1 rounded-full text-xs flex items-center gap-1">
                                {msg.text}
                             </span>
                        </div>
                    );
                }

                return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                        <div className={`max-w-[80%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            {!isMe && <span className="text-xs text-gray-600 ml-1 mb-1">{msg.senderName}</span>}
                            
                            <div className="flex items-end gap-1">
                                {isMe && (
                                    <span className="text-[10px] text-gray-400 min-w-[30px] text-right mb-1">
                                        {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                )}
                                <div className={`px-4 py-2 rounded-2xl shadow-sm text-sm break-words relative ${
                                    isMe 
                                    ? 'bg-rose-500 text-white rounded-tr-none' 
                                    : 'bg-white text-gray-800 rounded-tl-none'
                                }`}>
                                    {msg.text}
                                </div>
                                {!isMe && (
                                    <span className="text-[10px] text-gray-400 min-w-[30px] mb-1">
                                        {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                )}
                            </div>

                            {/* Teacher Controls per message */}
                            {isTeacherMode && !isMe && (
                                <div className="hidden group-hover:flex gap-2 mt-1 ml-1">
                                    <button 
                                        onClick={() => handleToggleHideMessage(msg.id, !msg.isHidden)}
                                        className="text-xs text-gray-400 hover:text-rose-500 flex items-center gap-1"
                                    >
                                        {msg.isHidden ? <Eye size={12} /> : <EyeOff size={12} />}
                                        {msg.isHidden ? '표시' : '가리기'}
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteMessage(msg.id)}
                                        className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1"
                                    >
                                        <Trash2 size={12} /> 삭제
                                    </button>
                                    <button 
                                        onClick={() => handleMuteUser(msg.senderId, msg.senderName)}
                                        className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1"
                                    >
                                        <Ban size={12} /> 차단
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
            <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-white p-3 border-t">
            <form onSubmit={handleSendMessage} className="flex gap-2">
                <div className="relative" ref={emojiPickerRef}>
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker((prev) => !prev)}
                      className="h-12 w-12 rounded-full bg-gray-100 text-gray-600 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center"
                      title="이모티콘"
                    >
                      <Smile size={20} />
                    </button>
                    {showEmojiPicker && (
                      <div className="absolute bottom-14 left-0 bg-white border border-gray-200 shadow-lg rounded-2xl p-3 grid grid-cols-6 gap-2 z-10">
                        {EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              setInputText((prev) => `${prev}${emoji}`);
                              setShowEmojiPicker(false);
                            }}
                            className="w-8 h-8 rounded-lg hover:bg-gray-100 text-lg"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                </div>
                <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={!isTeacherMode && isLocked ? "채팅방이 잠겨있습니다." : "메시지를 입력하세요..."}
                    className="flex-1 bg-gray-100 border-0 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-rose-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!isTeacherMode && isLocked}
                />
                <button 
                    type="submit" 
                    disabled={!inputText.trim() || (!isTeacherMode && isLocked)}
                    className="bg-rose-500 text-white p-3 rounded-full hover:bg-rose-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-md"
                >
                    <Send size={20} className={inputText.trim() ? "ml-0.5" : ""} />
                </button>
            </form>
        </div>
    </div>
  );
};
