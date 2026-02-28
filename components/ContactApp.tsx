
import React, { useState, useEffect } from 'react';
import { Home, Send, Lock, Unlock, MessageCircle, Lightbulb, Trash2, CheckCircle, AlertCircle, X } from 'lucide-react';
import * as contactService from '../services/contactService';
import { Inquiry } from '../services/contactService';

interface ContactAppProps {
  onBack: () => void;
}

type ViewMode = 'form' | 'login' | 'admin';

export const ContactApp: React.FC<ContactAppProps> = ({ onBack }) => {
  const [view, setView] = useState<ViewMode>('form');
  
  // Form State
  const [type, setType] = useState<'qna' | 'feature'>('qna');
  const [author, setAuthor] = useState('');
  const [content, setContent] = useState('');
  
  // Login State
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Admin State
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);

  useEffect(() => {
    if (view === 'admin') {
        setInquiries(contactService.getInquiries());
    }
  }, [view]);

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!author.trim() || !content.trim()) {
          alert('내용을 입력해주세요.');
          return;
      }
      contactService.addInquiry(type, author, content);
      alert('소중한 의견이 개발자에게 전달되었습니다! 💌');
      setAuthor('');
      setContent('');
  };

  const handleLogin = (e: React.FormEvent) => {
      e.preventDefault();
      if (password === '5050') {
          setView('admin');
          setError('');
          setPassword('');
      } else {
          setError('비밀번호가 일치하지 않습니다.');
      }
  };

  const handleDelete = (id: string) => {
      if(confirm('삭제하시겠습니까?')) {
          contactService.deleteInquiry(id);
          setInquiries(contactService.getInquiries());
      }
  };

  const handleStatusToggle = (id: string, currentStatus: string) => {
      const next = currentStatus === 'completed' ? 'unread' : 'completed';
      contactService.updateStatus(id, next);
      setInquiries(contactService.getInquiries());
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white p-4 shadow-sm flex justify-between items-center sticky top-0 z-10 border-b border-gray-200">
          <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
                  <Home size={20} />
              </button>
              <h1 className="font-bold text-slate-800 text-xl flex items-center gap-2">
                  <MessageCircle className="text-blue-500" /> 개발자에게 문의하기
              </h1>
          </div>
          {view !== 'admin' && (
              <button onClick={() => setView('login')} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                  <Lock size={12} /> 관리자
              </button>
          )}
          {view === 'admin' && (
              <button onClick={() => setView('form')} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 font-bold">
                  <Unlock size={12} /> 나가기
              </button>
          )}
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full p-6">
          
          {/* 1. Public Submission Form */}
          {view === 'form' && (
              <div className="bg-white rounded-3xl shadow-xl p-8 border border-blue-100 animate-fade-in-up">
                  <div className="text-center mb-8">
                      <h2 className="text-2xl font-bold text-gray-800 mb-2">무엇을 도와드릴까요?</h2>
                      <p className="text-gray-500">버그 제보, 기능 추가 요청, 기타 문의사항을 남겨주세요.</p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="flex bg-gray-100 p-1 rounded-xl">
                          <button 
                            type="button"
                            onClick={() => setType('qna')}
                            className={`flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${type === 'qna' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                          >
                              <AlertCircle size={18} /> 질문/오류
                          </button>
                          <button 
                            type="button"
                            onClick={() => setType('feature')}
                            className={`flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${type === 'feature' ? 'bg-white text-yellow-600 shadow-sm' : 'text-gray-500'}`}
                          >
                              <Lightbulb size={18} /> 기능 제안
                          </button>
                      </div>

                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">작성자 (이메일 또는 이름)</label>
                          <input 
                            type="text" 
                            value={author}
                            onChange={e => setAuthor(e.target.value)}
                            className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-blue-500 transition-colors"
                            placeholder="답변을 받으실 연락처를 남겨주셔도 좋아요."
                          />
                      </div>

                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">내용</label>
                          <textarea 
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            className="w-full h-40 border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                            placeholder={type === 'qna' ? '이용 중 불편한 점이나 궁금한 점을 적어주세요.' : '이런 기능이 있으면 좋겠어요! 아이디어를 들려주세요.'}
                          />
                      </div>

                      <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 text-lg">
                          <Send size={20} /> 보내기
                      </button>
                  </form>
              </div>
          )}

          {/* 2. Admin Login */}
          {view === 'login' && (
              <div className="max-w-sm mx-auto bg-white rounded-3xl shadow-xl p-8 border border-gray-200 mt-10">
                  <h2 className="text-xl font-bold text-center mb-6 flex items-center justify-center gap-2">
                      <Lock className="text-red-500" /> 관리자 접근
                  </h2>
                  <form onSubmit={handleLogin} className="space-y-4">
                      <input 
                        type="password" 
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="비밀번호 입력 (Hint: 5050)"
                        className="w-full border-2 border-gray-200 rounded-xl p-3 text-center text-lg tracking-widest focus:outline-none focus:border-red-500"
                        autoFocus
                      />
                      {error && <p className="text-red-500 text-sm text-center font-bold">{error}</p>}
                      <div className="flex gap-2">
                          <button type="button" onClick={() => setView('form')} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-600">취소</button>
                          <button type="submit" className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600">확인</button>
                      </div>
                  </form>
              </div>
          )}

          {/* 3. Admin Dashboard */}
          {view === 'admin' && (
              <div className="space-y-6">
                  <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold text-gray-800">접수된 문의함</h2>
                      <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-bold">
                          총 {inquiries.length}건
                      </span>
                  </div>

                  {inquiries.length === 0 ? (
                      <div className="text-center py-20 text-gray-400 bg-white rounded-2xl border border-dashed">
                          <MessageCircle size={48} className="mx-auto mb-4 opacity-20" />
                          <p>접수된 메시지가 없습니다.</p>
                      </div>
                  ) : (
                      <div className="space-y-4">
                          {inquiries.map(item => (
                              <div key={item.id} className={`bg-white p-5 rounded-2xl shadow-sm border-l-4 ${item.type === 'feature' ? 'border-yellow-400' : 'border-blue-400'} ${item.status === 'completed' ? 'opacity-60 bg-gray-50' : ''}`}>
                                  <div className="flex justify-between items-start mb-3">
                                      <div className="flex items-center gap-2">
                                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${item.type === 'feature' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                                              {item.type === 'feature' ? '기능제안' : 'Q&A'}
                                          </span>
                                          <span className="font-bold text-gray-700">{item.author}</span>
                                          <span className="text-xs text-gray-400">{new Date(item.createdAt).toLocaleDateString()}</span>
                                      </div>
                                      <div className="flex gap-2">
                                          <button 
                                            onClick={() => handleStatusToggle(item.id, item.status)}
                                            className={`p-1 rounded-full ${item.status === 'completed' ? 'text-green-500 bg-green-50' : 'text-gray-300 hover:text-green-500'}`}
                                            title="처리 완료 표시"
                                          >
                                              <CheckCircle size={20} />
                                          </button>
                                          <button onClick={() => handleDelete(item.id)} className="p-1 text-gray-300 hover:text-red-500">
                                              <Trash2 size={20} />
                                          </button>
                                      </div>
                                  </div>
                                  <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{item.content}</p>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          )}

      </main>
    </div>
  );
};
