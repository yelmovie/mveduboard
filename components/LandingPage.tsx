
import React, { useState, useEffect } from 'react';
import { 
  Trophy, PenTool, CheckSquare, Grid, Users, MessageCircle, Utensils, 
  UserCheck, BookOpen, ClipboardList, Calendar, Mail, LogIn, LogOut, 
  GraduationCap, Bell, Timer, Dices, Award, LayoutDashboard, UserCircle, 
  RefreshCcw, Ticket, MessageSquare as MsgSquare, Search, PenLine, 
  Calculator, NotebookText, Book, CalendarDays, CalendarRange, Images, 
  Palette, TableProperties, Briefcase, Settings, BookOpenCheck, Layout, 
  UserPlus, Menu, X, ChevronRight, Filter, Sparkles, Lightbulb
} from 'lucide-react';
import { Participant } from '../types';
import { BetaNoticeModal } from './BetaNoticeModal';
import { isSupabaseConfigured } from '../src/config/supabase';
import { DAILY_IMAGE_LIMIT } from '../src/constants/limits';

interface LandingPageProps {
  onSelectApp: (appId: string) => void;
  isLoggedIn: boolean; 
  onLogin: () => void; 
  onTeacherSignup: () => void; 
  onLogout: () => void; 
  onOpenDashboard: () => void;
  student: Participant | null;
  teacherName?: string;
  onStudentLogin: () => void;
  onStudentLogout: () => void;
}

type Category = 'ALL' | 'MANAGEMENT' | 'LEARNING' | 'TOOLS' | 'BOARD' | 'PERSONAL';

