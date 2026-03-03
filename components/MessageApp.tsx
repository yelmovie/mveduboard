
import React, { useState, useEffect, useRef } from 'react';
import { Home, Send, User, MessageCircle, ChevronLeft, Search, CheckCheck, Save, PanelLeftClose, PanelLeft } from 'lucide-react';
import * as messageService from '../services/messageService';
import { PrivateMessage, Participant } from '../types';

interface MessageAppProps {
  onBack: () => void;
  isTeacherMode: boolean;
  student: Participant | null;
  onLoginRequest: () => void;
  embedded?: boolean;
}

interface ChatRoomProps {
    title: string;
    subTitle?: string;
    messages: PrivateMessage[];
    currentUserId: string; // 'teacher' or 'student' (for alignment)
    onSendMessage: (text: string) => void;
    onBack?: () => void;
    onLeave?: () => void;
    onHome?: () => void;
}

const ChatRoom: React.FC<ChatRoomProps> = ({ title, subTitle, messages, currentUserId, onSendMessage, onBack, onLeave, onHome }) => {
    const [text, setText] = useState('');
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim()) return;
        onSendMessage(text);
        setText('');
    };

    return (
        <div className="flex flex-col h-full bg-white">
            <header className="bg-emerald-600 text-white p-4 shadow-md flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button onClick={onBack} className="p-2 hover:bg-emerald-700 rounded-full transition-colors" title="뒤로">
                            <ChevronLeft size={24} />
                        </button>
                    )}
                    <div>
                        <h2 className="font-bold text-lg">{title}</h2>
                        {subTitle && <p className="text-xs opacity-90">{subTitle}</p>}
                    </div>
                </div>
                {(onHome || onLeave) && (
                    <div className="flex flex-col sm:flex-row gap-2">
                        {onHome && (
                            <button
                                onClick={onHome}
                                className="h-12 px-4 w-full sm:w-auto bg-white/10 hover:bg-white/20 rounded-full text-xs font-bold"
                            >
                                홈으로
                            </button>
                        )}
                        {onLeave && (
                            <button
                                onClick={onLeave}
                                className="h-12 px-4 w-full sm:w-auto bg-emerald-700/70 hover:bg-emerald-700 rounded-full text-xs font-bold"
                            >
                                나가기
                            </button>
                        )}
                    </div>
                )}
            </header>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-100 space-y-4">
                {messages.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 text-sm">
                        대화 내용이 없습니다.
                    </div>
                ) : (
                    messages.map(msg => {
                        const isMe = (currentUserId === 'teacher' && msg.sender === 'teacher') || (currentUserId === 'student' && msg.sender === 'student');
                        return (
                            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm shadow-sm ${
                                    isMe 
                                    ? 'bg-emerald-500 text-white rounded-tr-none' 
                                    : 'bg-white text-gray-800 rounded-tl-none border border-gray-200'
                                }`}>
                                    {msg.content}
                                </div>
                                <div className="flex items-center gap-1 mt-1 px-1">
                                    <span className="text-[10px] text-gray-400">
                                        {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                    {isMe && (
                                        <span className={`text-[10px] font-bold ${msg.isRead ? 'text-emerald-600' : 'text-gray-400'}`}>
                                            {msg.isRead ? '읽음' : '안읽음'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )
                    })
                )}
                <div ref={endRef} />
            </div>

            <div className="p-3 bg-white border-t border-gray-200 shrink-0">
                <form onSubmit={handleSend} className="flex gap-2">
                    <input 
                        type="text" 
                        value={text} 
                        onChange={e => setText(e.target.value)}
                        placeholder="메시지를 입력하세요..."
                        className="flex-1 bg-gray-100 border-none rounded-full px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                    <button type="submit" disabled={!text.trim()} className="bg-emerald-600 text-white p-2 rounded-full hover:bg-emerald-700 disabled:bg-gray-300 transition-colors">
                        <Send size={20} className={text.trim() ? "ml-0.5" : ""} />
                    </button>
                </form>
            </div>
        </div>
    )
}

export const MessageApp: React.FC<MessageAppProps> = ({ onBack, isTeacherMode, student, onLoginRequest, embedded = false }) => {
  const [activeStudent, setActiveStudent] = useState<string | null>(null);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [studentList, setStudentList] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showStudentList, setShowStudentList] = useState(true);

  const confirmAndLeaveChat = (studentName: string, afterLeave?: () => void) => {
      const ok = window.confirm('채팅방을 나가시겠습니까? 대화 내용은 삭제됩니다.');
      if (!ok) return;
      messageService.clearMessagesForStudent(studentName);
      loadData();
      if (afterLeave) afterLeave();
  };

  // Polling for updates
  useEffect(() => {
      loadData();
      const interval = setInterval(loadData, 2000);
      return () => clearInterval(interval);
  }, [activeStudent, isTeacherMode, student]);

  const loadData = () => {
      if (isTeacherMode) {
          setStudentList(messageService.getActiveStudentList());
          if (activeStudent) {
              const msgs = messageService.getMessagesForStudent(activeStudent);
              setMessages(msgs);
              // Mark as read if viewing
              if (msgs.some(m => m.sender === 'student' && !m.isRead)) {
                  messageService.markAsRead(activeStudent, 'teacher');
              }
          }
      } else if (student) {
          const msgs = messageService.getMessagesForStudent(student.nickname);
          setMessages(msgs);
          if (msgs.some(m => m.sender === 'teacher' && !m.isRead)) {
              messageService.markAsRead(student.nickname, 'student');
          }
      }
  };

  const handleSendMessage = (text: string) => {
      if (isTeacherMode && activeStudent) {
          messageService.sendMessage(activeStudent, text, 'teacher');
      } else if (!isTeacherMode && student) {
          messageService.sendMessage(student.nickname, text, 'student');
      }
      loadData(); // Immediate update
  };

  const downloadMessages = (items: PrivateMessage[], filename: string) => {
      const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
  };

  const handleSaveMessages = () => {
      setIsSaving(true);
      const now = new Date();
      const dateTag = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      if (isTeacherMode) {
          const target = activeStudent || '전체';
          const items = activeStudent ? messageService.getMessagesForStudent(activeStudent) : messageService.getAllMessages();
          downloadMessages(items, `쪽지함_${target}_${dateTag}.json`);
      } else if (student) {
          const items = messageService.getMessagesForStudent(student.nickname);
          downloadMessages(items, `쪽지함_${student.nickname}_${dateTag}.json`);
      }
      setTimeout(() => setIsSaving(false), 300);
  };

  // --- Student View ---
  if (!isTeacherMode) {
      if (!student) {
          return (
              <div className={`${embedded ? 'h-full' : 'min-h-screen'} bg-gray-100 flex items-center justify-center p-4`}>
                  <div className="bg-white p-8 rounded-2xl shadow-lg text-center max-w-sm w-full">
                      <MessageCircle size={48} className="mx-auto mb-4 text-emerald-200" />
                      <h2 className="text-xl font-bold text-gray-800 mb-2">선생님과의 1:1 대화</h2>
                      <p className="text-gray-500 mb-6 text-sm">로그인 후 이용할 수 있습니다.</p>
                      <div className="flex gap-2">
                          {!embedded && <button onClick={onBack} className="flex-1 py-2 border rounded-lg text-gray-600 hover:bg-gray-50">돌아가기</button>}
                          <button onClick={onLoginRequest} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold">로그인</button>
                      </div>
                  </div>
              </div>
          )
      }

      return (
          <div className={`${embedded ? 'h-full' : 'min-h-screen'} bg-gray-100 flex flex-col font-sans`}>
              <div className={`max-w-2xl mx-auto w-full h-full bg-white shadow-xl ${embedded ? '' : 'sm:my-4 sm:rounded-2xl sm:h-[calc(100vh-2rem)]'} overflow-hidden`}>
                  <ChatRoom 
                    title="선생님" 
                    subTitle="선생님과 단 둘이 이야기 해요" 
                    messages={messages}
                    currentUserId="student"
                    onSendMessage={handleSendMessage}
                    onBack={embedded ? undefined : onBack}
                    onHome={onBack}
                    onLeave={() => confirmAndLeaveChat(student.nickname, embedded ? undefined : onBack)}
                  />
              </div>
          </div>
      );
  }

  // --- Teacher View ---
  return (
      <div className={`${embedded ? 'h-full' : 'min-h-screen'} bg-slate-50 flex flex-col font-sans overflow-hidden`}>
          {!embedded && (
            <header className="bg-white p-4 border-b flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500"><Home size={20}/></button>
                    <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <MessageCircle className="text-emerald-600" /> 쪽지함
                    </h1>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSaveMessages}
                        disabled={isSaving}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-emerald-700 shadow-sm text-sm flex items-center gap-2 disabled:opacity-60"
                    >
                        <Save size={16}/> 저장
                    </button>
                    {activeStudent ? (
                        <button
                            onClick={() => confirmAndLeaveChat(activeStudent, () => { setActiveStudent(null); setShowStudentList(true); })}
                            className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg font-bold hover:bg-gray-200 text-sm"
                        >
                            나가기
                        </button>
                    ) : (
                        <button
                            onClick={onBack}
                            className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg font-bold hover:bg-gray-200 text-sm"
                        >
                            나가기
                        </button>
                    )}
                </div>
            </header>
          )}

          <div className={`flex-1 flex overflow-hidden w-full ${embedded ? '' : 'max-w-7xl mx-auto sm:p-4'}`}>
              <div className={`bg-white shadow-xl w-full flex overflow-hidden border border-gray-200 ${embedded ? '' : 'rounded-2xl'}`}>
                  {/* Toggle: Show list when hidden */}
                  {!showStudentList && (
                      <button
                          onClick={() => setShowStudentList(true)}
                          className="shrink-0 w-12 bg-gray-100 hover:bg-emerald-50 border-r border-gray-200 flex flex-col items-center justify-center gap-1 py-4 text-gray-600 hover:text-emerald-600 transition-colors"
                          title="학생 명단 보기"
                      >
                          <PanelLeft size={22} />
                          <span className="text-[10px] font-bold">명단</span>
                      </button>
                  )}

                  {/* Sidebar (Student List) - Toggleable */}
                  {showStudentList && (
                  <div className={`w-full sm:w-80 bg-gray-50 border-r border-gray-200 flex flex-col shrink-0 ${activeStudent ? 'hidden sm:flex' : 'flex'}`}>
                      <div className="p-4 border-b border-gray-200 bg-white shrink-0">
                          <div className="flex items-center gap-2">
                              <div className="relative flex-1 min-w-0">
                                  <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                                  <input 
                                    type="text" 
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="이름 검색..." 
                                    className="w-full pl-10 pr-4 py-2 bg-gray-100 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 text-sm"
                                  />
                              </div>
                              <button
                                  onClick={() => setShowStudentList(false)}
                                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 shrink-0"
                                  title="명단 접기"
                              >
                                  <PanelLeftClose size={20} />
                              </button>
                          </div>
                      </div>
                      <div className="flex-1 overflow-y-auto">
                          {studentList.filter(name => name.includes(search)).map(name => {
                              const unreadCount = messageService.getUnreadCount(name, 'teacher');
                              return (
                                  <button
                                    key={name}
                                    onClick={() => setActiveStudent(name)}
                                    className={`w-full p-4 flex items-center gap-3 hover:bg-gray-100 transition-colors border-b border-gray-100 text-left ${activeStudent === name ? 'bg-emerald-50 border-l-4 border-l-emerald-500' : 'border-l-4 border-l-transparent'}`}
                                  >
                                      <div className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-500 shrink-0">
                                          <User size={20} />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                          <div className="font-bold text-gray-800 truncate">{name}</div>
                                          <div className="text-xs text-gray-500 truncate">
                                              최근 대화: {new Date().toLocaleDateString()}
                                          </div>
                                      </div>
                                      {unreadCount > 0 && (
                                          <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">{unreadCount}</span>
                                      )}
                                  </button>
                              )
                          })}
                      </div>
                  </div>
                  )}

                  {/* Main Chat Area */}
                  <div className={`flex-1 flex flex-col min-w-0 ${!activeStudent ? 'hidden sm:flex' : 'flex'}`}>
                      {activeStudent ? (
                          <ChatRoom 
                            title={activeStudent}
                            subTitle="학생과의 1:1 대화"
                            messages={messages}
                            currentUserId="teacher"
                            onSendMessage={handleSendMessage}
                            onBack={() => { setActiveStudent(null); setShowStudentList(true); }}
                            onLeave={() => confirmAndLeaveChat(activeStudent, () => { setActiveStudent(null); setShowStudentList(true); })}
                          />
                      ) : (
                          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-slate-50">
                              <MessageCircle size={64} className="mb-4 opacity-20" />
                              <p>왼쪽 목록에서 학생을 선택하여 대화를 시작하세요.</p>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      </div>
  );
};
