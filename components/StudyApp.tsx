import React, { useState, useEffect, useRef } from 'react';
import { Home, Upload, BookOpen, Edit3, Check, X, FileText, Calendar, AlertCircle, Plus, Trash2, Clock, Download } from 'lucide-react';
import * as studyService from '../services/studyService';
import { WeeklyStudyData, StudyPeriod, BellScheduleItem } from '../types';

interface StudyAppProps {
  onBack: () => void;
  isTeacherMode: boolean;
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

export const StudyApp: React.FC<StudyAppProps> = ({ onBack, isTeacherMode }) => {
  const [data, setData] = useState<WeeklyStudyData | null>(null);
  const [bellSchedule, setBellSchedule] = useState<BellScheduleItem[]>(DEFAULT_BELL_SCHEDULE);
  const [todayDate, setTodayDate] = useState('');
  const [todayPeriods, setTodayPeriods] = useState<StudyPeriod[]>([]);
  const [showOriginal, setShowOriginal] = useState(false);
  
  // Teacher Mode
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedPeriods, setEditedPeriods] = useState<StudyPeriod[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    const studyData = await studyService.getStudyDataAsync();
    setData(studyData);
    const nextBell = studyData?.bellSchedule && studyData.bellSchedule.length > 0
      ? studyData.bellSchedule
      : DEFAULT_BELL_SCHEDULE;
    setBellSchedule(nextBell);
    
    const { date, periods } = await studyService.getTodayScheduleAsync();
    setTodayDate(date);
    setTodayPeriods(periods);
    setEditedPeriods(periods);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        alert('이미지 또는 PDF 파일만 업로드 가능합니다.');
        return;
    }