export const LandingPage: React.FC<LandingPageProps> = ({ 
    onSelectApp, 
    isLoggedIn, 
    onLogin, 
    onTeacherSignup,
    onLogout, 
    onOpenDashboard,
    student,
    teacherName,
    onStudentLogin,
    onStudentLogout
}) => {
  const normalizedTeacherName = (teacherName || '').replace(/\s*선생님\s*$/u, '').trim();
  const teacherWelcome = `${normalizedTeacherName ? normalizedTeacherName : ''} 선생님 환영합니다`.trim();
  const [selectedCategory, setSelectedCategory] = useState<Category>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Banner Image State
  const bannerImages = [
    '/images/banner1.png',
    '/images/banner2.png',
    '/images/banner3.png',
    '/images/banner4.png',
    '/images/banner5.png',
  ];
  const [hasBannerError, setHasBannerError] = useState(false);

  // Slider State
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showBetaNotice, setShowBetaNotice] = useState(false);

  // Tips Data
  const TIPS = [
    "'학급운영도구'에서 1인 1역과 포인트를 연동해보세요. 학급 경영이 훨씬 편해집니다!",
    "'자리 배치' 도구에서 학생 명단을 입력하면 클릭 한 번으로 자리를 바꿀 수 있어요.",
    "'타이머' 기능을 전체 화면으로 띄워두면 아이들이 시간 관리를 더 잘할 수 있어요.",
    "'발표 뽑기'에서 중복 허용 옵션을 끄면 모든 학생이 골고루 발표할 수 있어요.",
    "'빙고 게임'을 단어 공부 시간에 활용해보세요. 직접 단어를 입력할 수도 있답니다.",
    "'우리학급게시판'은 선생님 승인 후 게시되도록 설정하여 안전하게 운영할 수 있어요.",
    "'주간학습안내' 이미지를 업로드하면 학생들이 집에서도 쉽게 확인할 수 있어요.",
    "'비밀 상담방' 기능은 선생님과 학생만 볼 수 있으니 안심하고 기록하세요.",
    "'급식 메뉴'를 사진으로 찍어서 올리면 아이들이 더 좋아해요.",
    "'1인 1역'은 랜덤 배정 기능을 통해 공정하게 역할을 나눌 수 있어요.",
    "'칭찬 쿠폰'을 커스텀하여 아이들에게 확실한 동기 부여를 해주세요.",
    "'집중 타이머'의 뽀모도로 모드는 아이들의 집중력을 높여줍니다.",
    "'역할 히스토리'를 저장하면 이전에 맡았던 역할을 피해 배정할 수 있어요.",
    "'알림장' 내용을 미리 작성해두고 아침 조회 시간에 활용하면 편리합니다.",
    "'진로 월드컵'으로 아이들의 흥미와 적성을 재미있게 탐색해보세요.",
    "'단어 찾기' 퍼즐을 AI로 생성하여 수업 시간에 활용해보세요.",
    "'만화 그리기' 과제를 내주면 아이들의 창의력이 쑥쑥 자라납니다.",
    "'학급 규칙'을 게시판 공지로 띄워두면 언제든 다시 볼 수 있어요.",
    "궁금한 점이나 오류는 '문의하기'를 통해 언제든 개발자에게 알려주세요!"
  ];

  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  const handleNextTip = () => {
      let nextIndex = Math.floor(Math.random() * TIPS.length);
      while (nextIndex === currentTipIndex && TIPS.length > 1) {
          nextIndex = Math.floor(Math.random() * TIPS.length);
      }
      setCurrentTipIndex(nextIndex);
  };

  const SLIDES = [
    { title: "우리 반의 하루를 시작해요!", desc: "오늘도 즐겁고 행복한 학교 생활 되세요 🏫", icon: Trophy },
    { title: "학교 계획표", desc: "급식, 주간학습안내를 한눈에 확인해요 📅", icon: CalendarRange },
    { title: "우리학급게시판", desc: "친구들과 소통하고 멋진 작품을 공유해요 🎨", icon: Layout },
    { title: "학급운영도구", desc: "1인 1역, 포인트, 쿠폰으로 즐거운 우리 반 ✨", icon: Settings },
    { title: "학습보조도구", desc: "타이머, 발표 뽑기, 빙고 게임으로 수업을 재미있게 🎲", icon: Briefcase },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    }, 5000); // 5 seconds per slide
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const dismissed = localStorage.getItem('edu_beta_notice_dismissed');
    if (!dismissed) {
      setShowBetaNotice(true);
    }
  }, []);

  const handleCloseBetaNotice = () => {
    localStorage.setItem('edu_beta_notice_dismissed', 'true');
    setShowBetaNotice(false);
  };

  const handlePrevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);
  };

  const handleNextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
  };

  useEffect(() => {
    setHasBannerError(false);
  }, [currentSlide]);

  const scrollToSection = (id: string) => {
      const element = document.getElementById(id);
      if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
      }
      setIsMobileMenuOpen(false);
  };

  const handleContactClick = () => {
      onSelectApp('contact');
      setIsMobileMenuOpen(false);
  };

  // Helper for teacher-only resources
  const handleTeacherResourceClick = (resourceId: string) => {
      if (isLoggedIn) {
          onSelectApp(resourceId);
      } else {
          alert("교사만 이용할 수 있는 메뉴입니다.");
      }
  };

  const categories: { id: Category; label: string }[] = [
    { id: 'ALL', label: '전체' },
    { id: 'MANAGEMENT', label: '학급 경영' },
    { id: 'LEARNING', label: '수업 활동' },
    { id: 'TOOLS', label: '편의 도구' },
    { id: 'BOARD', label: '게시판/소통' },
    { id: 'PERSONAL', label: '개인/기타' },
  ];

  // Updated apps with CUTE & WARM Images
  // Using images with warmer tones, soft lighting, and cute subjects
  const apps = [
    // Management
    { 
        id: 'planner', 
        title: '학교 계획표', 
        category: 'MANAGEMENT', 
        image: '/images/button1.png',
        overlay: 'bg-pink-400', 
        description: '주간학습, 급식, 월간일정', 
        tags: ['필수', '정보'] 
    },
    { 
        id: 'management', 
        title: '학급운영도구', 
        category: 'MANAGEMENT', 
        image: '/images/button2.png',
        overlay: 'bg-emerald-500', 
        description: '알림장, 1인1역, 포인트, 쿠폰, 회의, 설문', 
        tags: ['교사용', '생활지도'] 
    },
    
    // Learning
    { 
        id: 'tasks', 
        title: '학습과제도구', 
        category: 'LEARNING', 
        image: '/images/button3.png',
        overlay: 'bg-violet-400', 
        description: '배움노트, 글쓰기, 독서록, 오답노트, OMR', 
        tags: ['과제', '학습'] 
    },
    { 
        id: 'occasion', 
        title: '계기교육', 
        category: 'LEARNING', 
        image: '/images/button4.png',
        overlay: 'bg-cyan-400', 
        description: '특별한 날 의미 배우기', 
        tags: ['창체', '자료'] 
    },
    
    // Tools
    { 
        id: 'tools', 
        title: '학습보조도구', 
        category: 'TOOLS', 
        image: '/images/button5.png',
        overlay: 'bg-indigo-400', 
        description: '타이머, 뽑기, 빙고, 단어찾기', 
        tags: ['수업도구', '게임'] 
    },
    
    // Board/Comm
    { 
        id: 'class_board', 
        title: '우리학급게시판', 
        category: 'BOARD', 
        image: '/images/button6.png',
        overlay: 'bg-blue-400', 
        description: '자유게시판, 갤러리, 사진첩, 만화, 톡톡', 
        tags: ['소통', '공유'] 
    },
    { 
        id: 'message', 
        title: '선생님 1:1 쪽지', 
        category: 'BOARD', 
        image: '/images/button7.png',
        overlay: 'bg-rose-400', 
        description: '선생님께 하고 싶은 이야기', 
        tags: ['상담', '비밀'] 
    },
    
    // Personal/Etc
    { 
        id: 'todo', 
        title: '할일체크', 
        category: 'PERSONAL', 
        image: '/images/button8.png',
        overlay: 'bg-green-400', 
        description: '오늘 할 일을 확인해요', 
        tags: ['자기관리'] 
    },
    { 
        id: 'schedule', 
        title: '나의 스케쥴', 
        category: 'PERSONAL', 
        image: '/images/button9.png',
        overlay: 'bg-teal-400', 
        description: '나만의 일정 관리', 
        tags: ['플래너'] 
    },
  ];

  const filteredApps = apps.filter(app => {
    const matchesCategory = selectedCategory === 'ALL' || app.category === selectedCategory;
    const matchesSearch = app.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          app.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const currentBannerImage = bannerImages[currentSlide % bannerImages.length];

  return (
    <div className="min-h-screen bg-[#FEF9E7] flex flex-col font-sans text-[#78350F]">
      {showBetaNotice && <BetaNoticeModal onClose={handleCloseBetaNotice} />}
      
      {/* 1. Header (상단) */}
      <header className="bg-white/80 backdrop-blur-md border-b border-[#FCD34D] sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo Group */}
          <div className="flex items-center gap-8">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.reload()}>
                <div className="bg-[#FCD34D] p-1.5 rounded-lg text-white shadow-sm">
                    <GraduationCap size={24} />
                </div>
                <span className="text-xl font-bold tracking-tight text-[#78350F] font-hand">EduClass Helper</span>
              </div>
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-3 font-hand">
            {!isLoggedIn && !student && (
                <>
                    <button onClick={onLogin} className="px-4 py-2 text-sm font-bold text-gray-600 hover:text-[#78350F] transition-colors">선생님 로그인</button>
                    <button onClick={onStudentLogin} className="px-4 py-2 text-sm font-bold text-[#7DD3FC] bg-white border-2 border-[#7DD3FC] hover:bg-[#E0F2FE] rounded-xl transition-all">학생 로그인</button>
                    <div className="w-px h-4 bg-gray-300 mx-1"></div>
                    <button onClick={onTeacherSignup} className="px-4 py-2 text-sm font-bold text-white bg-[#FDA4AF] hover:bg-[#F43F5E] rounded-xl shadow-sm transition-all flex items-center gap-1">
                        <UserPlus size={16}/> 회원가입
                    </button>
                </>
            )}
            
            {isLoggedIn && (
                <>
                    <span className="hidden lg:inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold bg-[#FCD34D]/30 text-[#78350F] border border-[#FCD34D]">
                        {teacherWelcome}
                    </span>
                    <button onClick={onOpenDashboard} className="px-4 py-2 text-sm font-bold text-[#78350F] bg-[#FCD34D] hover:bg-[#F59E0B] rounded-xl flex items-center gap-2 shadow-sm text-white">
                        <LayoutDashboard size={16}/> 선생님 대시보드
                    </button>
                    <button onClick={onLogout} className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700">로그아웃</button>
                </>
            )}

            {!isLoggedIn && student && (
                <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-[#78350F] bg-[#FCD34D]/20 px-3 py-1.5 rounded-full border border-[#FCD34D] flex items-center gap-1">
                        <UserCircle size={16}/> {student.nickname}
                    </span>
                    <button onClick={onStudentLogout} className="text-sm text-gray-400 hover:text-gray-600 underline">나가기</button>
                </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden p-2 text-gray-600" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
            <div className="md:hidden bg-white border-t border-gray-100 p-4 space-y-4 shadow-lg absolute w-full left-0 z-50 font-hand">
                <div className="flex flex-col gap-2">
                    {!isLoggedIn && !student && (
                        <>
                            <button onClick={onLogin} className="w-full py-2 text-center border rounded-lg">선생님 로그인</button>
                            <button onClick={onStudentLogin} className="w-full py-2 text-center bg-white border border-[#7DD3FC] text-[#7DD3FC] rounded-lg mt-2">학생 로그인</button>
                            <button onClick={onTeacherSignup} className="w-full py-2 text-center bg-[#FDA4AF] text-white rounded-lg">회원가입</button>
                        </>
                    )}
                    {isLoggedIn && (
                        <button onClick={onOpenDashboard} className="w-full py-2 bg-[#FCD34D] text-white rounded-lg">대시보드</button>
                    )}
                </div>
            </div>
        )}
      </header>

      <div className="flex flex-1 max-w-[1600px] mx-auto w-full">
        
        {/* 2. Sidebar (좌측) */}
        <aside className="hidden lg:block w-64 p-6 border-r border-[#FCD34D]/30 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto bg-white/50">
            <div className="mb-8">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-2">메뉴</h2>
                <div className="space-y-2">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => { setSelectedCategory(cat.id); scrollToSection('features-section'); }}
                            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-between group font-hand text-lg
                                ${selectedCategory === cat.id 
                                    ? 'bg-[#7DD3FC] text-white shadow-md transform scale-105' 
                                    : 'text-gray-600 hover:bg-white hover:text-[#78350F] hover:shadow-sm'}
                            `}
                        >
                            {cat.label}
                            {selectedCategory === cat.id && <ChevronRight size={16} />}
                        </button>
                    ))}
                </div>
            </div>

            <div 
                onClick={handleNextTip}
                className="bg-[#FFFBEB] rounded-2xl p-5 border-2 border-[#FCD34D] shadow-sm transform hover:rotate-1 transition-transform cursor-pointer group"
            >
                <h3 className="font-bold text-[#D97706] mb-2 flex items-center gap-2 font-hand text-lg">
                    <Lightbulb size={18}/> 이용 꿀팁
                </h3>
                <p className="text-sm text-[#92400E] leading-relaxed mb-3 font-hand min-h-[3rem]">
                    {TIPS[currentTipIndex]}
                </p>
                <div className="flex justify-end">
                    <button className="text-xs font-bold text-[#D97706] flex items-center gap-1 hover:text-[#B45309]">
                        <RefreshCcw size={12} className="group-hover:rotate-180 transition-transform duration-500"/> 다른 팁 보기
                    </button>
                </div>
            </div>
        </aside>

        {/* 3. Main Content (본문) */}
        <main className="flex-1 p-6 md:p-10">
            {!isSupabaseConfigured && (
                <div className="mb-6 rounded-2xl border-2 border-[#FCD34D] bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E]">
                    Supabase 환경변수가 아직 설정되지 않았어요. 게시판 이미지와 데이터는 현재 로컬 브라우저에만 저장됩니다.
                </div>
            )}
            
            {/* Banner Section */}
            <div id="about-section" className="mb-12 relative group rounded-[2.5rem] overflow-hidden shadow-xl border-4 border-white bg-white min-h-[350px] flex items-center justify-center transition-all hover:shadow-2xl">
                
                {!hasBannerError ? (
                    <>
                        <img
                          src={currentBannerImage}
                          alt="Class Banner"
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          onError={() => setHasBannerError(true)}
                        />
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>
                    </>
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-r from-[#FCD34D] to-[#FDA4AF] transition-all"></div>
                )}

                <div className="relative z-10 text-center p-8 text-white w-full max-w-5xl mx-auto flex flex-col items-center">
                    <div key={`icon-${currentSlide}`} className="mb-6 opacity-90 animate-bounce-slow drop-shadow-lg filter blur-[0.5px]">
                         {React.createElement(SLIDES[currentSlide].icon, { size: 80, strokeWidth: 2.5 })}
                    </div>
                    
                    <h2 key={`title-${currentSlide}`} className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-hand font-bold mb-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] animate-fade-in-up text-white tracking-wide whitespace-nowrap">
                        {SLIDES[currentSlide].title}
                    </h2>
                    
                    <p key={`desc-${currentSlide}`} className="text-sm sm:text-lg md:text-2xl opacity-95 font-bold drop-shadow-md animate-fade-in-up delay-100 bg-white/20 px-6 py-2 md:px-8 md:py-3 rounded-full backdrop-blur-sm border border-white/30 font-hand break-keep">
                        {SLIDES[currentSlide].desc}
                    </p>

                    <div className="flex gap-2 mt-8">
                        {SLIDES.map((_, idx) => (
                            <button 
                                key={idx} 
                                onClick={() => setCurrentSlide(idx)}
                                className={`h-2.5 rounded-full transition-all duration-300 shadow-sm ${currentSlide === idx ? 'bg-white w-8' : 'bg-white/40 w-2.5 hover:bg-white/60'}`}
                            />
                        ))}
                    </div>
                </div>

                {/* Slider Controls */}
                <button
                  type="button"
                  onClick={handlePrevSlide}
                  className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 z-20 h-6 w-6 md:h-7 md:w-7 rounded-full bg-white/80 backdrop-blur border border-white/60 shadow-lg text-white hover:bg-white/90 transition-all flex items-center justify-center"
                  aria-label="이전 배너"
                >
                  <span className="text-[#78350F] text-base font-bold">‹</span>
                </button>
                <button
                  type="button"
                  onClick={handleNextSlide}
                  className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 z-20 h-6 w-6 md:h-7 md:w-7 rounded-full bg-white/80 backdrop-blur border border-white/60 shadow-lg text-white hover:bg-white/90 transition-all flex items-center justify-center"
                  aria-label="다음 배너"
                >
                  <span className="text-[#78350F] text-base font-bold">›</span>
                </button>
            </div>

            {/* Title & Search */}
            <div id="features-section" className="mb-10">
                <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-6">
                    <div>
                        <h1 className="text-4xl font-bold text-[#78350F] mb-2 font-hand flex items-center gap-2">
                            <Sparkles className="text-[#FCD34D]" size={32} /> 학급 도구 모음
                        </h1>
                        <p className="text-gray-500 font-hand text-lg">선생님과 학생에게 필요한 모든 도구를 한 곳에서 만나보세요.</p>
                    </div>
                </div>
                
                <div className="flex gap-3">
                    <div className="relative flex-1 max-w-xl">
                        <Search className="absolute left-5 top-4 text-gray-400" size={20} />
                        <input 
                            type="text" 
                            placeholder="찾고 싶은 도구 이름이나 태그를 검색해보세요" 
                            className="w-full pl-14 pr-6 py-4 bg-white border-2 border-gray-100 rounded-2xl shadow-sm focus:ring-4 focus:ring-[#7DD3FC]/30 focus:border-[#7DD3FC] focus:outline-none transition-all placeholder-gray-300 font-hand text-lg text-gray-600"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="lg:hidden relative group">
                        <select 
                            className="appearance-none bg-white border-2 border-gray-100 text-gray-700 py-4 px-6 pr-10 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-[#7DD3FC] font-bold font-hand text-lg"
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value as Category)}
                        >
                            {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                        <Filter className="absolute right-4 top-5 text-gray-400 pointer-events-none" size={16}/>
                    </div>
                </div>
            </div>

            {/* App Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {filteredApps.map((app) => {
                    return (
                        <button
                            key={app.id}
                            onClick={() => onSelectApp(app.id)}
                            className="bg-white rounded-[2.5rem] p-0 shadow-sm border-2 border-white hover:border-[#7DD3FC]/50 hover:shadow-xl transition-all duration-300 text-left group flex flex-col h-full overflow-hidden hover:-translate-y-2 ring-1 ring-gray-50"
                        >
                            <div className="h-44 relative overflow-hidden">
                                <img src={app.image as string} alt={app.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 filter sepia-[0.1] saturate-150" />
                                <div className={`absolute inset-0 ${app.overlay as string} opacity-30 group-hover:opacity-20 transition-opacity mix-blend-multiply`}></div>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-40"></div>
                                <div className="absolute top-4 left-4 flex gap-1">
                                    {app.tags.slice(0,1).map((tag, i) => (
                                        <span key={i} className="bg-white/90 backdrop-blur-md text-[#78350F] text-xs font-bold px-2 py-1 rounded-full shadow-sm">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="p-7 flex-1 flex flex-col relative bg-white">
                                <div className="flex justify-between items-start mb-3">
                                    <h3 className="font-bold text-2xl text-[#78350F] group-hover:text-[#7DD3FC] transition-colors font-hand relative z-10">
                                        {app.title}
                                    </h3>
                                    <div className="opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all duration-300 text-[#7DD3FC] bg-[#E0F2FE] p-1.5 rounded-full">
                                        <ChevronRight size={20} />
                                    </div>
                                </div>
                                
                                <p className="text-gray-500 text-base mb-6 line-clamp-2 leading-relaxed font-medium font-hand">
                                    {app.description}
                                </p>

                                <div className="mt-auto flex flex-wrap gap-2">
                                    {app.tags.slice(1).map((tag, i) => (
                                        <span key={i} className="text-xs font-bold text-gray-400 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100 group-hover:border-[#7DD3FC]/20 group-hover:bg-[#E0F2FE]/30 group-hover:text-[#7DD3FC] transition-colors">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </button>
                    )
                })}
            </div>

            {filteredApps.length === 0 && (
                <div className="text-center py-20 bg-white/50 rounded-3xl border-2 border-dashed border-[#FCD34D]/30 mt-8">
                    <Search size={64} className="mx-auto text-gray-300 mb-6" />
                    <p className="text-gray-500 text-xl font-hand">검색 결과가 없습니다.</p>
                    <button onClick={() => {setSearchQuery(''); setSelectedCategory('ALL');}} className="mt-6 text-[#7DD3FC] font-bold hover:underline text-lg font-hand">
                        전체 목록 보기
                    </button>
                </div>
            )}
        </main>
      </div>

      {/* 4. Footer (하단) */}
      <footer className="bg-white border-t border-[#FCD34D]/30 mt-auto">
        <div className="max-w-[1600px] mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-5 gap-8">
            <div className="col-span-1 md:col-span-1">
                <div className="flex items-center gap-2 mb-4">
                    <div className="bg-[#FEF9E7] p-2 rounded-lg text-[#FCD34D]">
                        <GraduationCap size={24} />
                    </div>
                    <span className="text-xl font-bold text-[#78350F] font-hand">EduClass Helper</span>
                </div>
                <p className="text-gray-500 text-sm leading-relaxed font-hand">
                    선생님과 학생이 함께 만들어가는<br/>
                    행복한 교실을 위한 올인원 플랫폼
                </p>
            </div>
            
            <div className="font-hand">
                <h4 className="font-bold text-[#78350F] mb-4 text-lg">서비스</h4>
                <ul className="space-y-2 text-sm text-gray-500">
                    <li><button onClick={() => onSelectApp('features')} className="hover:text-[#7DD3FC]">기능 소개</button></li>
                    <li><button onClick={() => onSelectApp('use_cases')} className="hover:text-[#7DD3FC]">활용 사례</button></li>
                </ul>
            </div>

            <div className="font-hand">
                <h4 className="font-bold text-[#78350F] mb-4 text-lg">지원</h4>
                <ul className="space-y-2 text-sm text-gray-500">
                    <li><button onClick={() => onSelectApp('faq')} className="hover:text-[#7DD3FC]">자주 묻는 질문</button></li>
                    <li><button onClick={handleContactClick} className="hover:text-[#7DD3FC]">문의하기</button></li>
                    <li><button onClick={() => onSelectApp('terms')} className="hover:text-[#7DD3FC]">이용 약관</button></li>
                    <li><button onClick={() => onSelectApp('privacy')} className="hover:text-[#7DD3FC]">개인정보처리방침</button></li>
                </ul>
            </div>

            <div className="font-hand">
                <h4 className="font-bold text-[#78350F] mb-4 text-lg">리소스</h4>
                <ul className="space-y-2 text-sm text-gray-500">
                    <li><button onClick={() => handleTeacherResourceClick('community')} className="hover:text-[#7DD3FC]">교사 커뮤니티</button></li>
                    <li><button onClick={() => handleTeacherResourceClick('materials')} className="hover:text-[#7DD3FC]">수업 자료실</button></li>
                    <li><button onClick={() => onSelectApp('news')} className="hover:text-[#7DD3FC]">에듀테크 뉴스</button></li>
                </ul>
            </div>

            <div className="font-hand">
                <h4 className="font-bold text-[#78350F] mb-4 text-lg">도움말</h4>
                <ul className="space-y-2 text-sm text-gray-500">
                    <li>로그인이 안 되면 새로고침 후 다시 시도해 주세요.</li>
                    <li>이미지 업로드가 안 되면 오늘 업로드 횟수({DAILY_IMAGE_LIMIT}장)와 파일 용량을 확인해 주세요.</li>
                    <li>문제가 계속되면 ‘문의하기’로 화면 캡처와 함께 알려주세요.</li>
                </ul>
            </div>
        </div>
        <div className="bg-[#FEF9E7] py-6 text-center text-xs text-[#78350F]/60 border-t border-[#FCD34D]/20 font-hand">
            &copy; 2025 EduClass Helper. All rights reserved.
        </div>
      </footer>
    </div>
  );
};
