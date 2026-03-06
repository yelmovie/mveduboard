
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Home, BookOpen, CalendarRange, Upload, Check, Trash2, FileText, X, Utensils, Download, CheckCircle2, XCircle } from 'lucide-react';
import { Participant, WeeklyStudyData, StudyPeriod, BellScheduleItem } from '../types';
import * as studyService from '../services/studyService';
import type { MonthlyPlanData } from '../services/studyService';
import { analyzeScheduleFromFile } from '../services/scheduleAnalyzer';
import { LunchApp } from './LunchApp';

interface PlannerAppProps {
  onBack: () => void;
  isTeacherMode: boolean;
  student: Participant | null;
  onLoginRequest: () => void;
}

const DEFAULT_BELL_SCHEDULE: BellScheduleItem[] = [
    { label: '등교시간', time: '8:40 ~ 9:00', isBreak: true },
    { label: '1교시', time: '9:00 ~ 9:40' },
    { label: '2교시', time: '9:50 ~ 10:30' },
    { label: '놀이시간', time: '10:30 ~ 10:50', isBreak: true },
    { label: '3교시', time: '10:50 ~ 11:30' },
    { label: '4교시', time: '11:40 ~ 12:20' },
    { label: '5교시', time: '12:30 ~ 13:10' },
    { label: '점심시간', time: '13:10 ~ 14:00', isBreak: true },
    { label: '6교시', time: '14:00 ~ 14:40' },
];

type Tab = 'guide' | 'monthly' | 'lunch';

