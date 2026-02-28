
import React, { useState, useEffect } from 'react';
import { 
  Home, Bell, ClipboardList, CheckSquare, PenTool, 
  Grid, Utensils, Users, UserCheck, Award, MessageCircle, 
  Mail, LogOut, BarChart3, AlertCircle, Contact,
  Book, Edit3, TableProperties, BookOpenCheck, Settings, Briefcase, Layout, CalendarDays, Calendar, BookMarked, QrCode, Wand2, FileText, X
} from 'lucide-react';
import * as boardService from '../services/boardService';
import * as messageService from '../services/messageService';
import * as studentService from '../services/studentService';
import { StudentRosterModal } from './StudentRosterModal';
import { QrCodeModal } from './QrCodeModal';
import { SentenceRefinerModal } from './SentenceRefinerModal';
import { StudentReportModal } from './StudentReportModal';
import { getCurrentUserProfile, getClassById, getSession, regenerateJoinCodeByClassId, getTeacherProfileDetails, updateTeacherProfile } from '../src/lib/supabase/auth';
import { getErrorMessage } from '../src/utils/errors';

interface TeacherDashboardProps {
  onSelectApp: (appId: string) => void;
  onBack: () => void;
  onLogout: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ onSelectApp, onBack, onLogout }) => {
  const [stats, setStats] = useState({
    pendingPosts: 0,
    unreadMessages: 0,
    studentCount: 0,
  });
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showRefinerModal, setShowRefinerModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [joinCodeLoading, setJoinCodeLoading] = useState(false);
  const [classId, setClassId] = useState<string | null>(null);
  const [onboardingWarning, setOnboardingWarning] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    displayName: '',
    schoolName: '',
    className: '',
  });

  useEffect(() => {
    loadQuickStats();
  }, [showRosterModal]); 

  const loadJoinCode = async () => {
    setJoinCodeLoading(true);
    try {
      const { preloadClassId } = await import('../services/studentService');
      await preloadClassId();
      const profile = await getCurrentUserProfile();
      if (profile?.class_id) {
        setClassId(profile.class_id);
        const klass = await getClassById(profile.class_id);
        setJoinCode(klass?.join_code || null);
        if (klass?.join_code) {
          localStorage.setItem('edu_join_code', klass.join_code);
        } else {
          localStorage.removeItem('edu_join_code');
        }
      } else {
        setClassId(null);
        setJoinCode(null);
        localStorage.removeItem('edu_join_code');
      }
    } finally {
      setJoinCodeLoading(false);
    }
  };

  useEffect(() => {
    loadJoinCode();
  }, []);

  useEffect(() => {
    const warning = localStorage.getItem('teacher_onboarding_warning');
    if (warning) {
      setOnboardingWarning(warning);
    }
  }, []);

  useEffect(() => {
    if (!showProfileModal) return;
    const loadProfile = async () => {
      setProfileLoading(true);
      setProfileError(null);
      try {
        const details = await getTeacherProfileDetails();
        if (!details) {
          setProfileForm({ displayName: '', schoolName: '', className: '' });
          setProfileError('아직 등록된 정보가 없습니다. 아래에 입력 후 저장해주세요.');
          return;
        }
        setProfileForm({
          displayName: details.displayName,
          schoolName: details.schoolName,
          className: details.className,
        });
      } catch (err: any) {
        setProfileError(getErrorMessage(err, '선생님 정보를 불러올 수 없습니다.'));
      } finally {
        setProfileLoading(false);
      }
    };
    loadProfile();
  }, [showProfileModal]);

  const handleUpdateProfile = async () => {
    if (!profileForm.displayName.trim() || !profileForm.schoolName.trim() || !profileForm.className.trim()) {
      setProfileError('성함, 학교명, 학급명을 모두 입력해주세요.');
      return;
    }
    setProfileLoading(true);
    setProfileError(null);
    try {
      await updateTeacherProfile({
        displayName: profileForm.displayName.trim(),
        schoolName: profileForm.schoolName.trim(),
        className: profileForm.className.trim(),
      });
      alert('내 정보가 저장되었습니다.');
      setShowProfileModal(false);
      await loadJoinCode();
    } catch (err: any) {
      setProfileError(getErrorMessage(err, '정보 수정에 실패했습니다.'));
    } finally {
      setProfileLoading(false);
    }
  };

  const loadQuickStats = async () => {
    const boardPosts = await boardService.getPosts('board'); 
    const galleryPosts = await boardService.getPosts('gallery');
    const pending = boardPosts.filter(p => p.status === 'pending').length + galleryPosts.filter(p => p.status === 'pending').length;

    const allMessages = messageService.getAllMessages();
    const unread = allMessages.filter(m => m.sender === 'student' && !m.isRead).length;

    const roster = studentService.getRoster();

    setStats({
        pendingPosts: pending,
        unreadMessages: unread,
        studentCount: roster.length
    });
  };

  const DashboardCard = ({ 
    title, icon: Icon, colorClass, subItems, onClick, badge, alert 
  }: { 
    title: string, icon: any, colorClass: string, subItems: string[], onClick: () => void, badge?: number, alert?: boolean 
  }) => (
    <button 
      onClick={onClick}
      className={`
        relative bg-white p-6 rounded-3xl shadow-sm border-2 transition-all text-left group flex flex-col h-full hover:-translate-y-1 hover:shadow-md
        ${alert ? 'border-[#FDA4AF] ring-4 ring-[#FFE4E6]' : 'border-[#FCD34D]/30 hover:border-[#FCD34D]'}
      `}
    >
      <div className="flex items-start justify-between w-full mb-4">
        <div className={`p-3 rounded-2xl ${colorClass} text-white shadow-sm transform group-hover:scale-110 transition-transform duration-300`}>
          <Icon size={28} />
        </div>
        {badge ? (
          <span className="bg-[#FDA4AF] text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse shadow-sm border border-white">
            {badge}건 대기
          </span>
        ) : null}
      </div>
      
      <h3 className="font-hand font-bold text-[#78350F] text-xl mb-3 group-hover:text-[#F59E0B] transition-colors">
        {title}
      </h3>
      
      <div className="flex flex-wrap gap-1.5 mt-auto">
        {subItems.map((item, idx) => (
            <span key={idx} className="text-[11px] font-bold text-[#92400E] bg-[#FEF9E7] px-2 py-1 rounded-lg border border-[#FDE68A]">
                {item}
            </span>
        ))}
      </div>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#FEF9E7] font-sans text-[#78350F]">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-[#FCD34D] sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[#FCD34D] text-[#78350F] p-2 rounded-xl">
                <BarChart3 size={24} />
            </div>
            <h1 className="font-hand font-bold text-[#78350F] text-2xl">선생님 대시보드</h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
                onClick={() => setShowRosterModal(true)} 
                className="text-sm font-bold text-[#78350F] hover:text-[#B45309] flex items-center gap-2 bg-[#FEF9E7] px-4 py-2 rounded-xl border border-[#FDE68A] hover:border-[#FCD34D] transition-all group"
            >
                <Contact size={18} /> 
                학급 명부 관리
                <span className="bg-[#FCD34D] text-white text-xs px-2 py-0.5 rounded-full font-bold">
                    {stats.studentCount}명
                </span>
            </button>
            <button
                onClick={() => setShowProfileModal(true)}
                className="h-12 px-4 rounded-xl bg-white border border-[#FDE68A] text-[#78350F] font-bold hover:bg-[#FEF9E7] transition-colors flex items-center gap-2"
            >
                <Edit3 size={18} /> 나의 정보 수정
            </button>
            <div className="h-4 w-px bg-[#FCD34D]"></div>
            <button onClick={onBack} className="text-sm text-gray-500 hover:text-[#7DD3FC] font-bold flex items-center gap-1">
                <Home size={18} /> 학생 화면
            </button>
            <button onClick={onLogout} className="text-sm text-[#FDA4AF] hover:text-[#F43F5E] font-bold flex items-center gap-1">
                <LogOut size={18} /> 로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6 md:p-10">
        {onboardingWarning && (
          <div className="mb-4 bg-[#FFF7ED] border-2 border-[#FDBA74] rounded-2xl p-4 text-sm font-bold text-[#9A3412]">
            {onboardingWarning}
          </div>
        )}
        <div className="mb-6 bg-white border-2 border-[#FCD34D]/40 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm">
          <div>
            <p className="text-sm font-bold text-[#92400E]">학생 입장 코드</p>
            <p className="text-2xl font-hand font-bold text-[#78350F] tracking-widest">
              {joinCodeLoading ? '불러오는 중...' : (joinCode || '미설정')}
            </p>
          </div>
          <button
            onClick={async () => {
              try {
                const profile = await getCurrentUserProfile();
                if (!profile?.class_id || !classId) {
                  alert('학급 정보를 찾을 수 없습니다. 다시 로그인해주세요.');
                  return;
                }
                const session = await getSession();
                const userId = session?.user?.id;
                if (!userId) {
                  alert('세션을 확인할 수 없습니다. 다시 로그인해주세요.');
                  return;
                }
                const updated = await regenerateJoinCodeByClassId(classId, userId);
                if (!updated) {
                  alert('코드 재발급에 실패했습니다. 다시 시도해주세요.');
                  return;
                }
                setJoinCode(updated?.join_code || null);
                alert('새 입장 코드로 변경되었습니다.');
              } catch (err) {
                alert(getErrorMessage(err, '입장 코드 변경에 실패했습니다.'));
              }
            }}
            className="h-12 px-4 rounded-xl bg-[#FEF9E7] border border-[#FDE68A] text-[#78350F] font-bold hover:bg-[#FCD34D] hover:text-white transition-colors"
          >
            새 코드 발급
          </button>
        </div>
        
        {/* Alerts */}
        {(stats.pendingPosts > 0 || stats.unreadMessages > 0) && (
            <div className="mb-8 bg-[#FFF1F2] border-2 border-[#FDA4AF] rounded-2xl p-5 flex items-center gap-4 animate-fade-in-down shadow-sm">
                <div className="bg-[#FDA4AF] p-2 rounded-full text-white">
                    <AlertCircle size={24} />
                </div>
                <div className="flex-1">
                    <h3 className="font-hand font-bold text-[#881337] text-lg mb-1">확인이 필요한 알림이 있어요!</h3>
                    <p className="text-sm text-[#9F1239] font-medium flex gap-4">
                        {stats.pendingPosts > 0 && <span>📢 게시물 승인 대기: <strong>{stats.pendingPosts}건</strong></span>}
                        {stats.unreadMessages > 0 && <span>💌 읽지 않은 쪽지: <strong>{stats.unreadMessages}건</strong></span>}
                    </p>
                </div>
            </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            
            <DashboardCard 
                title="학교 계획표"
                icon={TableProperties}
                colorClass="bg-[#FDA4AF]"
                subItems={['주간학습안내', '시간표', '급식표', '학사일정']}
                onClick={() => onSelectApp('planner')}
            />

            <DashboardCard 
                title="학습과제도구"
                icon={BookOpenCheck}
                colorClass="bg-[#A78BFA]" // Violet -> Soft Purple
                subItems={['배움노트', '글쓰기', '독서록', '오답노트', 'OMR']}
                onClick={() => onSelectApp('tasks')}
            />

            <DashboardCard 
                title="학급운영도구"
                icon={Settings}
                colorClass="bg-[#6EE7B7]"
                subItems={['알림장', '1인1역', '포인트', '쿠폰', '회의', '설문']}
                onClick={() => onSelectApp('management')}
            />

            <DashboardCard 
                title="학습보조도구"
                icon={Briefcase}
                colorClass="bg-[#7DD3FC]"
                subItems={['타이머', '발표뽑기', '자리배치', '빙고', '진로']}
                onClick={() => onSelectApp('tools')}
            />

            <DashboardCard 
                title="우리학급게시판"
                icon={Layout}
                colorClass="bg-[#FCD34D]"
                subItems={['자유게시판', '갤러리', '사진첩', '만화', '톡톡']}
                onClick={() => onSelectApp('class_board')}
                badge={stats.pendingPosts > 0 ? stats.pendingPosts : undefined}
                alert={stats.pendingPosts > 0}
            />

            <DashboardCard 
                title="할일체크"
                icon={CheckSquare}
                colorClass="bg-[#34D399]" // Green
                subItems={['오늘의 과제', '제출 현황', '일괄 승인']}
                onClick={() => onSelectApp('todo')}
            />

            <DashboardCard 
                title="교무수첩"
                icon={BookMarked}
                colorClass="bg-[#67E8F9]" // Cyan
                subItems={['연간/월간', '데일리로그', '명렬표', '회의록']}
                onClick={() => onSelectApp('schedule')}
            />

            <DashboardCard 
                title="선생님 1:1 쪽지"
                icon={Mail}
                colorClass="bg-[#F472B6]" // Pink
                subItems={['학생 상담', '쪽지함 관리']}
                onClick={() => onSelectApp('message')}
                badge={stats.unreadMessages > 0 ? stats.unreadMessages : undefined}
                alert={stats.unreadMessages > 0}
            />

            <DashboardCard 
                title="계기교육"
                icon={Calendar}
                colorClass="bg-[#93C5FD]" // Blue
                subItems={['월별 교육 자료 확인']}
                onClick={() => onSelectApp('occasion')}
            />

            <DashboardCard 
                title="QR코드 생성기"
                icon={QrCode}
                colorClass="bg-[#64748B]" // Slate
                subItems={['사이트 주소 변환', '이미지 저장']}
                onClick={() => setShowQrModal(true)}
            />

            <DashboardCard 
                title="AI 문장 다듬기"
                icon={Wand2}
                colorClass="bg-violet-500" // Violet
                subItems={['맞춤법 교정', '공손한 문장', '알림장 작성']}
                onClick={() => setShowRefinerModal(true)}
            />

            <DashboardCard 
                title="학생 활동 리포트"
                icon={FileText}
                colorClass="bg-orange-500" // Orange
                subItems={['학년도별 리포트', 'PDF 다운로드', '섹션 선택']}
                onClick={() => setShowReportModal(true)}
            />

        </div>
        
        <div className="mt-16 text-center text-[#78350F]/40 text-sm font-medium">
            <p>선생님 모드에서는 모든 데이터를 수정 및 삭제할 수 있습니다.</p>
        </div>

        {showRosterModal && (
            <StudentRosterModal onClose={() => setShowRosterModal(false)} />
        )}

        {showQrModal && (
            <QrCodeModal onClose={() => setShowQrModal(false)} />
        )}

        {showRefinerModal && (
            <SentenceRefinerModal onClose={() => setShowRefinerModal(false)} />
        )}

        {showReportModal && (
            <StudentReportModal onClose={() => setShowReportModal(false)} />
        )}

        {showProfileModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-gray-50 w-full max-w-md rounded-3xl shadow-2xl border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                        <h2 className="font-bold text-lg text-gray-800">나의 정보 수정</h2>
                        <button onClick={() => setShowProfileModal(false)} className="p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-200">
                            <X size={18} />
                        </button>
                    </div>
                    <div className="px-6 py-5 space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-600 mb-1">성함</label>
                            <input
                                type="text"
                                value={profileForm.displayName}
                                onChange={(e) => setProfileForm((prev) => ({ ...prev, displayName: e.target.value }))}
                                className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                                placeholder="예: 김민수"
                                disabled={profileLoading}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-600 mb-1">학교명</label>
                            <input
                                type="text"
                                value={profileForm.schoolName}
                                onChange={(e) => setProfileForm((prev) => ({ ...prev, schoolName: e.target.value }))}
                                className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                                placeholder="예: 나봄초등학교"
                                disabled={profileLoading}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-600 mb-1">학급명</label>
                            <input
                                type="text"
                                value={profileForm.className}
                                onChange={(e) => setProfileForm((prev) => ({ ...prev, className: e.target.value }))}
                                className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-amber-400 focus:outline-none"
                                placeholder="예: 3학년 2반"
                                disabled={profileLoading}
                            />
                        </div>
                        {profileError && (
                            <div className="text-sm text-rose-600 font-bold bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
                                {profileError}
                            </div>
                        )}
                    </div>
                    <div className="px-6 pb-6 flex gap-2">
                        <button
                            type="button"
                            onClick={() => setShowProfileModal(false)}
                            className="h-12 flex-1 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-100"
                            disabled={profileLoading}
                        >
                            취소
                        </button>
                        <button
                            type="button"
                            onClick={handleUpdateProfile}
                            className="h-12 flex-1 rounded-xl bg-[#FCD34D] text-white font-bold shadow-md hover:bg-[#F59E0B] transition-colors"
                            disabled={profileLoading}
                        >
                            {profileLoading ? '저장 중...' : '저장'}
                        </button>
                    </div>
                </div>
            </div>
        )}

      </main>
    </div>
  );
};
