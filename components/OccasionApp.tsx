
import React, { useState, useEffect } from 'react';
import { Home, Calendar, Video, FileText, Download, PlayCircle, Layers, Info, ExternalLink, Youtube, FileBarChart, HelpCircle, LayoutGrid, BookOpen, Plus, Bot, MonitorPlay, X, Check, Brain, Share2, Globe, FileUp, Paperclip, Trash2 } from 'lucide-react';
import * as occasionService from '../services/occasionService';
import { OccasionTopic, CommonOccasionTopic, OccasionMaterial, OccasionQuiz } from '../types';
import { SharedMaterial } from '../services/occasionService';
import { generateUUID } from '../src/utils/uuid';

interface OccasionAppProps {
  onBack: () => void;
  isTeacherMode?: boolean;
}

type TabMode = 'monthly' | 'common' | 'share';
type PresentationTab = 'video' | 'summary' | 'quiz';

export const OccasionApp: React.FC<OccasionAppProps> = ({ onBack, isTeacherMode = false }) => {
  const [tab, setTab] = useState<TabMode>('monthly');
  const [selectedMonth, setSelectedMonth] = useState<number>(3);
  
  // Data States
  const [topics, setTopics] = useState<OccasionTopic[]>([]);
  const [commonTopics, setCommonTopics] = useState<CommonOccasionTopic[]>([]);
  const [sharedMaterials, setSharedMaterials] = useState<SharedMaterial[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<OccasionTopic | CommonOccasionTopic | null>(null);
  
  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Simple Upload State
  const [upTitle, setUpTitle] = useState('');
  const [upLink, setUpLink] = useState('');
  const [upType, setUpType] = useState<'영상' | '자료'>('영상');
  const [upError, setUpError] = useState('');

  // Presentation Mode
  const [presentationMode, setPresentationMode] = useState(false);
  const [presentMaterial, setPresentMaterial] = useState<OccasionMaterial | null>(null);
  const [presentTab, setPresentTab] = useState<PresentationTab>('video');
  const [quizReveal, setQuizReveal] = useState<number | null>(null);
  const [currentQuizIdx, setCurrentQuizIdx] = useState(0);

  const academicMonths = occasionService.getAcademicMonths();

  useEffect(() => {
    loadData();
  }, [selectedMonth, tab]);

  useEffect(() => {
    if (!isTeacherMode && tab === 'share') {
      setTab('monthly');
    }
  }, [isTeacherMode, tab]);

  const loadData = (refreshSelected = false) => {
    if (tab === 'monthly') {
        const data = occasionService.getOccasionData(selectedMonth);
        setTopics(data);
        if (refreshSelected && selectedTopic) {
            const updated = data.find(t => t.id === selectedTopic.id);
            if (updated) setSelectedTopic(updated);
        } else if (data.length > 0 && !selectedTopic) {
            setSelectedTopic(data[0]);
        }
    } else if (tab === 'common') {
        const commonData = occasionService.getCommonOccasionData();
        setCommonTopics(commonData);
        if (refreshSelected && selectedTopic) {
            const updated = commonData.find(t => t.id === selectedTopic.id);
            if (updated) setSelectedTopic(updated);
        } else if (commonData.length > 0 && !selectedTopic) {
            setSelectedTopic(commonData[0]);
        }
    } else if (tab === 'share') {
        const shared = occasionService.getSharedMaterials();
        setSharedMaterials(shared);
    }
  };

  const handleMonthChange = (month: number) => {
    setSelectedMonth(month);
    setSelectedTopic(null);
  };

  const getTypeIcon = (type: string) => {
      switch(type) {
          case '영상': return <Youtube size={20} className="text-red-500" />;
          case '인포그래픽': return <FileBarChart size={20} className="text-blue-500" />;
          case '퀴즈': return <HelpCircle size={20} className="text-green-500" />;
          case 'NotebookLM': return <Bot size={20} className="text-purple-500" />;
          case '슬라이드': return <LayoutGrid size={20} className="text-orange-500" />;
          case '활동지': return <FileText size={20} className="text-slate-500" />;
          default: return <FileText size={20} />;
      }
  };

  const getTypeColor = (type: string) => {
      switch(type) {
          case '영상': return 'bg-red-50 text-red-700 border-red-200';
          case '인포그래픽': return 'bg-blue-50 text-blue-700 border-blue-200';
          case '퀴즈': return 'bg-green-50 text-green-700 border-green-200';
          case 'NotebookLM': return 'bg-purple-50 text-purple-700 border-purple-200';
          case '슬라이드': return 'bg-orange-50 text-orange-700 border-orange-200';
          default: return 'bg-gray-50 text-gray-700 border-gray-200';
      }
  };

  const handleMaterialClick = (material: OccasionMaterial) => {
      if (material.notebookLM) {
          setPresentMaterial(material);
          setPresentationMode(true);
          setPresentTab('video');
          setCurrentQuizIdx(0);
          setQuizReveal(null);
      } else if (material.link && material.link !== '#') {
          window.open(material.link, '_blank');
      } else {
          alert('준비 중인 자료입니다.');
      }
  };

  // --- Sharing & Importing Handlers ---

  const handleDeleteMaterial = (material: OccasionMaterial, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!selectedTopic) return;
      if (!confirm(`'${material.title}' 자료를 삭제하시겠습니까?`)) return;
      const monthKey = tab === 'monthly' ? selectedMonth : 'common';
      occasionService.deleteMaterial(monthKey, selectedTopic.id, material.id);
      loadData(true);
  };

  const handleShare = (material: OccasionMaterial, e: React.MouseEvent) => {
      e.stopPropagation();
      if(confirm(`'${material.title}' 자료를 교사 공유방에 올리시겠습니까?`)) {
          occasionService.shareMaterialToCommunity(material, '나의 자료');
          alert('공유방에 업로드되었습니다!');
      }
  };

  const handleImport = (material: SharedMaterial) => {
      // For demo: default to current month's first topic or user selection.
      // Here we simulate importing to the currently active "Monthly" topic or "Common" topic context.
      // Since "Share" tab is separate, we need to know WHERE to put it.
      // For simplicity: Ask user to pick Month and Topic, or default to current month.
      
      const targetMonth = selectedMonth;
      const targetTopics = occasionService.getOccasionData(targetMonth);
      if(targetTopics.length === 0) {
          alert('이번 달에 등록된 주제가 없어 담을 수 없습니다.');
          return;
      }
      // Simple logic: Add to the first topic of current selected month for demo
      const targetTopic = targetTopics[0];
      
      if(confirm(`'${material.title}' 자료를 [${targetMonth}월 - ${targetTopic.title}] 주제로 담아오시겠습니까?`)) {
          occasionService.importSharedMaterial(material, targetMonth, targetTopic.id);
          alert('내 자료실에 저장되었습니다! 월별 탭에서 확인하세요.');
      }
  };

  // --- Upload Handlers ---

  const handleOpenUpload = () => {
      if (!selectedTopic) {
          alert('주제를 먼저 선택해주세요.');
          return;
      }
      setUpTitle('');
      setUpLink('');
      setUpType('영상');
      setShowUploadModal(true);
  };

  const handleSaveSimpleUpload = () => {
      if (!selectedTopic) {
          setUpError('먼저 주제를 선택해주세요.');
          return;
      }
      if (!upTitle.trim()) {
          setUpError('자료 제목을 입력해주세요.');
          return;
      }
      if (!upLink.trim()) {
          setUpError('링크를 입력해주세요.');
          return;
      }

      const newMaterial: OccasionMaterial = {
          id: generateUUID(),
          title: upTitle,
          types: [upType],
          thumbnailUrl: upType === '영상' 
            ? `https://img.youtube.com/vi/${getYouTubeID(upLink)}/mqdefault.jpg` 
            : 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"%3E%3Crect fill="%23e5e7eb" width="300" height="200"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-size="14"%3EFile%3C/text%3E%3C/svg%3E',
          topic: selectedTopic.title,
          author: '선생님',
          link: upLink
      };

      const monthKey = tab === 'monthly' ? selectedMonth : 'common';
      occasionService.saveCustomMaterial(monthKey, selectedTopic.id, newMaterial);
      
      setShowUploadModal(false);
      setUpError('');
      loadData();
      alert('자료가 등록되었습니다!');
  };

  const getYouTubeID = (url: string) => {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = url.match(regExp);
      return (match && match[2].length === 11) ? match[2] : null;
  };

  // --- Render Presentation Mode ---
  if (presentationMode && presentMaterial && presentMaterial.notebookLM) {
      const { youtubeUrl, summary, quizzes, videoFile, infographicImage } = presentMaterial.notebookLM;
      const ytId = getYouTubeID(youtubeUrl);

      return (
          <div className="fixed inset-0 bg-black z-[100] flex flex-col font-sans text-white">
              <header className="bg-gray-900 p-4 flex justify-between items-center border-b border-gray-800">
                  <h1 className="text-xl font-bold flex items-center gap-2">
                      <Bot className="text-purple-400"/> {presentMaterial.title}
                  </h1>
                  <button onClick={() => setPresentationMode(false)} className="bg-gray-800 hover:bg-gray-700 p-2 rounded-full text-white">
                      <X size={24} />
                  </button>
              </header>

              <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden">
                  {/* Left: Content Area */}
                  <div className="flex-1 bg-black flex flex-col relative">
                      {presentTab === 'video' && (
                          <div className="w-full h-full flex items-center justify-center bg-black">
                              {videoFile?.dataUrl ? (
                                  <video className="w-full h-full max-w-[100%] max-h-[100%]" controls>
                                      <source src={videoFile.dataUrl} type={videoFile.type} />
                                      브라우저가 동영상 재생을 지원하지 않습니다.
                                  </video>
                              ) : ytId ? (
                                  <iframe 
                                    className="w-full h-full max-w-[100%] max-h-[100%]" 
                                    src={`https://www.youtube.com/embed/${ytId}?autoplay=1`} 
                                    title="Video" frameBorder="0" allow="autoplay; encrypted-media" allowFullScreen 
                                  />
                              ) : (
                                  <div className="text-gray-400 text-lg">등록된 영상이 없습니다.</div>
                              )}
                          </div>
                      )}

                      {presentTab === 'summary' && (
                          <div className="w-full h-full p-10 overflow-y-auto bg-gray-900 flex flex-col items-center">
                              <h2 className="text-4xl font-bold text-yellow-400 mb-8 border-b-4 border-yellow-500 pb-2">💡 핵심 쏙쏙 정리</h2>
                              {infographicImage?.dataUrl && (
                                  <img
                                    src={infographicImage.dataUrl}
                                    alt="인포그래픽"
                                    className="max-w-5xl w-full rounded-2xl border border-gray-700 shadow-lg mb-8"
                                  />
                              )}
                              <div className="text-2xl md:text-3xl leading-relaxed whitespace-pre-wrap max-w-5xl text-center font-medium text-gray-200">
                                  {summary}
                              </div>
                          </div>
                      )}

                      {presentTab === 'quiz' && (
                          <div className="w-full h-full p-6 flex flex-col items-center justify-center bg-indigo-950 relative overflow-hidden">
                              <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                              
                              {quizzes.length > 0 ? (
                                  <div className="max-w-5xl w-full z-10 flex flex-col items-center">
                                      <div className="bg-white/10 px-6 py-2 rounded-full mb-6 text-xl font-bold text-indigo-200">
                                          Quiz {currentQuizIdx + 1} / {quizzes.length}
                                      </div>
                                      
                                      <h2 className="text-4xl md:text-5xl font-black text-white text-center mb-12 drop-shadow-lg leading-snug">
                                          Q. {quizzes[currentQuizIdx].question}
                                      </h2>

                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                                          {quizzes[currentQuizIdx].options.map((opt, idx) => {
                                              const isAnswer = quizzes[currentQuizIdx].answer === idx;
                                              const isRevealed = quizReveal === currentQuizIdx;
                                              
                                              return (
                                                  <button 
                                                    key={idx}
                                                    onClick={() => setQuizReveal(currentQuizIdx)}
                                                    className={`
                                                        p-8 rounded-3xl text-2xl md:text-3xl font-bold transition-all border-4 shadow-xl text-left relative overflow-hidden
                                                        ${isRevealed 
                                                            ? (isAnswer ? 'bg-green-600 border-green-400 scale-105' : 'bg-gray-700 border-gray-600 opacity-50') 
                                                            : 'bg-white text-indigo-900 border-white hover:bg-indigo-50'}
                                                    `}
                                                  >
                                                      <span className="opacity-50 mr-4">{idx+1}.</span> {opt}
                                                      {isRevealed && isAnswer && <Check className="absolute right-6 top-1/2 -translate-y-1/2 text-white w-10 h-10" />}
                                                  </button>
                                              )
                                          })}
                                      </div>

                                      <div className="mt-12 flex gap-4">
                                          <button 
                                            onClick={() => setQuizReveal(currentQuizIdx)}
                                            className="bg-yellow-500 text-black px-8 py-4 rounded-2xl text-2xl font-bold hover:bg-yellow-400 shadow-lg"
                                          >
                                              정답 확인
                                          </button>
                                          {currentQuizIdx < quizzes.length - 1 && (
                                              <button 
                                                onClick={() => { setCurrentQuizIdx(p => p + 1); setQuizReveal(null); }}
                                                className="bg-white/20 text-white px-8 py-4 rounded-2xl text-2xl font-bold hover:bg-white/30"
                                              >
                                                  다음 문제
                                              </button>
                                          )}
                                      </div>
                                  </div>
                              ) : (
                                  <div className="text-2xl text-gray-400">등록된 퀴즈가 없습니다.</div>
                              )}
                          </div>
                      )}
                  </div>

                  {/* Bottom/Right: Control Bar */}
                  <div className="bg-gray-800 p-4 flex lg:flex-col justify-center gap-4 border-t lg:border-t-0 lg:border-l border-gray-700 lg:w-32 shrink-0">
                      <button 
                        onClick={() => setPresentTab('video')}
                        className={`p-4 rounded-2xl flex flex-col items-center gap-2 transition-all ${presentTab === 'video' ? 'bg-red-600 text-white shadow-lg' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
                      >
                          <Youtube size={32} /> <span className="text-xs font-bold">영상</span>
                      </button>
                      <button 
                        onClick={() => setPresentTab('summary')}
                        className={`p-4 rounded-2xl flex flex-col items-center gap-2 transition-all ${presentTab === 'summary' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
                      >
                          <FileText size={32} /> <span className="text-xs font-bold">정리</span>
                      </button>
                      <button 
                        onClick={() => setPresentTab('quiz')}
                        className={`p-4 rounded-2xl flex flex-col items-center gap-2 transition-all ${presentTab === 'quiz' ? 'bg-green-600 text-white shadow-lg' : 'bg-gray-700 text-gray-400 hover:text-white'}`}
                      >
                          <Brain size={32} /> <span className="text-xs font-bold">퀴즈</span>
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  // --- Main View ---
  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      <header className="bg-white p-6 border-b flex flex-col sm:flex-row justify-between items-center sticky top-0 z-20 gap-6">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <button onClick={onBack} className="bg-gray-100 p-3 rounded-full text-gray-500 hover:bg-gray-200 shrink-0">
            <Home size={32} />
          </button>
          <div className="flex flex-col">
             <span className="text-lg text-cyan-600 font-bold">창의적 체험활동</span>
             <h1 className="font-bold text-gray-800 text-3xl flex items-center gap-3">
                 <Calendar className="text-cyan-500" size={32}/> 계기교육
             </h1>
          </div>
        </div>

        <div className="flex bg-gray-100 p-2 rounded-2xl w-full sm:w-auto overflow-x-auto">
            <button 
                onClick={() => { setTab('monthly'); setSelectedTopic(null); }}
                className={`flex-1 sm:flex-none px-6 py-3 rounded-xl text-lg font-bold flex items-center justify-center gap-2 transition-all whitespace-nowrap ${tab === 'monthly' ? 'bg-white text-cyan-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                <Calendar size={24} /> 월별 교육
            </button>
            <button 
                onClick={() => { setTab('common'); setSelectedTopic(null); }}
                className={`flex-1 sm:flex-none px-6 py-3 rounded-xl text-lg font-bold flex items-center justify-center gap-2 transition-all whitespace-nowrap ${tab === 'common' ? 'bg-white text-cyan-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                <BookOpen size={24} /> 공통 주제
            </button>
            {isTeacherMode && (
                <button 
                    onClick={() => { setTab('share'); setSelectedTopic(null); }}
                    className={`flex-1 sm:flex-none px-6 py-3 rounded-xl text-lg font-bold flex items-center justify-center gap-2 transition-all whitespace-nowrap ${tab === 'share' ? 'bg-white text-cyan-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Globe size={24} /> 교사 공유방
                </button>
            )}
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6 md:p-10">
        
        {/* MONTHLY TAB */}
        {tab === 'monthly' && (
            <>
                <div className="flex items-center gap-3 overflow-x-auto pb-6 mb-10 border-b border-gray-100 no-scrollbar">
                    <span className="text-4xl font-bold text-cyan-600 mr-6 shrink-0">{selectedMonth}월</span>
                    {academicMonths.map(month => (
                        <button
                            key={month}
                            onClick={() => handleMonthChange(month)}
                            className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold shrink-0 transition-all ${selectedMonth === month ? 'bg-cyan-500 text-white shadow-md scale-110' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
                        >
                            {month}
                        </button>
                    ))}
                </div>

                {topics.length > 0 ? (
                    <div className="flex items-center gap-10 overflow-x-auto pb-10 mb-10 border-b border-gray-100">
                        {topics.map(topic => (
                            <button
                                key={topic.id}
                                onClick={() => setSelectedTopic(topic)}
                                className={`flex flex-col items-center gap-3 group min-w-[120px] transition-all ${selectedTopic?.id === topic.id ? 'opacity-100 scale-105' : 'opacity-50 hover:opacity-80'}`}
                            >
                                <div className={`w-32 h-24 border-4 flex flex-col items-center justify-center rounded-2xl bg-white shadow-sm transition-colors ${selectedTopic?.id === topic.id ? 'border-cyan-400 text-cyan-600' : 'border-gray-200 text-gray-400'}`}>
                                    <span className="text-4xl font-bold">{topic.day}</span>
                                    <span className="text-base font-bold truncate w-full text-center px-1">{topic.title}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="py-32 text-center text-gray-400">
                        <Info size={64} className="mx-auto mb-4 opacity-30" />
                        <p className="text-2xl">이번 달에는 등록된 계기교육 일정이 없습니다.</p>
                    </div>
                )}
            </>
        )}

        {/* COMMON TAB */}
        {tab === 'common' && (
            <div className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                    <LayoutGrid size={32} className="text-gray-400" />
                    <h3 className="font-bold text-2xl text-gray-700">공통 계기교육 주제</h3>
                </div>
                <div className="flex flex-wrap gap-4">
                    {commonTopics.map(topic => (
                        <button
                            key={topic.id}
                            onClick={() => setSelectedTopic(topic)}
                            className={`px-6 py-3 rounded-full border-2 text-lg font-bold transition-all shadow-sm ${selectedTopic?.id === topic.id ? 'bg-cyan-500 text-white border-cyan-600 ring-4 ring-cyan-200 scale-105' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'}`}
                        >
                            {topic.title}
                        </button>
                    ))}
                </div>
            </div>
        )}

        {/* SHARED TAB */}
        {tab === 'share' && isTeacherMode && (
            <div className="animate-fade-in-up">
                <div className="mb-10 text-center">
                    <h2 className="text-3xl font-black text-gray-800 mb-2 flex items-center justify-center gap-3">
                        <Globe className="text-cyan-500" /> 교사 자료 공유방
                    </h2>
                    <p className="text-lg text-gray-500">선생님들이 공유해주신 소중한 자료를 만나보세요.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {sharedMaterials.map(item => (
                        <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all group flex flex-col">
                            <div className="aspect-video bg-gray-100 relative overflow-hidden">
                                <img src={item.thumbnailUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded font-bold">{item.topic}</div>
                            </div>
                            <div className="p-5 flex-1 flex flex-col">
                                <h3 className="font-bold text-lg text-gray-800 mb-2 line-clamp-2 leading-snug">{item.title}</h3>
                                <div className="text-sm text-gray-500 mb-4 flex justify-between items-center">
                                    <span>{item.originalAuthor}</span>
                                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{new Date(item.sharedAt).toLocaleDateString()}</span>
                                </div>
                                <div className="mt-auto flex justify-between items-center border-t pt-4">
                                    <div className="text-xs text-gray-400 flex gap-3">
                                        <span>📥 {item.downloads}</span>
                                        <span>❤️ {item.likes}</span>
                                    </div>
                                    <button 
                                        onClick={() => handleImport(item)}
                                        className="text-sm bg-cyan-100 text-cyan-700 px-3 py-1.5 rounded-lg font-bold hover:bg-cyan-200 flex items-center gap-1 transition-colors"
                                    >
                                        <Download size={14} /> 담아오기
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* SELECTED TOPIC DETAIL VIEW (Monthly & Common) */}
        {(tab === 'monthly' || tab === 'common') && selectedTopic && (
            <div className="animate-fade-in-up">
                <div className="mb-10 border-l-8 border-cyan-500 pl-6 bg-cyan-50/50 py-6 rounded-r-2xl flex flex-col md:flex-row justify-between items-start gap-4">
                    <div>
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2 flex items-center gap-4 flex-wrap">
                            {selectedTopic.title}
                            {'day' in selectedTopic && (
                                <span className="text-lg font-normal text-gray-500 bg-white px-4 py-1 rounded-full border">
                                    {selectedMonth}월 {selectedTopic.day}일
                                </span>
                            )}
                        </h2>
                        <p className="text-lg md:text-xl text-gray-600">{selectedTopic.description}</p>
                    </div>
                    {/* Create Buttons */}
                    {isTeacherMode && (
                        <div className="flex gap-2 shrink-0">
                            <button 
                                onClick={handleOpenUpload}
                                className="bg-white border-2 border-cyan-200 text-cyan-700 px-5 py-3 rounded-xl font-bold shadow-sm hover:bg-cyan-50 flex items-center gap-2 transition-all active:scale-95"
                            >
                                <FileUp size={20} /> 자료 올리기
                            </button>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {selectedTopic.materials.length > 0 ? (
                        selectedTopic.materials.map(material => (
                            <div 
                                key={material.id} 
                                onClick={() => handleMaterialClick(material)}
                                className="bg-white rounded-3xl border-2 border-gray-200 overflow-hidden hover:shadow-2xl transition-all group cursor-pointer flex flex-col hover:-translate-y-2 relative"
                            >
                                {/* Thumbnail */}
                                <div className="aspect-video bg-gray-100 relative overflow-hidden">
                                    <img src={material.thumbnailUrl} alt={material.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    
                                    <div className="absolute bottom-3 right-3 flex gap-2">
                                        {material.types.map((t, idx) => (
                                            <span key={idx} className={`text-sm px-2.5 py-1 rounded-lg border-2 font-bold flex items-center gap-1.5 ${getTypeColor(t)} bg-white`}>
                                                {getTypeIcon(t)}
                                                {t}
                                            </span>
                                        ))}
                                    </div>
                                    
                                    {(material.types.includes('영상') || material.notebookLM) && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {material.notebookLM ? (
                                                <MonitorPlay className="text-white drop-shadow-lg" size={64} />
                                            ) : (
                                                <PlayCircle className="text-white drop-shadow-lg" size={64} />
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="p-6 flex flex-col flex-1">
                                    <h3 className="font-bold text-2xl text-gray-800 mb-4 line-clamp-2 leading-snug group-hover:text-cyan-700 transition-colors">
                                        {material.title}
                                    </h3>
                                    
                                    <div className="mt-auto space-y-3 border-t-2 pt-4">
                                        <div className="flex items-start gap-2 text-base text-gray-500">
                                            <span className="font-bold text-cyan-600 shrink-0"># 주제</span>
                                            <span className="line-clamp-1">{material.topic}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm text-gray-400 font-medium">
                                            <div className="flex items-center gap-2">
                                                <span>{material.author}</span>
                                                {material.notebookLM ? (
                                                    <span className="text-purple-500 font-bold flex items-center gap-1"><Brain size={14}/> AI</span>
                                                ) : (
                                                    <ExternalLink size={16} />
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button 
                                                    onClick={(e) => handleShare(material, e)}
                                                    className="text-gray-400 hover:text-cyan-600 p-1 rounded hover:bg-cyan-50 transition-colors"
                                                    title="공유방에 공유하기"
                                                >
                                                    <Share2 size={18} />
                                                </button>
                                                {isTeacherMode && (
                                                    <button 
                                                        onClick={(e) => handleDeleteMaterial(material, e)}
                                                        className="text-gray-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                                                        title="자료 삭제"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full py-32 text-center text-gray-400 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                            <Layers size={80} className="mx-auto mb-4 opacity-30" />
                            <p className="text-2xl">아직 등록된 자료가 없습니다.</p>
                        </div>
                    )}
                </div>
            </div>
        )}
      </main>

      {/* Upload Modal (Generic) */}
      {showUploadModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                  <div className="bg-cyan-600 p-6 text-white flex justify-between items-center shrink-0">
                      <h2 className="text-xl font-bold flex items-center gap-2">
                          <FileUp size={24} /> 자료 올리기
                      </h2>
                      <button onClick={() => setShowUploadModal(false)} className="bg-white/20 p-2 rounded-full hover:bg-white/30"><X size={20}/></button>
                  </div>
                  <div className="p-8 space-y-6">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">자료 제목</label>
                          <input
                            type="text"
                            value={upTitle}
                            onChange={(e) => {
                              setUpTitle(e.target.value);
                              if (upError) setUpError('');
                            }}
                            className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-cyan-500"
                            placeholder="예: 식목일 영상"
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">링크 (YouTube, 구글 드라이브 등)</label>
                          <input
                            type="text"
                            value={upLink}
                            onChange={(e) => {
                              setUpLink(e.target.value);
                              if (upError) setUpError('');
                            }}
                            className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-cyan-500"
                            placeholder="https://..."
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-2">유형</label>
                          <div className="flex gap-2">
                              {['영상', '자료'].map(t => (
                                  <button 
                                    key={t} onClick={() => setUpType(t as any)}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${upType === t ? 'bg-cyan-100 text-cyan-700 border-cyan-300' : 'bg-white text-gray-500 border-gray-200'}`}
                                  >
                                      {t}
                                  </button>
                              ))}
                          </div>
                      </div>
                      {upError && <p className="text-sm text-rose-500">{upError}</p>}
                      <button onClick={handleSaveSimpleUpload} className="w-full bg-cyan-600 text-white font-bold py-3 rounded-xl shadow-md hover:bg-cyan-700">
                          등록하기
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};
