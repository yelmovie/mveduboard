
import React, { useState, useEffect, useRef } from 'react';
import { Home, NotebookText, PenLine, Book, Calculator, User, Printer, FileText, Download, ChevronRight, Search, ClipboardCheck } from 'lucide-react';
import { BoardApp } from '../BoardApp';
import { OmrApp } from './OmrApp';
import { Participant, ClassStudent, Post } from '../types';
import * as studentService from '../services/studentService';
import * as boardService from '../services/boardService';

interface LearningAppProps {
  onBack: () => void;
  isTeacherMode: boolean;
  student: Participant | null;
  onLoginRequest: () => void;
}

type Tab = 'learning' | 'writing' | 'reading' | 'math' | 'omr' | 'portfolio';

export const LearningApp: React.FC<LearningAppProps> = ({ onBack, isTeacherMode, student, onLoginRequest }) => {
  const [activeTab, setActiveTab] = useState<Tab>('learning');
  
  // --- Portfolio State ---
  const [roster, setRoster] = useState<ClassStudent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentPosts, setStudentPosts] = useState<{ category: string, posts: Post[] }[]>([]);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Load Roster for Portfolio (학급 명단 연동)
  useEffect(() => {
      if (activeTab !== 'portfolio' || !isTeacherMode) return;
      setRoster(studentService.getRoster());
      const init = async () => {
        try {
          await studentService.preloadClassId();
          await studentService.fetchRosterFromDb();
        } catch {}
        const loadedRoster = studentService.getRoster();
        setRoster(loadedRoster);
        if (loadedRoster.length > 0 && !selectedStudentId) {
          setSelectedStudentId(loadedRoster[0].id);
        }
      };
      init();
  }, [activeTab, isTeacherMode]);

  // 학생 선택 시 해당 학생의 영역별 기록 로드
  useEffect(() => {
      if (activeTab === 'portfolio' && isTeacherMode && selectedStudentId) {
          loadStudentPortfolio(selectedStudentId);
      }
  }, [activeTab, isTeacherMode, selectedStudentId]);

  const loadStudentPortfolio = async (studentId: string) => {
      setLoadingPortfolio(true);
      const categories = [
          { id: 'learning', name: '배움노트' },
          { id: 'writing', name: '주제글쓰기' },
          { id: 'reading', name: '독서록' },
          { id: 'math', name: '수학오답노트' },
      ];

      const aggregatedData: { category: string; posts: Post[] }[] = [];

      for (const cat of categories) {
          const posts = await boardService.getPosts(cat.id);
          const myPosts = posts.filter(p => p.author_participant_id === studentId);
          aggregatedData.push({
              category: cat.name,
              posts: myPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
          });
      }

      setStudentPosts(aggregatedData);
      setLoadingPortfolio(false);
  };

  const handlePrint = () => {
      window.print();
  };

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: 'learning', label: '배움노트', icon: NotebookText },
    { id: 'writing', label: '주제글쓰기', icon: PenLine },
    { id: 'reading', label: '독서록', icon: Book },
    { id: 'math', label: '수학오답노트', icon: Calculator },
    { id: 'omr', label: 'OMR', icon: ClipboardCheck },
  ];

  if (isTeacherMode) {
      TABS.push({ id: 'portfolio', label: '학생별 기록(인쇄)', icon: FileText });
  }

  // --- Portfolio View Component ---
  const renderPortfolio = () => {
      const selectedStudent = roster.find(s => s.id === selectedStudentId);

      return (
          <div className="flex flex-col md:flex-row h-full bg-slate-50">
              {/* Sidebar: Student List (Hidden on Print) */}
              <div className="w-full md:w-64 bg-white border-r border-gray-200 overflow-y-auto no-print">
                  <div className="p-4 border-b bg-gray-50">
                      <h3 className="font-bold text-gray-700 flex items-center gap-2"><User size={18}/> 학생 명단</h3>
                  </div>
                  <div className="p-2 space-y-1">
                      {roster.length === 0 ? (
                          <div className="px-4 py-6 text-center text-sm text-gray-500">
                              학급관리에서 학생 명단을 먼저 등록해주세요.
                          </div>
                      ) : (
                          roster.map(s => (
                              <button
                                key={s.id}
                                onClick={() => setSelectedStudentId(s.id)}
                                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-between
                                    ${selectedStudentId === s.id ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-gray-600 hover:bg-gray-100'}
                                `}
                              >
                                  <span>{s.number}. {s.name}</span>
                                  {selectedStudentId === s.id && <ChevronRight size={16}/>}
                              </button>
                          ))
                      )}
                  </div>
              </div>

              {/* Main Content: Report Card */}
              <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-100 print:bg-white print:p-0 print:overflow-visible">
                  <div className="max-w-4xl mx-auto">
                      {/* Controls (Hidden on Print) */}
                      <div className="flex justify-end mb-4 no-print">
                          <button 
                            onClick={handlePrint}
                            className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 shadow-md flex items-center gap-2"
                          >
                              <Printer size={20} /> 인쇄 / PDF 저장
                          </button>
                      </div>

                      {/* Printable Area */}
                      <div ref={printRef} className="bg-white rounded-[2px] shadow-lg p-8 md:p-12 min-h-[297mm] print:shadow-none print:min-h-0">
                          {selectedStudent ? (
                              <>
                                  {/* Header */}
                                  <header className="border-b-4 border-indigo-900 pb-6 mb-8 text-center">
                                      <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-4 font-serif">학습 활동 포트폴리오</h1>
                                      <div className="flex justify-center gap-8 text-lg font-bold text-gray-700 font-serif">
                                          <span>학년 반: 3학년 2반</span>
                                          <span>이름: {selectedStudent.name}</span>
                                          <span>번호: {selectedStudent.number}번</span>
                                          <span>출력일: {new Date().toLocaleDateString()}</span>
                                      </div>
                                  </header>

                                  {loadingPortfolio ? (
                                      <div className="py-20 text-center text-gray-400">데이터를 불러오는 중...</div>
                                  ) : studentPosts.length === 0 ? (
                                      <div className="py-20 text-center text-gray-400 border-2 border-dashed rounded-xl">
                                          <FileText size={48} className="mx-auto mb-4 opacity-30" />
                                          <p>작성된 학습 게시물이 없습니다.</p>
                                      </div>
                                  ) : (
                                      <div className="space-y-10">
                                          {studentPosts.map((group, idx) => (
                                              <section key={idx} className="break-inside-avoid">
                                                  <h2 className="text-2xl font-bold text-indigo-800 mb-4 border-l-8 border-indigo-500 pl-4 bg-indigo-50 py-2 rounded-r-lg">
                                                      {group.category}
                                                  </h2>
                                                  <div className="grid grid-cols-1 gap-4">
                                                      {group.posts.length === 0 ? (
                                                          <p className="text-gray-400 py-4 text-sm">해당 영역에 작성된 글이 없습니다.</p>
                                                      ) : group.posts.map(post => (
                                                          <div key={post.id} className="border border-gray-300 rounded-lg p-5 break-inside-avoid shadow-sm print:shadow-none print:border-gray-400">
                                                              <div className="flex justify-between items-start mb-3 border-b border-gray-100 pb-2">
                                                                  <h3 className="font-bold text-lg text-gray-900">{post.title}</h3>
                                                                  <span className="text-sm text-gray-500 font-mono">
                                                                      {new Date(post.created_at).toLocaleDateString()}
                                                                  </span>
                                                              </div>
                                                              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed font-serif">
                                                                  {post.body}
                                                              </p>
                                                              {/* Simple Image representation for print */}
                                                              {post.attachment_url && (
                                                                  <div className="mt-4 p-2 bg-gray-50 border border-gray-200 rounded text-center print:bg-white">
                                                                      {post.attachment_type === 'image' ? (
                                                                          <img src={post.attachment_url} alt="attachment" className="max-h-64 mx-auto object-contain" />
                                                                      ) : (
                                                                          <span className="text-gray-500 text-sm">[동영상/파일 첨부됨]</span>
                                                                      )}
                                                                  </div>
                                                              )}
                                                          </div>
                                                      ))}
                                                  </div>
                                              </section>
                                          ))}
                                      </div>
                                  )}
                                  
                                  {/* Footer */}
                                  <footer className="mt-12 pt-6 border-t border-gray-300 text-center text-gray-500 text-sm font-serif">
                                      위 학생은 학교 생활 동안 성실하게 학습 과제를 수행하였음을 확인합니다.<br/>
                                      <span className="font-bold text-gray-800 mt-2 block">담임교사: 교사 (인)</span>
                                  </footer>
                              </>
                          ) : (
                              <div className="text-center text-gray-400 py-20">
                                  좌측 목록에서 학생을 선택해주세요.
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className="h-screen flex flex-col bg-[#FEF9E7] font-sans overflow-hidden">
      <header className="bg-white text-[#78350F] shadow-sm z-30 shrink-0 border-b border-[#FCD34D] no-print">
        <div className="max-w-full overflow-x-auto no-scrollbar">
            <div className="flex items-center p-2 gap-2 min-w-max">
                <button 
                    onClick={onBack} 
                    className="p-3 rounded-2xl hover:bg-[#FEF9E7] text-[#92400E] transition-colors mr-2 flex flex-col items-center gap-1 min-w-[4rem]"
                    title="메인으로"
                >
                    <Home size={22} />
                    <span className="text-xs font-bold font-hand">홈</span>
                </button>
                
                <div className="w-px h-10 bg-[#FCD34D] mx-2"></div>

                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as Tab)}
                        className={`
                            flex flex-col items-center justify-center px-6 py-2 rounded-2xl transition-all min-w-[5rem] gap-1
                            ${activeTab === tab.id 
                                ? 'bg-[#A78BFA] text-white shadow-md scale-105 font-bold' 
                                : 'text-[#92400E] hover:bg-[#F3E8FF] hover:text-[#5B21B6]'}
                        `}
                    >
                        <tab.icon size={22} />
                        <span className="text-xs font-hand">{tab.label}</span>
                    </button>
                ))}
            </div>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden bg-[#FEF9E7] min-h-0 flex flex-col">
        <div className="h-full w-full overflow-y-auto min-h-0 flex flex-col">
            {activeTab === 'portfolio' && isTeacherMode ? (
                renderPortfolio()
            ) : activeTab === 'omr' ? (
                <OmrApp isTeacherMode={isTeacherMode} student={student} />
            ) : (
                <BoardApp 
                    key={activeTab}
                    boardId={activeTab}
                    onBack={onBack}
                    isTeacherMode={isTeacherMode}
                    student={student}
                    onLoginRequest={onLoginRequest}
                    embedded={true}
                />
            )}
        </div>
      </main>
    </div>
  );
};