export const PlannerApp: React.FC<PlannerAppProps> = ({ onBack, isTeacherMode, student, onLoginRequest }) => {
  const [activeTab, setActiveTab] = useState<Tab>('guide');
  
  const [studyData, setStudyData] = useState<WeeklyStudyData | null>(null);
  const [bellSchedule, setBellSchedule] = useState<BellScheduleItem[]>(DEFAULT_BELL_SCHEDULE);
  const [todayDate, setTodayDate] = useState('');
  const [todayPeriods, setTodayPeriods] = useState<StudyPeriod[]>([]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPeriods, setEditedPeriods] = useState<StudyPeriod[]>([]);
  const [isEditingBell, setIsEditingBell] = useState(false);
  const [editedBellSchedule, setEditedBellSchedule] = useState<BellScheduleItem[]>(DEFAULT_BELL_SCHEDULE);
  const [showUploadSuccess, setShowUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const lastUploadedFileRef = useRef<File | null>(null);

  const [monthlyPlan, setMonthlyPlan] = useState<MonthlyPlanData | null>(null);
  const [isMonthlyProcessing, setIsMonthlyProcessing] = useState(false);
  const [showMonthlySuccess, setShowMonthlySuccess] = useState(false);
  const monthlyFileRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    void loadData();
  }, [isTeacherMode]);

  const loadData = async () => {
    const data = await studyService.getStudyDataAsync();
    setStudyData(data);
    const nextBell = data?.bellSchedule && data.bellSchedule.length > 0
      ? data.bellSchedule
      : DEFAULT_BELL_SCHEDULE;
    setBellSchedule(nextBell);
    setEditedBellSchedule(nextBell);
    
    const { date, periods } = await studyService.getTodayScheduleAsync();
    setTodayDate(date);
    setTodayPeriods(periods);
    setEditedPeriods(periods);

    const mp = await studyService.getMonthlyPlanAsync();
    setMonthlyPlan(mp);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        alert('이미지 또는 PDF 파일만 업로드 가능합니다.');
        return;
    }
    setIsProcessing(true);
    lastUploadedFileRef.current = file;
    try {
        await studyService.uploadStudySchedule(file);
        await loadData();
        setIsProcessing(false);
        setShowUploadSuccess(true);
        setTimeout(() => setShowUploadSuccess(false), 4000);
        showToast('success', '파일 등록 완료!');
    } catch (err: any) {
        setIsProcessing(false);
        showToast('error', err.message || '업로드에 실패했습니다. 다시 시도해주세요.');
    } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleMonthlyUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      alert('이미지 또는 PDF 파일만 업로드 가능합니다.');
      return;
    }
    setIsMonthlyProcessing(true);
    try {
      await studyService.uploadMonthlyPlan(file);
      await loadData();
      setIsMonthlyProcessing(false);
      setShowMonthlySuccess(true);
      setTimeout(() => setShowMonthlySuccess(false), 4000);
      showToast('success', '학교 월간교육계획 파일이 등록되었습니다!');
    } catch (err: any) {
      setIsMonthlyProcessing(false);
      showToast('error', err.message || '업로드에 실패했습니다.');
    } finally {
      if (monthlyFileRef.current) monthlyFileRef.current.value = '';
    }
  };

  const handleDeleteMonthly = async () => {
    const ok = window.confirm('학교 월간교육계획 파일을 삭제할까요?');
    if (!ok) return;
    await studyService.deleteMonthlyPlanAsync();
    await loadData();
    showToast('success', '학교 월간교육계획 파일이 삭제되었습니다.');
  };

  const resolveAnalysisFile = async (): Promise<File | null> => {
    if (lastUploadedFileRef.current) return lastUploadedFileRef.current;
    if (!studyData) return null;

    if (studyData.fileUrl && studyData.fileUrl.startsWith('data:')) {
      const res = await fetch(studyData.fileUrl);
      const blob = await res.blob();
      const ext = studyData.fileType === 'pdf' ? 'pdf' : 'png';
      const mimeType = studyData.fileType === 'pdf' ? 'application/pdf' : 'image/png';
      return new File([blob], `weekly-guide.${ext}`, { type: mimeType });
    }

    if (studyData.fileUrl && studyData.fileUrl.startsWith('http')) {
      try {
        const res = await fetch(studyData.fileUrl);
        const blob = await res.blob();
        const ext = studyData.fileType === 'pdf' ? 'pdf' : 'png';
        return new File([blob], `weekly-guide.${ext}`, { type: blob.type || 'image/png' });
      } catch {
        return null;
      }
    }

    return null;
  };

  const handleAnalyzeSchedule = async (file?: File | null) => {
    let targetFile = file || lastUploadedFileRef.current;
    if (!targetFile) {
      setIsAnalyzing(true);
      try {
        targetFile = await resolveAnalysisFile();
      } catch {
        targetFile = null;
      }
      if (!targetFile) {
        setIsAnalyzing(false);
        showToast('error', '분석할 파일이 없습니다. 주간학습안내를 먼저 업로드해주세요.');
        return;
      }
    } else {
      setIsAnalyzing(true);
    }
    try {
      const schedules = await analyzeScheduleFromFile(targetFile);
      const dayCount = Object.keys(schedules).length;
      if (dayCount === 0) {
        showToast('error', '시간표를 추출할 수 없었습니다. 직접 입력해주세요.');
        return;
      }
      await studyService.mergeAnalyzedSchedules(schedules);
      await loadData();
      showToast('success', `시간표 자동 분석 완료! (${dayCount}일치 추출)`);
    } catch (err: any) {
      console.error('[PlannerApp] AI analysis error', err);
      showToast('error', err.message || 'AI 분석에 실패했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeleteGuide = async () => {
      const ok = window.confirm('주간학습안내 파일을 삭제할까요?');
      if (!ok) return;
      await studyService.deleteStudyFileAsync();
      await loadData();
  };

  const handleSaveEdit = async () => {
    if (!todayDate) return;
    await studyService.updateDailySchedule(todayDate, editedPeriods);
    await loadData();
    setIsEditing(false);
  };

  const handleDeleteSchedule = async () => {
    if (!todayDate) return;
    const ok = window.confirm('오늘 시간표를 삭제할까요?');
    if (!ok) return;
    await studyService.deleteDailyScheduleAsync(todayDate);
    await loadData();
    setIsEditing(false);
  };

  const handleSaveBellSchedule = async () => {
    const data = await studyService.getStudyDataAsync();
    if (!data) return;
    const normalized = editedBellSchedule
      .map((item) => ({
        label: item.label.trim(),
        time: item.time.trim(),
        isBreak: item.isBreak,
      }))
      .filter((item) => item.label || item.time);
    data.bellSchedule = normalized.length > 0 ? normalized : DEFAULT_BELL_SCHEDULE;
    data.updatedAt = new Date().toISOString();
    await studyService.saveStudyDataAsync(data);
    await loadData();
    setIsEditingBell(false);
  };

  const handleBellItemChange = (index: number, field: keyof BellScheduleItem, value: string | boolean) => {
    const next = [...editedBellSchedule];
    next[index] = { ...next[index], [field]: value };
    setEditedBellSchedule(next);
  };

  const handleAddBellItem = () => {
    setEditedBellSchedule([...editedBellSchedule, { label: '', time: '', isBreak: false }]);
  };

  const handleRemoveBellItem = (index: number) => {
    const next = [...editedBellSchedule];
    next.splice(index, 1);
    setEditedBellSchedule(next);
  };

  const handleAddPeriod = () => {
      const nextPeriod = editedPeriods.length > 0 ? Math.max(...editedPeriods.map(p=>p.period)) + 1 : 1;
      setEditedPeriods([...editedPeriods, { period: nextPeriod, subject: '', content: '' }]);
  };

  const handleRemovePeriod = (index: number) => {
      const newPeriods = [...editedPeriods];
      newPeriods.splice(index, 1);
      setEditedPeriods(newPeriods);
  };

  const handleEditChange = (index: number, field: keyof StudyPeriod, value: string | number) => {
      const newPeriods = [...editedPeriods];
      newPeriods[index] = { ...newPeriods[index], [field]: value };
      setEditedPeriods(newPeriods);
  };

  const getSubjectColor = (subject: string) => {
      if (subject.includes('국어')) return 'bg-[#FCE7F3] text-[#BE185D] border-[#FBCFE8]';
      if (subject.includes('수학')) return 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]';
      if (subject.includes('사회') || subject.includes('통합') || subject.includes('슬기')) return 'bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]';
      if (subject.includes('과학')) return 'bg-[#EDE9FE] text-[#6D28D9] border-[#DDD6FE]';
      if (subject.includes('영어')) return 'bg-[#FFEDD5] text-[#C2410C] border-[#FED7AA]';
      if (subject.includes('음악') || subject.includes('미술') || subject.includes('체육') || subject.includes('즐거운')) return 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]';
      return 'bg-white text-gray-700 border-gray-200';
  };

  const getDateString = () => {
      const d = new Date(todayDate || new Date());
      return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  }

  const getDownloadFilename = () => {
      const d = new Date(todayDate || new Date());
      const yyyymmdd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
      const ext = studyData?.fileType === 'pdf' ? 'pdf' : 'png';
      return `weekly-guide-${yyyymmdd}.${ext}`;
  };

  if (isProcessing) {
      return (
          <div className="min-h-screen bg-[#FEF9E7] flex flex-col items-center justify-center p-4">
              <div className="bg-white p-8 rounded-2xl shadow-xl text-center space-y-4 max-w-sm w-full">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FDA4AF] mx-auto"></div>
                  <h2 className="text-xl font-bold text-[#78350F]">업로드 중...</h2>
              </div>
          </div>
      )
  }

  return (
    <div className="min-h-screen bg-[#FEF9E7] flex flex-col font-sans">
        <header className="bg-white p-6 shadow-sm sticky top-0 z-20 border-b border-[#FCD34D]">
            <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <button onClick={onBack} className="bg-[#FEF9E7] p-3 rounded-full text-[#92400E] hover:bg-[#FCD34D] hover:text-white transition-colors"><Home size={28}/></button>
                    <h1 className="font-hand font-bold text-[#78350F] text-3xl flex items-center gap-3">
                        <CalendarRange size={36} className="text-[#FDA4AF]" /> 학교 계획표
                    </h1>
                </div>
                
                <div className="flex bg-[#FEF9E7] p-2 rounded-2xl overflow-x-auto w-full lg:w-auto border border-[#FDE68A]">
                    {[
                        { id: 'guide', label: '주간학습안내', icon: BookOpen },
                        { id: 'lunch', label: '급식표', icon: Utensils },
                        { id: 'monthly', label: '학교 월간교육', icon: CalendarRange },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as Tab)}
                            className={`flex items-center gap-2 px-8 py-3 rounded-xl text-lg font-bold transition-all whitespace-nowrap flex-1 lg:flex-none justify-center ${activeTab === tab.id ? 'bg-[#FDA4AF] text-white shadow-md' : 'text-[#92400E] hover:bg-white'}`}
                        >
                            <tab.icon size={20} /> {tab.label}
                        </button>
                    ))}
                </div>
            </div>
        </header>

        <main className="flex-1 overflow-hidden flex flex-col bg-white">
            {activeTab === 'guide' && (
                <div className="flex-1 p-6 md:p-10 overflow-y-auto max-w-7xl mx-auto w-full animate-fade-in-up">
                    <div className="flex flex-col gap-4 mb-8 md:flex-row md:items-center md:justify-between">
                        <h2 className="text-3xl font-bold font-hand text-[#78350F]">이번 주 학습 안내</h2>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            {isTeacherMode && (
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*,application/pdf" />
                                    {showUploadSuccess ? (
                                        <button className="h-12 px-6 rounded-xl text-lg font-bold flex items-center gap-2 shadow-md cursor-default animate-pulse bg-[#6EE7B7] text-white">
                                            <Check size={20} /> 업로드 완료
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="h-12 px-6 rounded-xl text-lg font-bold flex items-center gap-2 hover:bg-[#F43F5E] shadow-md transition-all bg-[#FDA4AF] text-white"
                                        >
                                            <Upload size={20} /> 파일 업로드
                                        </button>
                                    )}
                                    {(studyData?.fileUrl || studyData?.filePath) && (
                                        <button
                                            onClick={handleDeleteGuide}
                                            className="h-12 px-6 rounded-xl text-lg font-bold flex items-center gap-2 bg-white text-[#F43F5E] border-2 border-[#FCA5A5] hover:bg-[#FFE4E6] shadow-sm"
                                        >
                                            <Trash2 size={18} /> 삭제
                                        </button>
                                    )}
                                </div>
                            )}
                            {!isTeacherMode && studyData?.fileUrl && (
                                <a
                                    href={studyData.fileUrl}
                                    download={getDownloadFilename()}
                                    className="h-12 px-6 rounded-xl bg-[#F3F4F6] text-[#374151] font-bold flex items-center justify-center gap-2 shadow-md hover:bg-[#E5E7EB] transition-colors w-full sm:w-auto"
                                >
                                    <Download size={20} /> 주간학습안내 다운로드
                                </a>
                            )}
                        </div>
                    </div>

                    {studyData?.fileUrl ? (
                        <div className="bg-gray-100 rounded-3xl overflow-hidden shadow-inner border border-gray-200 h-[75vh] flex items-center justify-center">
                             {studyData.fileType === 'pdf' ? (
                                <iframe src={studyData.fileUrl} className="w-full h-full" title="Weekly Guide PDF"></iframe>
                            ) : (
                                <img src={studyData.fileUrl} alt="Weekly Guide" className="max-w-full max-h-full object-contain" />
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-32 bg-[#FEF9E7] rounded-3xl border-2 border-dashed border-[#FCD34D]">
                            <BookOpen size={80} className="mx-auto mb-6 text-[#FCD34D]" />
                            <p className="text-[#92400E] text-xl font-bold">등록된 주간학습안내가 없습니다.</p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'monthly' && (
                <div className="flex-1 p-6 md:p-10 overflow-y-auto max-w-7xl mx-auto w-full animate-fade-in-up">
                    <div className="flex flex-col gap-4 mb-8 md:flex-row md:items-center md:justify-between">
                        <h2 className="text-3xl font-bold font-hand text-[#78350F]">학교 월간교육계획</h2>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            {isTeacherMode && (
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                    <input type="file" ref={monthlyFileRef} onChange={handleMonthlyUpload} className="hidden" accept="image/*,application/pdf" />
                                    {showMonthlySuccess ? (
                                        <button className="h-12 px-6 rounded-xl text-lg font-bold flex items-center gap-2 shadow-md cursor-default animate-pulse bg-[#6EE7B7] text-white">
                                            <Check size={20} /> 업로드 완료
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => monthlyFileRef.current?.click()}
                                            disabled={isMonthlyProcessing}
                                            className="h-12 px-6 rounded-xl text-lg font-bold flex items-center gap-2 hover:bg-[#F43F5E] shadow-md transition-all bg-[#FDA4AF] text-white disabled:bg-gray-400"
                                        >
                                            {isMonthlyProcessing ? (
                                                <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> 업로드 중...</>
                                            ) : (
                                                <><Upload size={20} /> 파일 업로드</>
                                            )}
                                        </button>
                                    )}
                                    {(monthlyPlan?.fileUrl || monthlyPlan?.filePath) && (
                                        <button
                                            onClick={handleDeleteMonthly}
                                            className="h-12 px-6 rounded-xl text-lg font-bold flex items-center gap-2 bg-white text-[#F43F5E] border-2 border-[#FCA5A5] hover:bg-[#FFE4E6] shadow-sm"
                                        >
                                            <Trash2 size={18} /> 삭제
                                        </button>
                                    )}
                                </div>
                            )}
                            {!isTeacherMode && monthlyPlan?.fileUrl && (
                                <a
                                    href={monthlyPlan.fileUrl}
                                    download={`monthly-plan.${monthlyPlan.fileType === 'pdf' ? 'pdf' : 'png'}`}
                                    className="h-12 px-6 rounded-xl bg-[#F3F4F6] text-[#374151] font-bold flex items-center justify-center gap-2 shadow-md hover:bg-[#E5E7EB] transition-colors w-full sm:w-auto"
                                >
                                    <Download size={20} /> 월간교육계획 다운로드
                                </a>
                            )}
                        </div>
                    </div>

                    {monthlyPlan?.fileUrl ? (
                        <div className="bg-gray-100 rounded-3xl overflow-hidden shadow-inner border border-gray-200 h-[75vh] flex items-center justify-center">
                            {monthlyPlan.fileType === 'pdf' ? (
                                <iframe src={monthlyPlan.fileUrl} className="w-full h-full" title="Monthly Plan PDF"></iframe>
                            ) : (
                                <img src={monthlyPlan.fileUrl} alt="Monthly Plan" className="max-w-full max-h-full object-contain" />
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-32 bg-[#FEF9E7] rounded-3xl border-2 border-dashed border-[#FCD34D]">
                            <CalendarRange size={80} className="mx-auto mb-6 text-[#FCD34D]" />
                            <p className="text-[#92400E] text-xl font-bold">등록된 학교 월간교육계획이 없습니다.</p>
                            {isTeacherMode && <p className="text-[#B45309] text-sm mt-2">위의 '파일 업로드' 버튼을 눌러 PDF나 이미지를 올려주세요.</p>}
                        </div>
                    )}
                </div>
            )}
            {activeTab === 'lunch' && <div className="flex-1 bg-white animate-fade-in-up overflow-hidden h-full"><LunchApp onBack={() => {}} isTeacherMode={isTeacherMode} embedded={true} /></div>}
        </main>

        {/* Toast notification */}
        {toast && (
            <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[60] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-fade-in-up min-w-[320px] max-w-md ${
                toast.type === 'success'
                    ? 'bg-green-600 text-white'
                    : 'bg-red-600 text-white'
            }`}>
                {toast.type === 'success' ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
                <span className="font-bold text-base flex-1">{toast.message}</span>
                <button onClick={() => setToast(null)} className="opacity-70 hover:opacity-100 p-1">
                    <X size={18} />
                </button>
            </div>
        )}
    </div>
  );
};
