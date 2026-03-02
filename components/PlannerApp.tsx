
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Home, BookOpen, Clock, CalendarRange, Upload, Edit3, Check, Trash2, Plus, FileText, X, Utensils, Download, CheckCircle2, XCircle, Sparkles, Loader2 } from 'lucide-react';
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

type Tab = 'guide' | 'timetable' | 'monthly' | 'lunch';

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
        showToast('success', '파일 등록 완료! 시간표를 자동 분석합니다...');
        handleAnalyzeSchedule(file);
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
                        { id: 'timetable', label: '시간표', icon: Clock },
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
                                        <>
                                            <button
                                                onClick={() => handleAnalyzeSchedule()}
                                                disabled={isAnalyzing}
                                                className="h-12 px-6 rounded-xl text-lg font-bold flex items-center gap-2 shadow-md transition-all bg-violet-500 text-white hover:bg-violet-600 disabled:bg-gray-400"
                                            >
                                                {isAnalyzing ? (
                                                    <><Loader2 size={20} className="animate-spin" /> 분석 중...</>
                                                ) : (
                                                    <><Sparkles size={20} /> AI 시간표 분석</>
                                                )}
                                            </button>
                                            <button
                                                onClick={handleDeleteGuide}
                                                className="h-12 px-6 rounded-xl text-lg font-bold flex items-center gap-2 bg-white text-[#F43F5E] border-2 border-[#FCA5A5] hover:bg-[#FFE4E6] shadow-sm"
                                            >
                                                <Trash2 size={18} /> 삭제
                                            </button>
                                        </>
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

            {activeTab === 'timetable' && (
                <div className="flex-1 p-6 md:p-10 overflow-y-auto max-w-[1920px] mx-auto w-full animate-fade-in-up">
                    <div className="text-center mb-6">
                        <h2 className="text-4xl font-hand font-bold text-[#78350F] mb-4">{getDateString()} 시간표</h2>
                        <div className="flex justify-center gap-2 flex-wrap">
                            {(() => {
                                const d = new Date(todayDate || new Date());
                                const dayOfWeek = d.getDay() || 7;
                                const monday = new Date(d);
                                monday.setDate(d.getDate() - (dayOfWeek - 1));
                                const labels = ['월', '화', '수', '목', '금'];
                                return labels.map((label, i) => {
                                    const date = new Date(monday);
                                    date.setDate(monday.getDate() + i);
                                    const dateStr = date.toISOString().split('T')[0];
                                    const isSelected = dateStr === todayDate;
                                    const hasPeriods = studyData?.schedules?.[dateStr]?.length > 0;
                                    return (
                                        <button
                                            key={dateStr}
                                            onClick={() => {
                                                setTodayDate(dateStr);
                                                const periods = studyData?.schedules?.[dateStr] || [];
                                                setTodayPeriods(periods);
                                                setEditedPeriods(periods);
                                            }}
                                            className={`px-5 py-2.5 rounded-xl font-bold text-lg transition-all ${
                                                isSelected
                                                    ? 'bg-[#FDA4AF] text-white shadow-md'
                                                    : hasPeriods
                                                    ? 'bg-[#FFE4E6] text-[#BE185D] border-2 border-[#FDA4AF]'
                                                    : 'bg-gray-100 text-gray-500 border-2 border-gray-200'
                                            }`}
                                        >
                                            {label} <span className="text-sm font-normal">{date.getDate()}일</span>
                                        </button>
                                    );
                                });
                            })()}
                        </div>
                    </div>

                    <div className="flex flex-col xl:flex-row gap-8 items-start">
                        <div className="w-full xl:w-1/3 shrink-0">
                            <div className="bg-white rounded-3xl shadow-xl overflow-hidden border-2 border-[#FDA4AF]">
                                <div className="bg-[#FFE4E6] p-5 border-b-2 border-[#FDA4AF] flex items-center justify-between gap-3 text-[#BE185D] font-bold text-2xl">
                                    <div className="flex items-center gap-3">
                                        <Clock size={28} /> 우리반 시정표
                                    </div>
                                    {isTeacherMode && (
                                        <button
                                            onClick={() => setIsEditingBell(!isEditingBell)}
                                            className={`h-12 px-4 rounded-xl text-sm font-bold border-2 transition-colors ${isEditingBell ? 'bg-[#FFE4E6] text-[#BE185D] border-[#FDA4AF]' : 'bg-white text-gray-600 border-gray-200'}`}
                                        >
                                            내용 수정
                                        </button>
                                    )}
                                </div>
                                {isEditingBell && isTeacherMode ? (
                                    <div className="p-4 space-y-4">
                                        {editedBellSchedule.map((item, idx) => (
                                            <div key={idx} className="bg-[#FEF9E7] p-4 rounded-2xl border-2 border-[#FDE68A] space-y-3">
                                                <div className="flex gap-3">
                                                    <input
                                                        type="text"
                                                        value={item.label}
                                                        onChange={(e) => handleBellItemChange(idx, 'label', e.target.value)}
                                                        className="w-28 p-2 border-2 rounded-xl text-center font-bold"
                                                        placeholder="항목"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={item.time}
                                                        onChange={(e) => handleBellItemChange(idx, 'time', e.target.value)}
                                                        className="flex-1 p-2 border-2 rounded-xl font-mono"
                                                        placeholder="시간 (예: 9:00 ~ 9:40)"
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <label className="flex items-center gap-2 text-sm font-bold text-[#92400E]">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!item.isBreak}
                                                            onChange={(e) => handleBellItemChange(idx, 'isBreak', e.target.checked)}
                                                        />
                                                        쉬는 시간/특별 시간
                                                    </label>
                                                    <button onClick={() => handleRemoveBellItem(idx)} className="text-[#FDA4AF] hover:text-[#BE185D]">
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        <button onClick={handleAddBellItem} className="w-full py-3 border-2 border-dashed border-[#FDE68A] rounded-2xl text-[#F59E0B] hover:bg-[#FEF9E7] font-bold text-sm">
                                            + 항목 추가
                                        </button>
                                        <button onClick={handleSaveBellSchedule} className="w-full h-12 bg-[#6EE7B7] text-white rounded-xl font-bold hover:bg-[#34D399] shadow-md">
                                            저장
                                        </button>
                                    </div>
                                ) : (
                                    <div className="divide-y-2 divide-[#FFE4E6]">
                                        {bellSchedule.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className={`flex items-center text-xl ${item.isBreak ? 'bg-[#E0F2FE] text-[#0369A1]' : 'bg-white text-[#78350F]'}`}
                                            >
                                                <div className="w-32 p-4 font-bold border-r-2 border-[#FDA4AF]/20 text-center shrink-0">{item.label}</div>
                                                <div className="flex-1 p-4 text-center font-mono font-medium tracking-tight">{item.time}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 w-full">
                            {isTeacherMode && (
                                <div className="flex justify-end mb-4">
                                    <button onClick={() => setIsEditing(!isEditing)} className={`px-6 py-3 rounded-xl text-lg font-bold flex items-center gap-2 border-2 transition-colors ${isEditing ? 'bg-[#FFE4E6] text-[#BE185D] border-[#FDA4AF]' : 'bg-white text-gray-600 border-gray-200'}`}>
                                        <Edit3 size={20} /> 내용 수정
                                    </button>
                                </div>
                            )}

                            {isEditing && isTeacherMode ? (
                                <div className="bg-white rounded-3xl shadow-xl p-6 border-2 border-[#FDA4AF]">
                                    <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
                                        <h3 className="font-bold text-2xl text-[#78350F]">시간표 수정</h3>
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                            <button onClick={handleSaveEdit} className="h-12 px-6 rounded-xl font-bold flex items-center gap-2 hover:bg-[#34D399] shadow-md text-lg bg-[#6EE7B7] text-white"><Check size={20} /> 저장</button>
                                            <button onClick={handleDeleteSchedule} className="h-12 px-6 rounded-xl font-bold flex items-center gap-2 bg-white text-[#F43F5E] border-2 border-[#FCA5A5] hover:bg-[#FFE4E6] text-lg">
                                                <Trash2 size={18} /> 삭제
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        {editedPeriods.map((item, idx) => (
                                            <div key={idx} className="flex gap-4 items-start bg-[#FEF9E7] p-4 rounded-2xl border-2 border-[#FDE68A]">
                                                <input type="number" value={item.period} onChange={e => handleEditChange(idx, 'period', parseInt(e.target.value))} className="w-16 p-3 border-2 rounded-xl text-center font-bold text-xl" placeholder="교시"/>
                                                <div className="flex-1 space-y-3">
                                                    <input type="text" value={item.subject} onChange={e => handleEditChange(idx, 'subject', e.target.value)} className="w-full p-3 border-2 rounded-xl font-bold text-xl" placeholder="과목명 (예: 국어)"/>
                                                    <input type="text" value={item.content} onChange={e => handleEditChange(idx, 'content', e.target.value)} className="w-full p-3 border-2 rounded-xl text-lg" placeholder="학습 내용 간단 요약"/>
                                                </div>
                                                <button onClick={() => handleRemovePeriod(idx)} className="text-[#FDA4AF] hover:text-[#BE185D] p-3"><Trash2 size={24} /></button>
                                            </div>
                                        ))}
                                        <button onClick={handleAddPeriod} className="w-full py-4 border-4 border-dashed border-[#FDE68A] rounded-2xl text-[#F59E0B] hover:bg-[#FEF9E7] font-bold flex items-center justify-center gap-2 text-xl"><Plus size={24} /> 교시 추가</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {todayPeriods.length === 0 ? (
                                        <div className="text-center py-24 bg-[#FEF9E7] rounded-3xl shadow-md border-2 border-[#FCD34D]">
                                            <p className="text-3xl font-bold text-[#F59E0B] mb-3">오늘 수업 정보가 없습니다.</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-5">
                                            {todayPeriods.map((period) => (
                                                <div key={period.period} className="bg-white rounded-3xl shadow-md p-6 flex items-center gap-6 hover:shadow-xl transition-shadow border-l-[10px] border-transparent hover:border-[#FDA4AF] min-h-[140px] border border-gray-100">
                                                    <div className="flex-shrink-0 w-24 h-24 bg-[#FEF9E7] rounded-full flex items-center justify-center font-bold text-2xl text-[#78350F] shadow-inner font-hand">
                                                        {period.period}교시
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className={`inline-block px-4 py-2 rounded-full text-lg font-bold border-2 mb-3 ${getSubjectColor(period.subject)}`}>
                                                            {period.subject}
                                                        </div>
                                                        <h3 className="text-3xl font-bold text-[#78350F] break-keep leading-normal font-hand">
                                                            {period.content}
                                                        </h3>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
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