    setIsProcessing(true);
    try {
        // Just upload, no analysis
        await studyService.uploadStudySchedule(file);
        loadData();
        alert('주간학습안내 파일이 등록되었습니다!');
    } catch (err: any) {
        alert(err.message);
    } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveEdit = async () => {
    if (!todayDate) return;
    await studyService.updateDailySchedule(todayDate, editedPeriods);
    await loadData();
    setIsEditing(false);
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

  // --- Helpers ---
  const getSubjectColor = (subject: string) => {
      if (subject.includes('국어')) return 'bg-pink-100 text-pink-700 border-pink-200';
      if (subject.includes('수학')) return 'bg-blue-100 text-blue-700 border-blue-200';
      if (subject.includes('사회') || subject.includes('통합') || subject.includes('슬기')) return 'bg-green-100 text-green-700 border-green-200';
      if (subject.includes('과학')) return 'bg-purple-100 text-purple-700 border-purple-200';
      if (subject.includes('영어')) return 'bg-orange-100 text-orange-700 border-orange-200';
      if (subject.includes('음악') || subject.includes('미술') || subject.includes('체육') || subject.includes('즐거운')) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const getDateString = () => {
      const d = new Date(todayDate || new Date());
      return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  }

  // --- Render ---

  // 1. Loading
  if (isProcessing) {
      return (
          <div className="min-h-screen bg-pink-50 flex flex-col items-center justify-center p-4">
              <div className="bg-white p-8 rounded-2xl shadow-xl text-center space-y-4 max-w-sm w-full">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto"></div>
                  <h2 className="text-xl font-bold text-gray-800">파일 업로드 중...</h2>
                  <p className="text-gray-500 text-sm">잠시만 기다려주세요</p>
              </div>
          </div>
      )
  }

  return (
    <div className="min-h-screen bg-pink-50 flex flex-col font-sans">
        <header className="bg-white p-4 shadow-sm flex items-center justify-between sticky top-0 z-20">
            <div className="flex items-center gap-3">
                <button onClick={onBack} className="bg-gray-100 p-2 rounded-full text-gray-500 hover:bg-gray-200"><Home size={20}/></button>
                <h1 className="font-bold text-pink-900 text-xl flex items-center gap-2">
                    <BookOpen className="text-pink-500" /> 주간학습안내, 시간표
                </h1>
            </div>
            {isTeacherMode && (
                <div className="flex gap-2">
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        className="hidden" 
                        accept="image/*,application/pdf"
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-pink-700 shadow-md"
                    >
                        <Upload size={16} /> 파일 업로드
                    </button>
                    {data && (
                        <button 
                            onClick={() => setIsEditing(!isEditing)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 border transition-colors ${isEditing ? 'bg-pink-100 text-pink-700 border-pink-200' : 'bg-white text-gray-600 border-gray-200'}`}
                        >
                            <Edit3 size={16} /> 시간표 직접수정
                        </button>
                    )}
                </div>
            )}
        </header>

        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
            
            {/* Title */}
            <div className="text-center mb-8">
                <h2 className="text-3xl font-hand font-bold text-gray-800 mb-2">
                    {getDateString()} 오늘의 시간표
                </h2>
                
                {/* View File Button (Prominent) */}
                {data?.fileUrl && (
                    <button 
                        onClick={() => setShowOriginal(true)}
                        className="mt-4 bg-white text-pink-600 px-8 py-3 rounded-full shadow-lg font-bold flex items-center gap-2 hover:bg-pink-50 border-2 border-pink-100 mx-auto transition-transform hover:scale-105"
                    >
                        <FileText size={20} /> 이번 주 주간학습안내 파일 보기
                    </button>
                )}
            </div>

            <div className="flex flex-col lg:flex-row gap-8 items-start">
                
                {/* Left: Standard Timetable (시정표) */}
                <div className="w-full lg:w-1/4 shrink-0">
                    <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-200">
                        <div className="bg-pink-100 p-3 border-b border-pink-200 flex items-center justify-center gap-2 text-pink-800 font-bold">
                            <Clock size={18} /> 우리반 시정표
                        </div>
                        <div className="divide-y divide-gray-100">
                            {bellSchedule.map((item, idx) => (
                                <div
                                    key={idx}
                                    className={`flex items-center text-sm ${item.isBreak ? 'bg-blue-50 text-blue-900' : 'bg-white text-gray-800'}`}
                                >
                                    <div className="w-24 p-3 font-bold border-r border-gray-100/50 text-center shrink-0">
                                        {item.label}
                                    </div>
                                    <div className="flex-1 p-3 text-center font-mono">
                                        {item.time}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right: Daily Schedule Content */}
                <div className="flex-1 w-full">
                    {isEditing && isTeacherMode ? (
                        // EDIT MODE
                        <div className="bg-white rounded-2xl shadow-lg p-6 animate-fade-in-up border-2 border-pink-200">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-lg text-gray-700">오늘의 시간표 수정 (수동)</h3>
                                <button onClick={handleSaveEdit} className="bg-green-500 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-green-600 shadow-md">
                                    <Check size={18} /> 저장 완료
                                </button>
                            </div>
                            <div className="space-y-3">
                                {editedPeriods.map((item, idx) => (
                                    <div key={idx} className="flex gap-2 items-start bg-gray-50 p-3 rounded-xl border">
                                        <input 
                                            type="number" 
                                            value={item.period}
                                            onChange={e => handleEditChange(idx, 'period', parseInt(e.target.value))}
                                            className="w-16 p-2 border rounded-lg text-center font-bold"
                                            placeholder="교시"
                                        />
                                        <div className="flex-1 space-y-2">
                                            <input 
                                                type="text" 
                                                value={item.subject}
                                                onChange={e => handleEditChange(idx, 'subject', e.target.value)}
                                                className="w-full p-2 border rounded-lg font-bold"
                                                placeholder="과목명 (예: 국어)"
                                            />
                                            <input 
                                                type="text" 
                                                value={item.content}
                                                onChange={e => handleEditChange(idx, 'content', e.target.value)}
                                                className="w-full p-2 border rounded-lg text-sm"
                                                placeholder="학습 내용 간단 요약"
                                            />
                                        </div>
                                        <button onClick={() => handleRemovePeriod(idx)} className="text-red-400 hover:text-red-600 p-2">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))}
                                <button onClick={handleAddPeriod} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-pink-300 hover:text-pink-500 font-bold flex items-center justify-center gap-2">
                                    <Plus size={18} /> 교시 추가
                                </button>
                            </div>
                        </div>
                    ) : (
                        // VIEW MODE
                        <>
                            {!data ? (
                                <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-pink-100">
                                    <BookOpen size={64} className="mx-auto mb-4 text-pink-200" />
                                    <p className="text-xl font-bold text-gray-400">등록된 주간학습안내가 없습니다.</p>
                                    {isTeacherMode && <p className="text-sm text-gray-400 mt-2">상단 버튼을 눌러 PDF나 이미지 파일을 올려주세요.</p>}
                                </div>
                            ) : (
                                <>
                                    {todayPeriods.length === 0 ? (
                                        <div className="text-center py-16 bg-white rounded-3xl shadow-md">
                                            <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
                                            <p className="text-xl font-bold text-gray-600">오늘의 시간표 내용이 비어있습니다.</p>
                                            {isTeacherMode ? (
                                                <p className="text-sm text-gray-400 mt-2">
                                                    '시간표 직접수정' 버튼을 눌러 오늘의 과목을 입력하거나, <br/>
                                                    위의 '파일 보기' 버튼을 눌러 전체 계획표를 확인하세요.
                                                </p>
                                            ) : (
                                                <p className="text-sm text-gray-400 mt-2">위의 '이번 주 주간학습안내 파일 보기' 버튼을 눌러 확인하세요.</p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="grid gap-4">
                                            {todayPeriods.map((period) => (
                                                <div key={period.period} className="bg-white rounded-xl shadow-md p-5 flex items-center gap-5 hover:shadow-lg transition-shadow border-l-8 border-transparent hover:border-pink-200">
                                                    <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center font-bold text-lg text-gray-500 shadow-inner">
                                                        {period.period}교시
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold border mb-2 ${getSubjectColor(period.subject)}`}>
                                                            {period.subject}
                                                        </div>
                                                        <h3 className="text-xl font-bold text-gray-800 break-keep leading-snug">
                                                            {period.content}
                                                        </h3>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </main>

        {/* Modal: Original File */}
        {showOriginal && data?.fileUrl && (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowOriginal(false)}>
                <div className="bg-white rounded-2xl max-w-5xl w-full h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                        <div className="flex items-center gap-4">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <FileText size={18}/> 주간학습안내 파일 뷰어
                            </h3>
                            <a 
                                href={data.fileUrl} 
                                download={`weekly_schedule.${data.fileType === 'pdf' ? 'pdf' : 'png'}`}
                                className="bg-pink-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-pink-700 shadow-sm"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Download size={16} /> 다운로드
                            </a>
                        </div>
                        <button onClick={() => setShowOriginal(false)}><X size={24} className="text-gray-500 hover:text-black"/></button>
                    </div>
                    <div className="flex-1 overflow-auto bg-gray-200 flex items-center justify-center p-4">
                        {data.fileType === 'pdf' ? (
                            <iframe src={data.fileUrl} className="w-full h-full rounded-lg shadow-lg bg-white" title="Original PDF"></iframe>
                        ) : (
                            <img src={data.fileUrl} alt="Original Schedule" className="max-w-full shadow-lg rounded-lg" />
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};