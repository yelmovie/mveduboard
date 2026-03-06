
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Home, ChevronLeft, ChevronRight, Plus, Trash2, CalendarDays, CalendarRange, ListTodo, Check, Clock, Printer, X, Maximize2, Minimize2, BookMarked, Users, BookOpen, FileText, Sun, Cloud, CloudRain, Snowflake, CheckCircle2, Save, MoreHorizontal, CheckSquare, Edit3, Grid, Paintbrush, Eraser, Phone, MessageCircle, MapPin, Search, Upload, Eye, Download } from 'lucide-react';
import { Participant, ScheduleItem, ScheduleItemType, ClassStudent } from '../types';
import * as scheduleService from '../services/scheduleService';
import * as studentService from '../services/studentService';
import * as handbookFileService from '../services/handbookFileService';
import { generateUUID } from '../src/utils/uuid';
import { supabase } from '../src/lib/supabase/client';
import { getCurrentUserProfile } from '../src/lib/supabase/auth';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

interface ScheduleAppProps {
  onBack: () => void;
  isTeacherMode: boolean;
  student: Participant | null;
  onLoginRequest: () => void;
}

type TabSection = 'yearly' | 'monthly' | 'weekly' | 'daily' | 'roster' | 'contact' | 'counsel' | 'log' | 'export';

export type ContactInfoItem = { phone: string; motherPhone: string; fatherPhone: string; address: string };

// --- Academic Calendar Types ---
interface AcademicWeek {
    weekNum: number;
    periodStr: string; // 기간 (e.g. 3.4-3.8)
    daysCount: number; // 수업일수
    schedule: string[][]; // 5 days x 6 periods. contains short codes like '국', '수'
    remarks: string;
}

const SUBJECT_PALETTE = [
    { code: '국', name: '국어', color: 'bg-red-100 text-red-900 border-red-200' },
    { code: '수', name: '수학', color: 'bg-blue-100 text-blue-900 border-blue-200' },
    { code: '사', name: '사회', color: 'bg-green-100 text-green-900 border-green-200' },
    { code: '과', name: '과학', color: 'bg-purple-100 text-purple-900 border-purple-200' },
    { code: '영', name: '영어', color: 'bg-orange-100 text-orange-900 border-orange-200' },
    { code: '음', name: '음악', color: 'bg-pink-100 text-pink-900 border-pink-200' },
    { code: '미', name: '미술', color: 'bg-yellow-100 text-yellow-900 border-yellow-200' },
    { code: '체', name: '체육', color: 'bg-teal-100 text-teal-900 border-teal-200' },
    { code: '도', name: '도덕', color: 'bg-indigo-100 text-indigo-900 border-indigo-200' },
    { code: '실', name: '실과', color: 'bg-lime-100 text-lime-900 border-lime-200' },
    { code: '창', name: '창체', color: 'bg-gray-200 text-gray-900 border-gray-300' },
    { code: '안', name: '안전', color: 'bg-amber-200 text-amber-900 border-amber-300' },
    { code: '자', name: '자율', color: 'bg-cyan-100 text-cyan-900 border-cyan-200' },
    { code: '', name: '지우개', color: 'bg-white text-gray-400 border-gray-200 dashed' },
];

export const ScheduleApp: React.FC<ScheduleAppProps> = ({ onBack, isTeacherMode, student, onLoginRequest }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabSection>('daily');
  
  // Common Data
  const [currentDate, setCurrentDate] = useState(new Date());
  const [refreshKey, setRefreshKey] = useState(0);
  const studentId = isTeacherMode ? 'teacher' : (student ? student.id : 'guest');
  const [roster, setRoster] = useState<ClassStudent[]>(studentService.getRoster());
  const [rosterLoading, setRosterLoading] = useState(false);
  const [contactInfo, setContactInfo] = useState<Record<string, ContactInfoItem>>({});
  const [counselLogs, setCounselLogs] = useState<{ id: string; studentId: string; date: string; type: string; content: string }[]>([]);
  const [exportDateFrom, setExportDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [exportDateTo, setExportDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [exportItems, setExportItems] = useState<Record<string, boolean>>({ roster: true, contact: true, counsel: true, log: true });
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const saveHandlersRef = useRef<Record<string, () => void | Promise<void>>>({});
  const diaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const shouldLoad = isTeacherMode && ['roster', 'contact', 'counsel', 'log'].includes(activeTab);
    if (!shouldLoad) return;
    setRosterLoading(true);
    (async () => {
      try {
        await studentService.preloadClassId();
        const data = await studentService.fetchRosterFromDb();
        setRoster(data);
      } catch {
        setRoster(studentService.getRoster());
      } finally {
        setRosterLoading(false);
      }
    })();
  }, [activeTab, isTeacherMode]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('edu_contact_info');
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, { phone?: string; parentPhone?: string; motherPhone?: string; fatherPhone?: string; address?: string }>;
        const migrated: Record<string, ContactInfoItem> = {};
        Object.keys(parsed).forEach((id) => {
          const p = parsed[id];
          migrated[id] = {
            phone: p.phone ?? '',
            motherPhone: p.motherPhone ?? p.parentPhone ?? '',
            fatherPhone: p.fatherPhone ?? '',
            address: p.address ?? '',
          };
        });
        setContactInfo(migrated);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('edu_counsel_logs');
      if (stored) setCounselLogs(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, []);

  // --- Handlers ---
  const handleDateChange = (offset: number) => {
    const newDate = new Date(currentDate);
    if (activeTab === 'yearly') newDate.setFullYear(newDate.getFullYear() + offset);
    else if (activeTab === 'monthly') newDate.setMonth(newDate.getMonth() + offset);
    else if (activeTab === 'weekly') newDate.setDate(newDate.getDate() + (offset * 7));
    else newDate.setDate(newDate.getDate() + offset);
    setCurrentDate(newDate);
  };

  const refresh = () => setRefreshKey(p => p + 1);

  const handlePrint = () => {
      window.print();
  };

  const handleSavePdf = async () => {
    if (!diaryRef.current) return;
    setIsSavingPdf(true);
    try {
      const canvas = await html2canvas(diaryRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait',
        unit: 'pt',
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      const tabLabel = TABS.find((t) => t.id === activeTab)?.label || 'diary';
      pdf.save(`${tabLabel}_다이어리.pdf`);
    } catch (error: any) {
      alert(error?.message || 'PDF 저장에 실패했습니다.');
    } finally {
      setIsSavingPdf(false);
    }
  };

  const registerSaveHandler = (key: string, handler: () => void | Promise<void>) => {
    saveHandlersRef.current[key] = handler;
    return () => {
      delete saveHandlersRef.current[key];
    };
  };

  // 명렬표(비고/형제자매) 저장 — 명부 탭일 때만 등록
  const rosterRef = useRef(roster);
  rosterRef.current = roster;
  useEffect(() => {
    if (activeTab !== 'roster' || !isTeacherMode) return;
    const handler = async () => {
      const list = rosterRef.current;
      if (!list.length) return;
      try {
        const profile = await getCurrentUserProfile();
        const classId = profile?.class_id;
        if (classId) await studentService.saveRosterToDb(list, classId);
      } catch (e) {
        console.warn('[ScheduleApp] roster save failed', e);
      }
    };
    return registerSaveHandler('roster-table', handler);
  }, [activeTab, isTeacherMode, registerSaveHandler]);

  const handleRosterDownloadPdf = useCallback(() => {
    const list = rosterRef.current;
    if (!list.length) {
      alert('다운로드할 명단이 없습니다.');
      return;
    }
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const headers = ['No', '이름', '성별', '생년월일', '이전학년반', '형제자매', '비고'];
    const colW = [12, 28, 18, 28, 28, 35, 45];
    let y = 14;
    headers.forEach((h, i) => doc.text(h, 14 + colW.slice(0, i).reduce((a, b) => a + b, 0), y));
    y += 8;
    list.forEach((s) => {
      const row = [
        String(s.number),
        s.name,
        s.gender === 'male' ? '남' : s.gender === 'female' ? '여' : '-',
        s.birthDate ?? '-',
        s.previousGradeClass ?? '-',
        s.siblings ?? '-',
        s.remarks ?? '-',
      ];
      row.forEach((cell, i) => doc.text(String(cell).slice(0, 20), 14 + colW.slice(0, i).reduce((a, b) => a + b, 0), y));
      y += 6;
    });
    doc.save(`학급명렬표_${new Date().toISOString().slice(0, 10)}.pdf`);
  }, []);

  const handleRosterDownloadExcel = useCallback(() => {
    const list = rosterRef.current;
    if (!list.length) {
      alert('다운로드할 명단이 없습니다.');
      return;
    }
    const headers = ['No', '이름', '성별', '생년월일', '이전학년반', '형제자매', '비고'];
    const rows = list.map((s) => [
      s.number,
      s.name,
      s.gender === 'male' ? '남' : s.gender === 'female' ? '여' : '',
      s.birthDate ?? '',
      s.previousGradeClass ?? '',
      s.siblings ?? '',
      s.remarks ?? '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `학급명렬표_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, []);

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await Promise.all(Object.values(saveHandlersRef.current).map((handler) => Promise.resolve(handler())));
      alert('저장되었습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // --- 1. COVER VIEW ---
  if (!isOpen) {
      return (
          <div className="min-h-screen bg-[#e5e5f7] flex flex-col items-center justify-center p-4 font-sans perspective-1000 relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#444cf7_0.5px,transparent_0.5px),radial-gradient(#444cf7_0.5px,#e5e5f7_0.5px)] bg-[size:20px_20px]"></div>
                
                <div className="absolute top-6 left-6 z-20">
                    <button onClick={onBack} className="bg-white p-3 rounded-full shadow-lg text-gray-600 hover:scale-110 transition-transform">
                        <Home size={24} />
                    </button>
                </div>

                <div 
                    onClick={() => setIsOpen(true)}
                    className={`
                        relative w-[340px] h-[480px] sm:w-[420px] sm:h-[600px] rounded-r-3xl rounded-l-md shadow-[20px_20px_60px_rgba(0,0,0,0.3)] cursor-pointer group transform transition-transform duration-500 hover:rotate-y-[-10deg] hover:-translate-x-4 border-l-8 
                        ${isTeacherMode ? 'bg-[#2c3e50] border-[#1a252f]' : 'bg-[#eab308] border-[#a16207]'}
                    `}
                >
                    {/* Texture Effect */}
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/leather.png')] opacity-50 rounded-r-3xl rounded-l-md pointer-events-none mix-blend-overlay"></div>
                    
                    {/* Stitching */}
                    <div className="absolute top-4 bottom-4 right-4 w-0.5 border-r-2 border-dashed border-[#ffffff30]"></div>
                    <div className="absolute top-4 bottom-4 left-6 w-0.5 border-l-2 border-dashed border-[#ffffff30]"></div>

                    {/* Label/Badge */}
                    <div className="absolute top-24 left-0 right-0 flex justify-center">
                        <div className={`
                            px-10 py-5 rounded-lg shadow-md border-4 transform -rotate-2
                            ${isTeacherMode ? 'bg-[#f1c40f] text-[#2c3e50] border-[#2c3e50]' : 'bg-white text-[#ca8a04] border-[#eab308]'}
                        `}>
                            <h1 className="text-4xl font-black font-serif tracking-widest">
                                {isTeacherMode ? "TEACHER'S" : "MY SCHOOL"}
                            </h1>
                            <h2 className="text-2xl font-bold text-center tracking-wider mt-1">
                                {isTeacherMode ? "DIARY" : "LIFE"}
                            </h2>
                        </div>
                    </div>

                    <div className="absolute bottom-24 left-0 right-0 text-center text-white/90 font-hand text-xl opacity-80">
                        <p>{new Date().getFullYear()} School Year</p>
                        {!isTeacherMode && student && <p className="mt-1 font-bold">{student.nickname}</p>}
                        <p className="text-base mt-2 animate-pulse">Click to Open</p>
                    </div>

                    {/* Bookmark */}
                    <div className={`absolute -bottom-4 right-12 w-10 h-28 rounded-b-lg shadow-md z-10 group-hover:h-32 transition-all ${isTeacherMode ? 'bg-red-700' : 'bg-blue-600'}`}></div>
                </div>
                <p className="mt-8 text-xs text-stone-500 text-center max-w-md">
                    1년 단위 자료는 자동 삭제되지만, 자료는 PDF로 다운받아 보관할 수 있어요.
                </p>
          </div>
      );
  }

  // --- 2. OPEN BOOK VIEW ---
  const TABS = isTeacherMode 
    ? [
        { id: 'yearly', label: '3종세트', color: 'bg-rose-500', icon: CalendarRange },
        { id: 'monthly', label: '월간', color: 'bg-orange-500', icon: CalendarDays },
        { id: 'daily', label: '일간', color: 'bg-emerald-500', icon: BookOpen },
        { id: 'roster', label: '명부', color: 'bg-blue-500', icon: Users },
        { id: 'contact', label: '주소록', color: 'bg-indigo-500', icon: Phone },
        { id: 'counsel', label: '상담/관찰', color: 'bg-teal-500', icon: MessageCircle },
        { id: 'log', label: '기록', color: 'bg-violet-500', icon: FileText },
        { id: 'export', label: '기록저장인쇄', color: 'bg-slate-600', icon: Printer },
      ]
    : [
        { id: 'yearly', label: '3종세트', color: 'bg-rose-500', icon: CalendarRange },
        { id: 'monthly', label: '월간목표', color: 'bg-orange-500', icon: CalendarDays },
        { id: 'weekly', label: '주간계획', color: 'bg-blue-500', icon: CalendarDays },
        { id: 'daily', label: '일일플래너', color: 'bg-emerald-500', icon: BookOpen },
      ];

  // Hide spring on Yearly tab for Teachers to allow full width tables
  const showSpring = !(isTeacherMode && (activeTab === 'yearly'));

  return (
      <div className="min-h-screen bg-[#e2e8f0] flex flex-col items-center justify-center p-0 sm:p-4 font-sans relative overflow-hidden">
          {/* Print Styles */}
          <style>{`
            @media print {
              @page { size: landscape; margin: 0.5cm; }
              body * { visibility: hidden; }
              #printable-area, #printable-area * { visibility: visible; }
              #diary-print-area, #diary-print-area * { visibility: visible; }
              #printable-area {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                height: auto;
                background: white !important;
                display: block;
                box-shadow: none !important;
                border: none !important;
                padding: 0 !important;
                margin: 0 !important;
              }
              .no-print { display: none !important; }
              /* Force background colors */
              .bg-red-100 { background-color: #fee2e2 !important; -webkit-print-color-adjust: exact; }
              .bg-blue-100 { background-color: #dbeafe !important; -webkit-print-color-adjust: exact; }
              .bg-green-100 { background-color: #dcfce7 !important; -webkit-print-color-adjust: exact; }
            }
          `}</style>

          {/* Controls Header */}
          <div className="absolute top-4 left-4 right-4 flex justify-between z-50 pointer-events-none no-print">
              <div className="pointer-events-auto flex gap-2">
                  <button onClick={() => setIsOpen(false)} className="bg-white/90 p-2 rounded-full shadow hover:bg-white transition-colors text-slate-700" title="표지 닫기">
                      <X size={24} />
                  </button>
                  <button onClick={onBack} className="bg-white/90 p-2 rounded-full shadow hover:bg-white transition-colors text-slate-700" title="나가기">
                      <Home size={24} />
                  </button>
              </div>
              <div className="pointer-events-auto flex gap-2">
                  <button
                      onClick={handleSaveAll}
                      className="bg-white/90 p-2 rounded-full shadow hover:bg-white transition-colors text-slate-700 flex items-center gap-2 px-4 font-bold"
                      disabled={isSaving}
                  >
                      <Save size={20} /> <span className="hidden sm:inline">{isSaving ? '저장 중...' : '기록 저장'}</span>
                  </button>
              </div>
          </div>

          {/* BOOK CONTAINER */}
          <div
            id="diary-print-area"
            ref={diaryRef}
            className="relative bg-white shadow-[0_30px_60px_-12px_rgba(0,0,0,0.3)] rounded-lg flex transition-all duration-500 ease-in-out w-full h-full sm:w-[98vw] sm:h-[95vh] max-w-[1800px] border border-gray-300"
          >
              {/* --- LEFT PAGE --- */}
              <div className={`flex-1 bg-[#fdfbf7] rounded-l-lg ${showSpring ? 'border-r' : ''} border-gray-200 relative p-4 sm:p-8 lg:p-12 overflow-hidden flex flex-col`}>
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/paper.png')] opacity-40 pointer-events-none"></div>
                  {/* Left Page Shadow Gradient */}
                  {showSpring && <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-gray-300/20 to-transparent pointer-events-none no-print"></div>}
                  
                  {/* Content Container */}
                  <div className="relative z-10 h-full overflow-y-auto custom-scrollbar pr-2">
                      {!isTeacherMode && (
                          <div className="sticky top-0 z-20 flex justify-end gap-2 pb-3 no-print">
                              <button
                                  onClick={handleSavePdf}
                                  disabled={isSavingPdf}
                                  className="h-12 px-4 rounded-full bg-white/90 text-slate-700 font-bold shadow hover:bg-white transition-colors"
                              >
                                  {isSavingPdf ? '저장 중...' : 'PDF 저장'}
                              </button>
                              <button
                                  onClick={handlePrint}
                                  className="h-12 px-4 rounded-full bg-white/90 text-slate-700 font-bold shadow hover:bg-white transition-colors"
                              >
                                  인쇄
                              </button>
                          </div>
                      )}
                      <LeftPageContent 
                        tab={activeTab} 
                        currentDate={currentDate} 
                        studentId={studentId} 
                        refreshKey={refreshKey} 
                        onRefresh={refresh} 
                        onDateChange={handleDateChange} 
                        isTeacherMode={isTeacherMode} 
                        onRegisterSave={registerSaveHandler}
                        roster={roster}
                        rosterLoading={rosterLoading}
                        onRosterUpdate={(id, field, value) => setRoster(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))}
                        onRosterDownloadPdf={handleRosterDownloadPdf}
                        onRosterDownloadExcel={handleRosterDownloadExcel}
                        contactInfo={contactInfo}
                        onContactChange={(id, field, value) => setContactInfo(prev => ({ ...prev, [id]: { ...(prev[id] ?? { phone: '', motherPhone: '', fatherPhone: '', address: '' }), [field]: value } }))}
                        counselLogs={counselLogs}
                        exportDateFrom={exportDateFrom}
                        exportDateTo={exportDateTo}
                        exportItems={exportItems}
                        onExportDateFromChange={setExportDateFrom}
                        onExportDateToChange={setExportDateTo}
                        onExportItemsChange={setExportItems}
                      />
                  </div>
              </div>

              {/* --- SPIRAL BINDING (Conditional) --- */}
              {showSpring && (
                  <div className="w-10 sm:w-14 relative z-20 flex flex-col justify-center items-center bg-[#2c3e50]/5 -ml-5 -mr-5 shrink-0 pointer-events-none no-print">
                      <div className="h-full flex flex-col justify-evenly w-full items-center py-4">
                          {Array.from({ length: 15 }).map((_, i) => (
                              <div key={i} className="w-full h-8 relative flex items-center justify-center">
                                  {/* The Ring */}
                                  <div className="w-[140%] h-4 bg-gradient-to-b from-gray-300 via-white to-gray-400 rounded-full shadow-md transform -rotate-3 border border-gray-400"></div>
                                  {/* Shadow on paper */}
                                  <div className="absolute w-[90%] h-2 bg-black/10 blur-sm top-4 rounded-full"></div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              {/* --- RIGHT PAGE --- */}
              <div className={`flex-1 bg-[#fdfbf7] rounded-r-lg ${showSpring ? 'border-l' : ''} border-gray-200 relative p-4 sm:p-8 lg:p-12 overflow-hidden flex flex-col`}>
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/paper.png')] opacity-40 pointer-events-none"></div>
                  {/* Right Page Shadow Gradient */}
                  {showSpring && <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-gray-300/20 to-transparent pointer-events-none no-print"></div>}

                  {/* Content Container */}
                  <div className="relative z-10 h-full overflow-y-auto custom-scrollbar pl-2">
                      {!isTeacherMode && (
                          <div className="sticky top-0 z-20 flex justify-end gap-2 pb-3 no-print">
                              <button
                                  onClick={handleSavePdf}
                                  disabled={isSavingPdf}
                                  className="h-12 px-4 rounded-full bg-white/90 text-slate-700 font-bold shadow hover:bg-white transition-colors"
                              >
                                  {isSavingPdf ? '저장 중...' : 'PDF 저장'}
                              </button>
                              <button
                                  onClick={handlePrint}
                                  className="h-12 px-4 rounded-full bg-white/90 text-slate-700 font-bold shadow hover:bg-white transition-colors"
                              >
                                  인쇄
                              </button>
                          </div>
                      )}
                      {/* Teacher Components */}
                      {isTeacherMode && activeTab === 'yearly' && <ThreeSetSection isTeacherMode={true} />}
                      {isTeacherMode && activeTab === 'monthly' && <MonthlyRight studentId={studentId} currentDate={currentDate} onRefresh={refresh} onRegisterSave={registerSaveHandler} />}
                      {isTeacherMode && activeTab === 'daily' && <DailyRight currentDate={currentDate} studentId={studentId} onRefresh={refresh} isTeacherMode={true} onRegisterSave={registerSaveHandler} />}
                      {isTeacherMode && activeTab === 'roster' && <RosterRight roster={roster} onRegisterSave={registerSaveHandler} />}
                      {isTeacherMode && activeTab === 'contact' && <ContactRight roster={roster} contactInfo={contactInfo} onContactChange={(id, field, value) => setContactInfo(prev => ({ ...prev, [id]: { ...(prev[id] ?? { phone: '', motherPhone: '', fatherPhone: '', address: '' }), [field]: value } }))} onRegisterSave={registerSaveHandler} />}
                      {isTeacherMode && activeTab === 'counsel' && <CounselRight roster={roster} counselLogs={counselLogs} setCounselLogs={setCounselLogs} onRegisterSave={registerSaveHandler} />}
                      {isTeacherMode && activeTab === 'log' && <LogRight currentDate={currentDate} studentId={studentId} onRefresh={refresh} onRegisterSave={registerSaveHandler} />}
                      {isTeacherMode && activeTab === 'export' && (
                        <ExportRight
                          roster={roster}
                          contactInfo={contactInfo}
                          counselLogs={counselLogs}
                          exportDateFrom={exportDateFrom}
                          exportDateTo={exportDateTo}
                          exportItems={exportItems}
                          onPrint={handlePrint}
                        />
                      )}

                      {/* Student Components */}
                      {!isTeacherMode && activeTab === 'yearly' && (
                        <>
                          <ThreeSetSection isTeacherMode={false} />
                          <StudentYearlyRight studentId={studentId} currentDate={currentDate} onRefresh={refresh} onRegisterSave={registerSaveHandler} />
                        </>
                      )}
                      {!isTeacherMode && activeTab === 'monthly' && <StudentMonthlyRight studentId={studentId} currentDate={currentDate} onRefresh={refresh} onRegisterSave={registerSaveHandler} />}
                      {!isTeacherMode && activeTab === 'weekly' && <StudentWeeklyRight studentId={studentId} currentDate={currentDate} onRefresh={refresh} onRegisterSave={registerSaveHandler} />}
                      {!isTeacherMode && activeTab === 'daily' && <DailyRight currentDate={currentDate} studentId={studentId} onRefresh={refresh} isTeacherMode={false} onRegisterSave={registerSaveHandler} />}
                  </div>
              </div>

              {/* --- TABS (Right Side) --- */}
              <div className="absolute top-12 right-6 translate-x-full flex flex-col gap-3 no-print z-50">
                  {TABS.map((t) => (
                      <button
                          key={t.id}
                          onClick={() => setActiveTab(t.id as TabSection)}
                          className={`
                              ${t.color} text-white w-14 h-16 sm:w-16 sm:h-20 rounded-r-xl shadow-md flex flex-col items-center justify-center transition-all duration-300
                              ${activeTab === t.id ? 'translate-x-0 w-18 sm:w-24 font-bold shadow-lg brightness-110' : '-translate-x-2 hover:translate-x-0 opacity-90'}
                          `}
                          style={{ clipPath: 'polygon(0 0, 100% 10%, 100% 90%, 0 100%)', marginTop: '-8px' }}
                      >
                          <t.icon size={24} className="mb-1" />
                          <span className="text-xs font-hand writing-vertical-lr">{t.label}</span>
                      </button>
                  ))}
              </div>
          </div>
      </div>
  );
};

// --- SUB-COMPONENTS FOR PAGES ---

const PageHeader = ({ title, subTitle, actions }: { title: string, subTitle?: string, actions?: React.ReactNode }) => (
    <div className="border-b-2 border-stone-800 pb-4 mb-6 flex justify-between items-end">
        <div>
            <h2 className="text-3xl font-black text-stone-800 font-serif">{title}</h2>
            {subTitle && <p className="text-stone-500 text-base font-mono mt-1">{subTitle}</p>}
        </div>
        <div className="flex gap-2 no-print">{actions}</div>
    </div>
);

// --- LEFT PAGES ---

export type CounselLogItem = { id: string; studentId: string; date: string; type: string; content: string };

const LeftPageContent = (props: any) => {
    const { tab, currentDate, studentId, refreshKey, onRefresh, onDateChange, isTeacherMode, onRegisterSave, roster, rosterLoading, onRosterUpdate, onRosterDownloadPdf, onRosterDownloadExcel, contactInfo = {}, onContactChange, counselLogs = [], exportDateFrom = '', exportDateTo = '', exportItems = {}, onExportDateFromChange, onExportDateToChange, onExportItemsChange } = props;
    type DailyLessonRow = {
        period: number;
        subject: string;
        content: string;
        materials: string;
        note: string;
    };

    // YEARLY LEFT (Teacher)
    if (tab === 'yearly' && isTeacherMode) {
        return (
            <div className="h-full flex flex-col justify-center items-center text-center p-8 border-4 border-double border-stone-200 rounded-2xl bg-white">
                <h3 className="text-3xl font-black text-stone-700 mb-4">3종세트</h3>
                <p className="text-stone-500 mb-8 font-serif leading-relaxed">
                    연간계획표, 진도표, 시수표를<br/>
                    올리고 바로 볼 수 있어요.
                </p>
                <div className="bg-stone-50 p-6 rounded-xl border border-stone-200 mb-6">
                    <Grid size={48} className="text-rose-400 mx-auto mb-2" />
                    <p className="text-sm text-stone-600 font-bold">오른쪽에서 탭을 선택한 뒤<br/>파일을 올려주세요.</p>
                </div>
            </div>
        );
    }

    // YEARLY LEFT (Student)
    if (tab === 'yearly' && !isTeacherMode) {
        const year = currentDate.getFullYear();
        return (
            <div className="h-full flex flex-col justify-center items-center text-center p-8 border-4 border-double border-stone-200 rounded-2xl bg-white">
                <h3 className="text-3xl font-black text-stone-700 mb-4">{year}년 나의 다짐</h3>
                <div className="bg-yellow-50 p-6 rounded-xl border border-yellow-200 mb-6 w-full h-64 shadow-inner">
                    <textarea 
                        className="w-full h-full bg-transparent resize-none outline-none text-stone-700 text-lg font-hand leading-relaxed text-center"
                        placeholder="올해 나의 목표나 다짐을 적어보세요!"
                    />
                </div>
                <p className="text-stone-500 text-sm">오른쪽 페이지에서 월별 주요 일정을 계획하세요.</p>
            </div>
        );
    }

    // MONTHLY LEFT (Shared)
    if (tab === 'monthly') {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startDay = new Date(year, month, 1).getDay();
        
        const gridCells = [];
        for(let i=0; i<startDay; i++) gridCells.push(null);
        for(let i=1; i<=daysInMonth; i++) gridCells.push(new Date(year, month, i));

        return (
            <div className="h-full flex flex-col">
                <PageHeader 
                    title={`${month + 1}월`} 
                    subTitle={`${year}`}
                    actions={
                        <div className="flex gap-2">
                            <button onClick={() => onDateChange(-1)}><ChevronLeft/></button>
                            <button onClick={() => onDateChange(1)}><ChevronRight/></button>
                        </div>
                    } 
                />
                <div className="grid grid-cols-7 border-t-2 border-stone-800 mb-2">
                    {['일','월','화','수','목','금','토'].map((d,i) => (
                        <div key={d} className={`text-center font-bold py-3 ${i===0?'text-red-500':i===6?'text-blue-500':'text-stone-600'}`}>{d}</div>
                    ))}
                </div>
                <div className="flex-1 grid grid-cols-7 grid-rows-5 border-l border-t border-stone-200 h-full">
                    {gridCells.map((date, idx) => {
                        if (!date) return <div key={idx} className="border-r border-b border-stone-200 bg-stone-50/30"></div>;
                        const dateStr = date.toISOString().split('T')[0];
                        const items = scheduleService.getSchedulesByDate(studentId, dateStr);
                        // Filter generic items for small view
                        const displayItems = items.filter(i => i.type === 'schedule' || i.type === 'goal');
                        
                        return (
                            <div key={idx} className="border-r border-b border-stone-200 p-2 relative group hover:bg-stone-50 transition-colors min-h-[100px] flex flex-col">
                                <span className={`text-sm font-bold ${date.getDay()===0?'text-red-500':date.getDay()===6?'text-blue-500':'text-stone-800'}`}>{date.getDate()}</span>
                                <div className="mt-1 space-y-1 flex-1">
                                    {displayItems.slice(0, 3).map(item => (
                                        <div key={item.id} className="text-[10px] bg-amber-100 px-1 py-0.5 rounded truncate leading-tight text-amber-900 border border-amber-200">
                                            {item.content}
                                        </div>
                                    ))}
                                    {displayItems.length > 3 && <div className="text-[10px] text-gray-400 text-center">...</div>}
                                </div>
                                <button 
                                    onClick={() => {
                                        const todo = prompt(`${date.getDate()}일 일정 추가:`);
                                        if(todo) {
                                            scheduleService.addSchedule(studentId, dateStr, 'schedule', todo);
                                            onRefresh();
                                        }
                                    }}
                                    className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 text-stone-400 no-print"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    // WEEKLY LEFT (Student Only)
    if (tab === 'weekly' && !isTeacherMode) {
        // Calculate start of week (Sunday)
        const day = currentDate.getDay();
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - day);
        
        // End of week
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        const rangeStr = `${startOfWeek.getMonth()+1}.${startOfWeek.getDate()} - ${endOfWeek.getMonth()+1}.${endOfWeek.getDate()}`;

        return (
            <div className="h-full flex flex-col justify-center items-center text-center p-8 bg-blue-50/30 rounded-2xl border-2 border-blue-100">
                <CalendarRange size={64} className="text-blue-300 mb-4" />
                <h3 className="text-3xl font-black text-blue-900 mb-2">Weekly Plan</h3>
                <p className="text-blue-600 mb-4 font-serif text-xl">{rangeStr}</p>
                <div className="flex gap-2 mb-8">
                    <button onClick={() => onDateChange(-1)}><ChevronLeft/></button>
                    <button onClick={() => onDateChange(1)}><ChevronRight/></button>
                </div>
                <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm w-full">
                    <h4 className="font-bold text-gray-700 mb-2">이번 주 목표</h4>
                    <textarea 
                        className="w-full h-32 bg-transparent resize-none outline-none text-stone-600 text-lg leading-relaxed border-b border-blue-100" 
                        placeholder="이번 주는 어떤 목표를 이룰까요?"
                        // Logic to save weekly goal would go here (omitted for brevity)
                    />
                </div>
            </div>
        );
    }

    // DAILY LEFT (Shared)
    if (tab === 'daily') {
        const dateStr = currentDate.toISOString().split('T')[0];
        const all = scheduleService.getAllSchedules();
        const dailyItems = all.filter(i => i.studentId === studentId && i.date === dateStr);
        const prep = dailyItems.find(i => i.type === 'handbook_prep')?.content || '';
        const weather = dailyItems.find(i => i.type === 'handbook_weather')?.content || 'sun';
        const tableContent = dailyItems.find(i => i.type === 'handbook_daily_table')?.content || '';

        const defaultRows: DailyLessonRow[] = Array.from({ length: 6 }, (_, i) => ({
            period: i + 1,
            subject: '',
            content: '',
            materials: '',
            note: '',
        }));

        const [localPrep, setLocalPrep] = useState(prep);
        const [lessonRows, setLessonRows] = useState<DailyLessonRow[]>(defaultRows);

        useEffect(() => {
            setLocalPrep(prep);
            if (!tableContent) {
                setLessonRows(defaultRows);
                return;
            }
            try {
                const parsed = JSON.parse(tableContent) as DailyLessonRow[];
                const normalized = defaultRows.map((row, idx) => ({
                    ...row,
                    ...(parsed?.[idx] || {}),
                    period: idx + 1,
                }));
                setLessonRows(normalized);
            } catch {
                setLessonRows(defaultRows);
            }
        }, [prep, tableContent, refreshKey, dateStr, studentId]);

        const handleUpdateRow = (index: number, field: keyof DailyLessonRow, value: string) => {
            setLessonRows((prev) =>
                prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
            );
        };

        const handleSaveDaily = () => {
            scheduleService.clearDateSchedules(studentId, dateStr, 'handbook_daily_table');
            scheduleService.addSchedule(studentId, dateStr, 'handbook_daily_table', JSON.stringify(lessonRows));
            scheduleService.clearDateSchedules(studentId, dateStr, 'handbook_prep');
            scheduleService.addSchedule(studentId, dateStr, 'handbook_prep', localPrep);
            onRefresh();
        };

        useEffect(() => {
            if (!onRegisterSave) return;
            return onRegisterSave('daily-left', handleSaveDaily);
        }, [onRegisterSave, handleSaveDaily]);

        return (
            <div className="h-full flex flex-col">
                <PageHeader 
                    title={dateStr} 
                    subTitle="Daily Log"
                    actions={
                        <div className="flex items-center gap-2">
                            <button onClick={() => onDateChange(-1)}><ChevronLeft/></button>
                            <button onClick={() => onDateChange(1)}><ChevronRight/></button>
                        </div>
                    } 
                />

                {isTeacherMode && (
                    <p className="text-xs text-stone-500 mb-4">
                        1년 단위 자료는 자동 삭제되지만, 자료는 PDF로 다운받아 보관할 수 있어요.
                    </p>
                )}
                
                <div className="flex justify-end mb-6 gap-2">
                    {['sun', 'cloud', 'rain', 'snow'].map(w => (
                        <button 
                            key={w}
                            onClick={() => {
                                scheduleService.clearDateSchedules(studentId, dateStr, 'handbook_weather');
                                scheduleService.addSchedule(studentId, dateStr, 'handbook_weather', w);
                                onRefresh();
                            }}
                            className={`p-2 rounded-full border-2 transition-all ${weather === w ? 'bg-amber-100 border-amber-400 text-amber-600 scale-110' : 'bg-white border-stone-200 text-stone-300'}`}
                        >
                            {w==='sun' ? <Sun size={20}/> : w==='cloud' ? <Cloud size={20}/> : w==='rain' ? <CloudRain size={20}/> : <Snowflake size={20}/>}
                        </button>
                    ))}
                </div>

                {isTeacherMode ? (
                    <div className="border-4 border-stone-700 rounded-xl overflow-hidden mb-8 shadow-sm">
                        <div className="grid grid-cols-5 bg-stone-100 border-b-2 border-stone-700 font-bold text-center py-3 text-base">
                            {['교시', '과목', '내용', '준비물', '비고'].map(h => <div key={h}>{h}</div>)}
                        </div>
                        {lessonRows.map((row, index) => (
                            <div key={row.period} className="grid grid-cols-5 border-b border-stone-300 text-base min-h-[3rem]">
                                <div className="flex items-center justify-center font-bold bg-stone-50 border-r border-stone-300 text-lg">{row.period}</div>
                                <input
                                    className="bg-transparent text-center focus:bg-amber-50 outline-none border-r border-stone-200 px-2"
                                    value={row.subject}
                                    onChange={(e) => handleUpdateRow(index, 'subject', e.currentTarget.value)}
                                />
                                <input
                                    className="bg-transparent text-center focus:bg-amber-50 outline-none border-r border-stone-200 px-2"
                                    value={row.content}
                                    onChange={(e) => handleUpdateRow(index, 'content', e.currentTarget.value)}
                                />
                                <input
                                    className="bg-transparent text-center focus:bg-amber-50 outline-none border-r border-stone-200 px-2"
                                    value={row.materials}
                                    onChange={(e) => handleUpdateRow(index, 'materials', e.currentTarget.value)}
                                />
                                <input
                                    className="bg-transparent text-center focus:bg-amber-50 outline-none px-2"
                                    value={row.note}
                                    onChange={(e) => handleUpdateRow(index, 'note', e.currentTarget.value)}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="mb-8 p-4 bg-white border-2 border-stone-200 rounded-xl shadow-sm h-64 flex flex-col">
                        <h3 className="font-bold text-stone-700 mb-2 border-b pb-2">오늘의 감사일기 / 배움일기</h3>
                        <textarea 
                            className="flex-1 resize-none outline-none text-stone-600 leading-relaxed bg-transparent"
                            placeholder="오늘 감사했던 일이나 배운 점을 기록해보세요."
                        />
                    </div>
                )}

                <div className="flex-1 flex flex-col">
                    <h3 className="font-bold text-stone-700 mb-2 flex items-center gap-2 border-b-2 border-stone-400 pb-2 text-lg">
                        <CheckCircle2 size={24}/> {isTeacherMode ? '수업 준비 및 체크' : '준비물 및 숙제 체크'}
                    </h3>
                    <div className="flex-1 relative">
                        <textarea 
                            className="w-full h-full bg-[url('https://www.transparenttextures.com/patterns/notebook.png')] leading-9 resize-none outline-none text-stone-700 bg-transparent text-xl p-2"
                            placeholder={isTeacherMode ? "- 학습지 인쇄..." : "- 수학익힘책 가져오기..."}
                            value={localPrep}
                            onChange={(e) => setLocalPrep(e.currentTarget.value)}
                        />
                    </div>
                </div>
            </div>
        )
    }

    // CONTACT LEFT (Teacher) — 왼쪽 페이지: 이름, 학생, 모, 부
    if (tab === 'contact' && isTeacherMode) {
        return (
            <div className="h-full flex flex-col">
                <PageHeader title="주소록" subTitle="학생 · 모 · 부 연락처" />
                <div className="overflow-y-auto border border-indigo-200 rounded-lg flex-1 min-h-0">
                    <table className="w-full text-sm">
                        <thead className="bg-indigo-50 sticky top-0">
                            <tr>
                                <th className="p-2 border-b border-indigo-200 w-20">이름</th>
                                <th className="p-2 border-b border-indigo-200">학생</th>
                                <th className="p-2 border-b border-indigo-200">모</th>
                                <th className="p-2 border-b border-indigo-200">부</th>
                            </tr>
                        </thead>
                        <tbody>
                            {roster.map(s => (
                                <tr key={s.id} className="border-b border-indigo-100 hover:bg-indigo-50/30">
                                    <td className="p-2 font-bold text-stone-800">{s.name}</td>
                                    <td className="p-2">
                                        <input className="w-full bg-transparent outline-none text-center border-b border-transparent hover:border-indigo-200 focus:border-indigo-400 rounded px-1 py-0.5" placeholder="학생 연락처" value={contactInfo[s.id]?.phone ?? ''} onChange={e => onContactChange?.(s.id, 'phone', e.target.value)} />
                                    </td>
                                    <td className="p-2">
                                        <input className="w-full bg-transparent outline-none text-center border-b border-transparent hover:border-indigo-200 focus:border-indigo-400 rounded px-1 py-0.5" placeholder="모 연락처" value={contactInfo[s.id]?.motherPhone ?? ''} onChange={e => onContactChange?.(s.id, 'motherPhone', e.target.value)} />
                                    </td>
                                    <td className="p-2">
                                        <input className="w-full bg-transparent outline-none text-center border-b border-transparent hover:border-indigo-200 focus:border-indigo-400 rounded px-1 py-0.5" placeholder="부 연락처" value={contactInfo[s.id]?.fatherPhone ?? ''} onChange={e => onContactChange?.(s.id, 'fatherPhone', e.target.value)} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    // COUNSEL LEFT (Teacher) — 상담/관찰 기록 목록
    if (tab === 'counsel' && isTeacherMode) {
        const getName = (id: string) => roster.find(s => s.id === id)?.name ?? '-';
        return (
            <div className="h-full flex flex-col min-h-0">
                <PageHeader title="상담/관찰 기록" subTitle={`총 ${counselLogs.length}건`} />
                <div className="flex-1 overflow-y-auto border border-teal-200 rounded-lg bg-white/80 min-h-0">
                    {counselLogs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-stone-500 py-12 px-4">
                            <MessageCircle size={40} className="mb-3 opacity-50" />
                            <p className="text-sm font-medium">기록이 없습니다.</p>
                            <p className="text-xs mt-1">오른쪽 페이지에서 상담/관찰을 기록해주세요.</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-teal-100 p-2">
                            {counselLogs.map((log) => (
                                <li key={log.id} className="py-3 px-2 hover:bg-teal-50/50 rounded-lg transition-colors">
                                    <div className="flex flex-wrap gap-1.5 mb-1">
                                        <span className="font-bold text-stone-800">{getName(log.studentId)}</span>
                                        <span className="text-xs text-stone-500">{log.date}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded ${log.type === '상담' ? 'bg-blue-100 text-blue-700' : log.type === '관찰' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}`}>{log.type}</span>
                                    </div>
                                    <p className="text-sm text-stone-600 line-clamp-2 whitespace-pre-wrap">{log.content}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        );
    }

    // EXPORT LEFT (Teacher) — 날짜·항목 선택
    if (tab === 'export' && isTeacherMode) {
        const items = [
            { id: 'roster', label: '명부' },
            { id: 'contact', label: '주소록' },
            { id: 'counsel', label: '상담/관찰' },
            { id: 'log', label: '기록' },
        ];
        return (
            <div className="h-full flex flex-col min-h-0">
                <PageHeader title="기록저장인쇄" subTitle="날짜별 · 항목별 다운로드" />
                <div className="space-y-6">
                    <div>
                        <p className="text-sm font-bold text-stone-600 mb-2">날짜 범위</p>
                        <div className="flex flex-wrap items-center gap-2">
                            <input type="date" value={exportDateFrom} onChange={e => onExportDateFromChange?.(e.target.value)} className="border border-stone-300 rounded-lg px-3 py-2 font-mono text-sm" />
                            <span className="text-stone-500">~</span>
                            <input type="date" value={exportDateTo} onChange={e => onExportDateToChange?.(e.target.value)} className="border border-stone-300 rounded-lg px-3 py-2 font-mono text-sm" />
                        </div>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-stone-600 mb-2">항목 선택</p>
                        <div className="flex flex-col gap-2">
                            {items.map(({ id, label }) => (
                                <label key={id} className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={!!exportItems[id]} onChange={e => onExportItemsChange?.({ ...exportItems, [id]: e.target.checked })} className="w-4 h-4 accent-slate-600 rounded" />
                                    <span className="text-sm font-medium text-stone-700">{label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // OTHER TABS (Teacher Only)
    if (['roster', 'contact', 'log', 'counsel'].includes(tab) && isTeacherMode) {
        if (tab === 'roster') {
            return (
                <div className="h-full flex flex-col min-h-0">
                    <PageHeader
                        title="학급 명렬표"
                        subTitle={`총 ${roster.length}명`}
                        actions={
                            <div className="flex gap-2 no-print">
                                <button type="button" onClick={onRosterDownloadPdf} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-sm">
                                    <FileText size={16} /> PDF
                                </button>
                                <button type="button" onClick={onRosterDownloadExcel} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-sm">
                                    <Download size={16} /> 엑셀
                                </button>
                            </div>
                        }
                    />
                    <div className="overflow-x-auto overflow-y-auto border border-stone-300 rounded-lg flex-1 min-h-0">
                        <table className="w-full text-base min-w-max">
                            <thead className="bg-stone-100">
                                <tr>
                                    <th className="p-2 border-b whitespace-nowrap">No</th>
                                    <th className="p-2 border-b text-left whitespace-nowrap">이름</th>
                                    <th className="p-2 border-b whitespace-nowrap">성별</th>
                                    <th className="p-2 border-b whitespace-nowrap">생년월일</th>
                                    <th className="p-2 border-b whitespace-nowrap">이전학년반</th>
                                    <th className="p-2 border-b whitespace-nowrap">형제자매</th>
                                    <th className="p-2 border-b whitespace-nowrap">비고</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rosterLoading && (
                                    <tr>
                                        <td colSpan={7} className="p-4 text-center text-stone-400">불러오는 중...</td>
                                    </tr>
                                )}
                                {!rosterLoading && roster.map(s => (
                                    <tr key={s.id} className="border-b last:border-b-0 hover:bg-amber-50">
                                        <td className="p-2 text-center font-mono text-stone-500 font-bold">{s.number}</td>
                                        <td className="p-2 font-bold">{s.name}</td>
                                        <td className="p-2 text-center text-stone-600">
                                            {s.gender === 'male' ? '남' : s.gender === 'female' ? '여' : '-'}
                                        </td>
                                        <td className="p-2 text-stone-600">{s.birthDate ?? '-'}</td>
                                        <td className="p-2 text-stone-600">{s.previousGradeClass ?? '-'}</td>
                                        <td className="p-2">
                                            <input
                                                className="w-full min-w-[80px] max-w-[140px] bg-transparent outline-none border-b border-transparent hover:border-stone-300 focus:border-amber-500 rounded px-1 py-0.5 text-sm text-stone-700"
                                                placeholder="형제자매"
                                                value={s.siblings ?? ''}
                                                onChange={e => onRosterUpdate?.(s.id, 'siblings', e.target.value)}
                                            />
                                        </td>
                                        <td className="p-2">
                                            <input
                                                className="w-full min-w-[80px] max-w-[180px] bg-transparent outline-none border-b border-transparent hover:border-stone-300 focus:border-amber-500 rounded px-1 py-0.5 text-sm text-stone-700"
                                                placeholder="비고"
                                                value={s.remarks ?? ''}
                                                onChange={e => onRosterUpdate?.(s.id, 'remarks', e.target.value)}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        }
    }

    return null;
};

// --- RIGHT PAGE COMPONENTS ---

const HANDBOOK_FILE_CONFIG: { type: handbookFileService.HandbookFileType; label: string }[] = [
  { type: 'academic_schedule_1', label: '학사일정 1학기' },
  { type: 'academic_schedule_2', label: '학사일정 2학기' },
  { type: 'annual_timetable', label: '연간시간표' },
  { type: 'class_hour_1', label: '시수표 1학기' },
  { type: 'class_hour_2', label: '시수표 2학기' },
  { type: 'progress_chart', label: '진도표' },
];

// 3종세트: 연간계획표, 진도표, 시수표 — 파일 올리면 바로 보기
type ThreeSetSubTab = 'annual' | 'progress' | 'classhour';
const THREE_SET_TABS: { id: ThreeSetSubTab; label: string; types: handbookFileService.HandbookFileType[] }[] = [
  { id: 'annual', label: '연간계획표', types: ['annual_timetable'] },
  { id: 'progress', label: '진도표', types: ['progress_chart'] },
  { id: 'classhour', label: '시수표', types: ['class_hour_1', 'class_hour_2'] },
];
const THREE_SET_TYPE_LABELS: Partial<Record<handbookFileService.HandbookFileType, string>> = {
  annual_timetable: '연간계획표',
  progress_chart: '진도표',
  class_hour_1: '시수표 1학기',
  class_hour_2: '시수표 2학기',
};

const ThreeSetSection = ({ isTeacherMode }: { isTeacherMode: boolean }) => {
  const [files, setFiles] = useState<handbookFileService.HandbookFilesData>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<handbookFileService.HandbookFileType | null>(null);
  const [subTab, setSubTab] = useState<ThreeSetSubTab>('annual');

  const load = async () => {
    setLoading(true);
    const data = await handbookFileService.getHandbookFilesAsync();
    setFiles(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleUpload = async (type: handbookFileService.HandbookFileType, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(type);
    try {
      await handbookFileService.uploadHandbookFile(type, file);
      await load();
    } catch (err: unknown) {
      alert((err as Error)?.message || '업로드에 실패했습니다.');
    } finally {
      setUploading(null);
      e.target.value = '';
    }
  };

  const handleDelete = async (type: handbookFileService.HandbookFileType) => {
    if (!confirm('등록된 파일을 삭제할까요?')) return;
    try {
      await handbookFileService.deleteHandbookFile(type);
      await load();
    } catch (err: unknown) {
      alert((err as Error)?.message || '삭제에 실패했습니다.');
    }
  };

  const currentConfig = THREE_SET_TABS.find(t => t.id === subTab)!;

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      <div className="flex gap-2 mb-4 shrink-0">
        {THREE_SET_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`px-4 py-2.5 rounded-xl font-bold border-2 transition-colors ${
              subTab === t.id ? 'bg-rose-100 border-rose-400 text-rose-800' : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-stone-500">로딩 중...</div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-auto">
          {currentConfig.types.map((type) => {
            const item = files[type];
            const label = THREE_SET_TYPE_LABELS[type] ?? type;
            return (
              <div key={type} className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm flex flex-col min-h-0">
                <div className="p-3 bg-stone-50 border-b border-stone-200 flex items-center justify-between shrink-0">
                  <span className="font-bold text-stone-700">{label}</span>
                  {item?.fileUrl ? (
                    <div className="flex items-center gap-2">
                      <a href={item.fileUrl} download className="p-2 rounded-lg bg-stone-200 text-stone-700 hover:bg-stone-300">
                        <Download size={18} />
                      </a>
                      {isTeacherMode && (
                        <button onClick={() => handleDelete(type)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  ) : isTeacherMode ? (
                    <label className="flex items-center gap-2 px-3 py-2 bg-rose-100 text-rose-800 rounded-lg font-bold text-sm cursor-pointer hover:bg-rose-200">
                      <Upload size={18} /> {uploading === type ? '업로드 중...' : '파일 올리기'}
                      <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => handleUpload(type, e)} disabled={!!uploading} />
                    </label>
                  ) : (
                    <span className="text-sm text-stone-400">등록된 파일 없음</span>
                  )}
                </div>
                {item?.fileUrl ? (
                  <div className="flex-1 min-h-[280px] p-3 bg-stone-50 flex items-center justify-center">
                    {item.fileType === 'pdf' ? (
                      <iframe src={item.fileUrl} className="w-full flex-1 min-h-[300px] rounded-lg border border-stone-200" title={label} />
                    ) : (
                      <img src={item.fileUrl} alt="" className="max-w-full max-h-[60vh] object-contain rounded-lg" />
                    )}
                  </div>
                ) : (
                  <div className="flex-1 min-h-[200px] flex items-center justify-center p-6 bg-stone-50/50">
                    {isTeacherMode ? (
                      <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed border-stone-300 rounded-xl cursor-pointer hover:bg-stone-50 text-stone-500">
                        <Upload size={32} />
                        <span className="text-sm font-medium">클릭해서 파일 올리기 (PDF 또는 이미지)</span>
                        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => handleUpload(type, e)} disabled={!!uploading} />
                      </label>
                    ) : (
                      <p className="text-stone-400 text-sm">등록된 파일이 없습니다.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const HandbookFileSection = ({ isTeacherMode }: { isTeacherMode: boolean }) => {
  const [files, setFiles] = useState<handbookFileService.HandbookFilesData>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<handbookFileService.HandbookFileType | null>(null);
  const [viewFile, setViewFile] = useState<{ type: handbookFileService.HandbookFileType; item: handbookFileService.HandbookFileItem } | null>(null);

  const load = async () => {
    setLoading(true);
    const data = await handbookFileService.getHandbookFilesAsync();
    setFiles(data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleUpload = async (type: handbookFileService.HandbookFileType, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(type);
    try {
      await handbookFileService.uploadHandbookFile(type, file);
      await load();
    } catch (err: any) {
      alert(err?.message || '업로드에 실패했습니다.');
    } finally {
      setUploading(null);
      e.target.value = '';
    }
  };

  const handleDelete = async (type: handbookFileService.HandbookFileType) => {
    if (!confirm('등록된 파일을 삭제할까요?')) return;
    try {
      await handbookFileService.deleteHandbookFile(type);
      await load();
      setViewFile(null);
    } catch (err: any) {
      alert(err?.message || '삭제에 실패했습니다.');
    }
  };

  return (
    <div className="mb-6">
      <h3 className="text-lg font-bold text-stone-700 mb-3 flex items-center gap-2"><FileText size={20}/> 교무 문서 {isTeacherMode ? '파일' : ''}</h3>
      {loading ? (
        <div className="text-stone-500 text-sm py-4">로딩 중...</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {HANDBOOK_FILE_CONFIG.map(({ type, label }) => {
            const item = files[type];
            return (
              <div key={type} className="bg-white border border-stone-200 rounded-xl p-3 shadow-sm">
                <div className="text-xs font-bold text-stone-600 mb-2">{label}</div>
                {item?.fileUrl ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setViewFile({ type, item })}
                      className="flex-1 min-w-0 flex items-center justify-center gap-1 px-2 py-2 bg-rose-50 text-rose-700 rounded-lg text-xs font-bold hover:bg-rose-100"
                    >
                      <Eye size={14}/> 보기
                    </button>
                    <a href={item.fileUrl} download className="flex items-center justify-center gap-1 px-2 py-2 bg-stone-100 text-stone-700 rounded-lg text-xs font-bold hover:bg-stone-200">
                      <Download size={14}/>
                    </a>
                    {isTeacherMode && (
                      <button onClick={() => handleDelete(type)} className="px-2 py-2 text-red-500 hover:bg-red-50 rounded-lg text-xs">
                        <Trash2 size={14}/>
                      </button>
                    )}
                  </div>
                ) : isTeacherMode ? (
                  <label className="flex items-center justify-center gap-1 px-3 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-xs font-bold text-stone-600 cursor-pointer">
                    <Upload size={14}/> {uploading === type ? '업로드 중...' : '파일 올리기'}
                    <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => handleUpload(type, e)} disabled={!!uploading} />
                  </label>
                ) : (
                  <div className="text-xs text-stone-400 py-2">등록된 파일 없음</div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {viewFile && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4" onClick={() => setViewFile(null)}>
          <div className="bg-white max-w-4xl max-h-[90vh] w-full rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-3 bg-stone-100 flex justify-between items-center">
              <span className="font-bold text-stone-800">{HANDBOOK_FILE_CONFIG.find(c => c.type === viewFile.type)?.label}</span>
              <button onClick={() => setViewFile(null)} className="p-2 hover:bg-stone-200 rounded-lg"><X size={20}/></button>
            </div>
            <div className="p-4 bg-stone-50 min-h-[60vh] flex items-center justify-center">
              {viewFile.item.fileType === 'pdf' ? (
                <iframe src={viewFile.item.fileUrl} className="w-full h-[70vh] rounded-lg" title="PDF 뷰어" />
              ) : (
                <img src={viewFile.item.fileUrl} alt="" className="max-w-full max-h-[75vh] object-contain rounded-lg" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const TeacherYearlyRight = ({ onRegisterSave, isTeacherMode }: { onRegisterSave?: (key: string, handler: () => void) => () => void; isTeacherMode?: boolean }) => {
    const [semester, setSemester] = useState<1 | 2>(1);
    const [isFullEdit, setIsFullEdit] = useState(false);
    
    const [weeksData, setWeeksData] = useState<AcademicWeek[]>([]);

    useEffect(() => {
        const stored = localStorage.getItem(`edu_academic_calendar_${semester}`);
        if(stored) {
            setWeeksData(JSON.parse(stored));
        } else {
            const init: AcademicWeek[] = Array.from({length: 22}).map((_, i) => ({
                weekNum: i + 1,
                periodStr: '',
                daysCount: 0,
                schedule: Array(5).fill(null).map(() => Array(6).fill('')), 
                remarks: ''
            }));
            setWeeksData(init);
        }
    }, [semester]);

    const handleSave = (newData: AcademicWeek[]) => {
        setWeeksData(newData);
        localStorage.setItem(`edu_academic_calendar_${semester}`, JSON.stringify(newData));
    };

    const handleQuickSave = () => {
        localStorage.setItem(`edu_academic_calendar_${semester}`, JSON.stringify(weeksData));
    };

    useEffect(() => {
        if (!onRegisterSave) return;
        return onRegisterSave('yearly-teacher', handleQuickSave);
    }, [onRegisterSave, handleQuickSave]);

    return (
        <div className="h-full flex flex-col p-4 overflow-y-auto">
            <HandbookFileSection isTeacherMode={isTeacherMode ?? true} />
            <div className="text-center space-y-6 mt-4">
                <h2 className="text-2xl font-bold text-stone-700">{semester}학기 학사일정 및 시수표</h2>
                <div className="flex justify-center gap-4">
                    <button onClick={() => setSemester(1)} className={`px-6 py-2 rounded-xl font-bold border-2 ${semester===1 ? 'bg-rose-100 border-rose-400 text-rose-800' : 'bg-white border-stone-200 text-stone-500'}`}>1학기</button>
                    <button onClick={() => setSemester(2)} className={`px-6 py-2 rounded-xl font-bold border-2 ${semester===2 ? 'bg-rose-100 border-rose-400 text-rose-800' : 'bg-white border-stone-200 text-stone-500'}`}>2학기</button>
                </div>
                
                <button 
                    onClick={() => setIsFullEdit(true)}
                    className="bg-stone-800 text-white px-10 py-5 rounded-2xl shadow-lg hover:bg-black transition-transform hover:scale-105 font-bold text-xl flex items-center gap-3 mx-auto"
                >
                    <Maximize2 size={24}/> 전체화면으로 편집/보기
                </button>
                <p className="text-stone-500 text-sm">총 22주의 상세 일정을 입력하고 출력할 수 있습니다.</p>
            </div>

            {isFullEdit && (
                <AcademicCalendarEditor 
                    semester={semester} 
                    data={weeksData} 
                    onClose={() => setIsFullEdit(false)} 
                    onSave={handleSave} 
                />
            )}
        </div>
    )
}

const StudentYearlyRight = ({ studentId, currentDate, onRefresh, onRegisterSave }: any) => {
    const year = currentDate.getFullYear();
    const dateStr = `${year}-01-01`;
    const [monthlyNotes, setMonthlyNotes] = useState<string[]>(Array(12).fill(''));

    useEffect(() => {
        const all = scheduleService.getAllSchedules();
        const stored = all.find(i => i.studentId === studentId && i.date === dateStr && i.type === 'handbook_yearly');
        if (stored?.content) {
            try {
                const parsed = JSON.parse(stored.content) as string[];
                const normalized = Array.from({ length: 12 }).map((_, idx) => parsed?.[idx] || '');
                setMonthlyNotes(normalized);
                return;
            } catch {
                setMonthlyNotes(Array(12).fill(''));
                return;
            }
        }
        setMonthlyNotes(Array(12).fill(''));
    }, [studentId, dateStr]);

    const handleSave = () => {
        scheduleService.clearDateSchedules(studentId, dateStr, 'handbook_yearly');
        scheduleService.addSchedule(studentId, dateStr, 'handbook_yearly', JSON.stringify(monthlyNotes));
        onRefresh();
    };

    useEffect(() => {
        if (!onRegisterSave) return;
        return onRegisterSave('yearly-student', handleSave);
    }, [onRegisterSave, handleSave]);

    return (
        <div className="h-full flex flex-col p-2">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-2xl text-stone-800 border-b-4 border-rose-400 inline-block px-2 w-fit">월별 주요 일정</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto pr-2">
                {Array.from({length: 12}).map((_, i) => {
                    const m = i + 1;
                    return (
                        <div key={m} className="bg-white border border-stone-200 rounded-xl p-3 shadow-sm h-32 flex flex-col">
                            <span className="font-bold text-rose-500 mb-1">{m}월</span>
                            <textarea
                                className="flex-1 w-full resize-none outline-none text-sm bg-transparent"
                                placeholder="일정 입력..."
                                value={monthlyNotes[i] || ''}
                                onChange={(e) => {
                                    const next = [...monthlyNotes];
                                    next[i] = e.currentTarget.value;
                                    setMonthlyNotes(next);
                                }}
                            />
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

const MonthlyRight = ({ studentId, currentDate, onRefresh, onRegisterSave }: any) => {
    const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01`;
    const [goal, setGoal] = useState('');
    const [memo, setMemo] = useState('');

    useEffect(() => {
        const all = scheduleService.getAllSchedules();
        const items = all.filter(i => i.studentId === studentId && i.date === monthKey);
        setGoal(items.find(i => i.type === 'monthly_goal')?.content || '');
        setMemo(items.find(i => i.type === 'remember')?.content || '');
    }, [studentId, monthKey]);

    const handleSave = () => {
        scheduleService.clearDateSchedules(studentId, monthKey, 'monthly_goal');
        scheduleService.clearDateSchedules(studentId, monthKey, 'remember');
        scheduleService.addSchedule(studentId, monthKey, 'monthly_goal', goal);
        scheduleService.addSchedule(studentId, monthKey, 'remember', memo);
        onRefresh();
    };

    useEffect(() => {
        if (!onRegisterSave) return;
        return onRegisterSave('monthly-teacher', handleSave);
    }, [onRegisterSave, handleSave]);

    return (
        <div className="h-full flex flex-col p-2">
            <div className="mb-10">
                <h3 className="font-bold text-2xl text-stone-800 mb-4 border-b-4 border-amber-400 inline-block px-2">이달의 목표</h3>
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-6 shadow-sm h-40">
                    <textarea
                        className="w-full h-full bg-transparent resize-none outline-none text-stone-700 leading-relaxed text-xl font-hand"
                        placeholder="1. 학급 규칙 잘 지키기&#13;2. 독서 마라톤 완주하기"
                        value={goal}
                        onChange={(e) => setGoal(e.currentTarget.value)}
                    />
                </div>
            </div>
            <div className="flex-1 flex flex-col">
                <h3 className="font-bold text-2xl text-stone-800 mb-4 border-b-4 border-sky-400 inline-block px-2">주요 메모</h3>
                <div className="bg-white border-2 border-stone-200 rounded-2xl p-0 shadow-sm flex-1 overflow-hidden flex flex-col">
                    <textarea
                        className="flex-1 w-full h-full p-6 bg-[url('https://www.transparenttextures.com/patterns/lined-paper.png')] leading-10 resize-none outline-none text-stone-700 text-xl"
                        placeholder="자유롭게 메모하세요..."
                        value={memo}
                        onChange={(e) => setMemo(e.currentTarget.value)}
                    />
                </div>
            </div>
        </div>
    )
}

const StudentMonthlyRight = ({ studentId, currentDate, onRefresh, onRegisterSave }: any) => {
    const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01`;
    const [goal, setGoal] = useState('');
    const [memo, setMemo] = useState('');

    useEffect(() => {
        const all = scheduleService.getAllSchedules();
        const items = all.filter(i => i.studentId === studentId && i.date === monthKey);
        setGoal(items.find(i => i.type === 'monthly_goal')?.content || '');
        setMemo(items.find(i => i.type === 'remember')?.content || '');
    }, [studentId, monthKey]);

    const handleSave = () => {
        scheduleService.clearDateSchedules(studentId, monthKey, 'monthly_goal');
        scheduleService.clearDateSchedules(studentId, monthKey, 'remember');
        scheduleService.addSchedule(studentId, monthKey, 'monthly_goal', goal);
        scheduleService.addSchedule(studentId, monthKey, 'remember', memo);
        onRefresh();
    };

    useEffect(() => {
        if (!onRegisterSave) return;
        return onRegisterSave('monthly-student', handleSave);
    }, [onRegisterSave, handleSave]);

    return (
        <div className="h-full flex flex-col p-2">
            <div className="mb-10">
                <h3 className="font-bold text-2xl text-stone-800 mb-4 border-b-4 border-amber-400 inline-block px-2">나의 이달의 목표</h3>
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-6 shadow-sm h-40">
                    <textarea
                        className="w-full h-full bg-transparent resize-none outline-none text-stone-700 leading-relaxed text-xl font-hand"
                        placeholder="이번 달에는 무엇을 도전해볼까요?"
                        value={goal}
                        onChange={(e) => setGoal(e.currentTarget.value)}
                    />
                </div>
            </div>
            <div className="flex-1 flex flex-col">
                <h3 className="font-bold text-2xl text-stone-800 mb-4 border-b-4 border-sky-400 inline-block px-2">꼭 기억할 것</h3>
                <div className="bg-white border-2 border-stone-200 rounded-2xl p-0 shadow-sm flex-1 overflow-hidden flex flex-col">
                    <textarea
                        className="flex-1 w-full h-full p-6 bg-[url('https://www.transparenttextures.com/patterns/lined-paper.png')] leading-10 resize-none outline-none text-stone-700 text-xl"
                        placeholder="준비물, 생일, 수행평가 등..."
                        value={memo}
                        onChange={(e) => setMemo(e.currentTarget.value)}
                    />
                </div>
            </div>
        </div>
    )
}

const StudentWeeklyRight = ({ studentId, currentDate, onRefresh, onRegisterSave }: any) => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(currentDate.getDate() - day);
    const weekKey = startOfWeek.toISOString().split('T')[0];

    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const [plans, setPlans] = useState<string[]>(Array(7).fill(''));

    useEffect(() => {
        const all = scheduleService.getAllSchedules();
        const item = all.find(i => i.studentId === studentId && i.date === weekKey && i.type === 'weekly_plan');
        if (item?.content) {
            try {
                const parsed = JSON.parse(item.content) as string[];
                const normalized = Array.from({ length: 7 }).map((_, idx) => parsed?.[idx] || '');
                setPlans(normalized);
                return;
            } catch {
                setPlans(Array(7).fill(''));
                return;
            }
        }
        setPlans(Array(7).fill(''));
    }, [studentId, weekKey]);

    const handleSave = () => {
        scheduleService.clearDateSchedules(studentId, weekKey, 'weekly_plan');
        scheduleService.addSchedule(studentId, weekKey, 'weekly_plan', JSON.stringify(plans));
        onRefresh();
    };

    useEffect(() => {
        if (!onRegisterSave) return;
        return onRegisterSave('weekly-student', handleSave);
    }, [onRegisterSave, handleSave]);

    return (
        <div className="h-full flex flex-col p-2">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-2xl text-stone-800 border-b-4 border-blue-400 inline-block px-2 w-fit">주간 계획표</h3>
            </div>
            <div className="flex-1 grid grid-rows-7 gap-2 overflow-y-auto">
                {days.map((d, i) => {
                    const date = new Date(startOfWeek);
                    date.setDate(startOfWeek.getDate() + i);
                    
                    return (
                        <div key={d} className="flex bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
                            <div className={`w-16 flex flex-col items-center justify-center font-bold text-lg border-r ${i===0?'bg-red-50 text-red-500':i===6?'bg-blue-50 text-blue-500':'bg-stone-50 text-stone-600'}`}>
                                <span>{d}</span>
                                <span className="text-xs opacity-70">{date.getDate()}</span>
                            </div>
                            <textarea
                                className="flex-1 p-3 resize-none outline-none text-stone-700"
                                placeholder="계획 입력..."
                                value={plans[i] || ''}
                                onChange={(e) => {
                                    const next = [...plans];
                                    next[i] = e.currentTarget.value;
                                    setPlans(next);
                                }}
                            />
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

const DailyRight = ({ currentDate, studentId, onRefresh, isTeacherMode, onRegisterSave }: { currentDate: Date, studentId: string, onRefresh: () => void, isTeacherMode: boolean, onRegisterSave?: (key: string, handler: () => void) => () => void }) => {
    const dateStr = currentDate.toISOString().split('T')[0];
    const all = scheduleService.getAllSchedules();
    const todos = all.filter(i => i.studentId === studentId && i.date === dateStr && (i.type === 'schedule' || i.type === 'goal'));
    const memo = all.find(i => i.studentId === studentId && i.date === dateStr && i.type === 'handbook_memo')?.content || '';

    // Update local state before saving to LS
    const [localMemo, setLocalMemo] = useState(memo);
    useEffect(() => { setLocalMemo(memo); }, [memo]);

    const handleSaveMemo = () => {
        scheduleService.clearDateSchedules(studentId, dateStr, 'handbook_memo');
        scheduleService.addSchedule(studentId, dateStr, 'handbook_memo', localMemo);
        onRefresh();
    };

    useEffect(() => {
        if (!onRegisterSave) return;
        return onRegisterSave('daily-right', handleSaveMemo);
    }, [onRegisterSave, handleSaveMemo]);

    return (
        <div className="h-full flex flex-col p-2">
            <div className="mb-8">
                <h3 className="font-bold text-stone-700 mb-3 flex items-center gap-2 text-xl">
                    <ListTodo size={24}/> {isTeacherMode ? 'To-Do List' : '오늘의 할 일'}
                </h3>
                <div className="bg-white border-2 border-stone-200 rounded-2xl p-6 min-h-[250px] shadow-sm">
                    <div className="space-y-3">
                        {todos.map(todo => (
                            <div key={todo.id} className="flex items-center gap-3 group">
                                <button onClick={() => { scheduleService.toggleScheduleComplete(todo.id); onRefresh(); }}>
                                    {todo.isCompleted ? <CheckSquare size={22} className="text-stone-400"/> : <div className="w-6 h-6 border-2 border-stone-400 rounded cursor-pointer hover:border-stone-600"></div>}
                                </button>
                                <span className={`flex-1 border-b border-dashed border-stone-200 pb-1 text-lg ${todo.isCompleted ? 'line-through text-stone-400' : 'text-stone-700'}`}>{todo.content}</span>
                                <button onClick={() => { scheduleService.deleteSchedule(todo.id); onRefresh(); }} className="opacity-0 group-hover:opacity-100 text-red-400 no-print"><X size={18}/></button>
                            </div>
                        ))}
                        <div className="flex items-center gap-3 mt-4 no-print">
                            <Plus size={24} className="text-stone-400" />
                            <input 
                                className="flex-1 bg-transparent border-b-2 border-stone-300 focus:border-amber-500 outline-none text-lg py-1"
                                placeholder={isTeacherMode ? "할 일 추가..." : "숙제나 할 일을 적어보세요..."}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        scheduleService.addSchedule(studentId, dateStr, 'goal', e.currentTarget.value);
                                        e.currentTarget.value = '';
                                        onRefresh();
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-stone-700 flex items-center gap-2 text-xl">
                        <Edit3 size={24}/> {isTeacherMode ? 'Idea / Memo' : '나의 메모장'}
                    </h3>
                </div>
                <div className="flex-1 bg-yellow-50/50 border-2 border-yellow-200 rounded-2xl p-6 shadow-inner relative">
                    <textarea 
                        className="w-full h-full bg-transparent resize-none outline-none text-stone-700 leading-9 text-lg"
                        placeholder={isTeacherMode ? "메모를 남기세요..." : "오늘 있었던 재미있는 일을 적어보세요!"}
                        value={localMemo}
                        onChange={(e) => setLocalMemo(e.target.value)}
                        onBlur={() => {
                            // Auto-save on blur as well
                            scheduleService.clearDateSchedules(studentId, dateStr, 'handbook_memo');
                            scheduleService.addSchedule(studentId, dateStr, 'handbook_memo', localMemo);
                        }}
                    />
                </div>
            </div>
        </div>
    )
}

export type RosterChecklistData = { cols: string[]; checks: Record<string, Record<number, boolean>> };

const RosterRight = ({ roster, onRegisterSave }: { roster: ClassStudent[]; onRegisterSave?: (key: string, handler: () => void | Promise<void>) => () => void }) => {
    const [cols, setCols] = useState(['과제제출', '가정통신문', '준비물', '우유']);
    const [checks, setChecks] = useState<Record<string, Record<number, boolean>>>({});
    const [checklistLoading, setChecklistLoading] = useState(true);
    const stateRef = useRef({ cols, checks });
    stateRef.current = { cols, checks };

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const fromLocal = (): RosterChecklistData | null => {
                const savedChecks = localStorage.getItem('edu_roster_checks');
                const savedCols = localStorage.getItem('edu_roster_cols');
                if (!savedCols) return null;
                try {
                    const c = savedChecks ? JSON.parse(savedChecks) as Record<string, Record<string, boolean>> : {};
                    const checksNum: Record<string, Record<number, boolean>> = {};
                    Object.keys(c).forEach((studentId) => {
                        checksNum[studentId] = {};
                        Object.keys(c[studentId]).forEach((k) => {
                            checksNum[studentId][Number(k)] = c[studentId][k];
                        });
                    });
                    return { cols: JSON.parse(savedCols), checks: checksNum };
                } catch {
                    return null;
                }
            };
            if (supabase) {
                try {
                    const profile = await getCurrentUserProfile();
                    const classId = profile?.class_id;
                    if (classId) {
                        const { data } = await supabase.from('classes').select('roster_checklist_data').eq('id', classId).maybeSingle();
                        const raw = data?.roster_checklist_data as { cols?: string[]; checks?: Record<string, Record<string, boolean>> } | null;
                        if (!cancelled && raw?.cols && Array.isArray(raw.cols)) {
                            const checksNum: Record<string, Record<number, boolean>> = {};
                            if (raw.checks && typeof raw.checks === 'object') {
                                Object.keys(raw.checks).forEach((studentId) => {
                                    const row = raw.checks![studentId];
                                    if (!row || typeof row !== 'object') return;
                                    checksNum[studentId] = {};
                                    Object.keys(row).forEach((k) => {
                                        checksNum[studentId][Number(k)] = !!row[k];
                                    });
                                });
                            }
                            setCols(raw.cols);
                            setChecks(checksNum);
                            setChecklistLoading(false);
                            return;
                        }
                    }
                } catch {
                    // fallback to local
                }
            }
            const local = fromLocal();
            if (!cancelled) {
                if (local) {
                    setCols(local.cols);
                    setChecks(local.checks);
                }
                setChecklistLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, []);

    const handleSave = useCallback(async () => {
        const { cols: c, checks: ch } = stateRef.current;
        localStorage.setItem('edu_roster_checks', JSON.stringify(ch));
        localStorage.setItem('edu_roster_cols', JSON.stringify(c));
        if (supabase) {
            try {
                const profile = await getCurrentUserProfile();
                const classId = profile?.class_id;
                if (classId) {
                    await supabase.from('classes').update({ roster_checklist_data: { cols: c, checks: ch } }).eq('id', classId);
                }
            } catch (e) {
                console.warn('[RosterRight] Supabase save failed', e);
            }
        }
    }, []);

    useEffect(() => {
        if (!onRegisterSave) return;
        return onRegisterSave('roster-checklist', handleSave);
    }, [onRegisterSave, handleSave]);

    const handleCheck = (studentId: string, colIndex: number) => {
        const studentChecks = checks[studentId] || {};
        const newChecks = { ...checks, [studentId]: { ...studentChecks, [colIndex]: !studentChecks[colIndex] } };
        setChecks(newChecks);
    };
    
    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-6 border-b-2 border-stone-300 pb-3">
                <h3 className="font-bold text-stone-800 text-2xl">체크리스트</h3>
                <div className="flex gap-2 no-print">
                    {checklistLoading && <span className="text-sm text-stone-500">불러오는 중...</span>}
                    <button onClick={() => setCols([...cols, '새항목'])} className="text-sm bg-stone-200 px-3 py-1.5 rounded hover:bg-stone-300 font-bold">+ 열 추가</button>
                </div>
            </div>
            <div className="overflow-x-auto overflow-y-auto border-2 border-stone-300 rounded-xl bg-white h-full shadow-sm min-h-0">
                <table className="w-full text-base min-w-max">
                    <thead className="bg-stone-100">
                        <tr>
                            <th className="p-3 border-b border-r w-24 sticky left-0 bg-stone-100 z-10 text-stone-600 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">이름</th>
                            {cols.map((c, i) => (
                                <th key={i} className="p-3 border-b border-r min-w-[80px]">
                                    <input className="w-full bg-transparent text-center font-bold outline-none text-stone-700" value={c} onChange={e=>{
                                        const nc = [...cols]; nc[i]=e.target.value; setCols(nc);
                                    }}/>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {roster.map(s => (
                            <tr key={s.id} className="border-b last:border-b-0 hover:bg-amber-50 group">
                                <td className="p-3 border-r font-bold text-center sticky left-0 bg-white group-hover:bg-amber-50 text-stone-800 z-[1] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">{s.name}</td>
                                {cols.map((_, i) => (
                                    <td key={i} className="p-0 border-r text-center align-middle">
                                        <div className="flex justify-center items-center h-full">
                                            <input 
                                                type="checkbox" 
                                                className="w-5 h-5 accent-blue-600 cursor-pointer"
                                                checked={checks[s.id]?.[i] || false}
                                                onChange={() => handleCheck(s.id, i)}
                                            />
                                        </div>
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

const ContactRight = ({
    roster,
    contactInfo,
    onContactChange,
    onRegisterSave,
}: {
    roster: ClassStudent[];
    contactInfo: Record<string, ContactInfoItem>;
    onContactChange: (id: string, field: keyof ContactInfoItem, value: string) => void;
    onRegisterSave?: (key: string, handler: () => void) => () => void;
}) => {
    const stateRef = useRef(contactInfo);
    stateRef.current = contactInfo;

    const handleSave = useCallback(() => {
        localStorage.setItem('edu_contact_info', JSON.stringify(stateRef.current));
    }, []);

    useEffect(() => {
        if (!onRegisterSave) return;
        return onRegisterSave('contact', handleSave);
    }, [onRegisterSave, handleSave]);

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-stone-800 text-xl flex items-center gap-2"><Phone size={20}/> 주소록 · 주소</h3>
            </div>
            <div className="overflow-auto border-2 border-indigo-200 rounded-xl bg-white h-full shadow-sm">
                <table className="w-full text-sm">
                    <thead className="bg-indigo-50">
                        <tr>
                            <th className="p-3 border-b border-indigo-200 w-24">이름</th>
                            <th className="p-3 border-b border-indigo-200">주소</th>
                        </tr>
                    </thead>
                    <tbody>
                        {roster.map(s => (
                            <tr key={s.id} className="border-b hover:bg-indigo-50/30">
                                <td className="p-2 border-r text-center font-bold">{s.name}</td>
                                <td className="p-2">
                                    <input
                                        className="w-full bg-transparent outline-none border-b border-transparent hover:border-indigo-200 focus:border-indigo-400 rounded px-2 py-1 min-w-[180px]"
                                        placeholder="주소를 입력하세요"
                                        value={contactInfo[s.id]?.address ?? ''}
                                        onChange={e => onContactChange(s.id, 'address', e.target.value)}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const CounselRight = ({
    roster,
    counselLogs,
    setCounselLogs,
    onRegisterSave,
}: {
    roster: ClassStudent[];
    counselLogs: CounselLogItem[];
    setCounselLogs: React.Dispatch<React.SetStateAction<CounselLogItem[]>>;
    onRegisterSave?: (key: string, handler: () => void) => () => void;
}) => {
    const [selectedStudent, setSelectedStudent] = useState(roster[0]?.id || '');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [type, setType] = useState('상담');
    const [content, setContent] = useState('');
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [pin, setPin] = useState('');
    const [savedPin, setSavedPin] = useState('');

    useEffect(() => {
        const storedPin = localStorage.getItem('edu_counsel_pin') || '';
        setSavedPin(storedPin);
    }, []);

    useEffect(() => {
        if (!selectedStudent && roster.length > 0) {
            setSelectedStudent(roster[0].id);
        }
    }, [roster, selectedStudent]);

    const handleAdd = () => {
        if (!isUnlocked) return;
        if (!content.trim()) return;
        const newLog: CounselLogItem = { id: generateUUID(), studentId: selectedStudent, date, type, content };
        const newLogs = [newLog, ...counselLogs];
        setCounselLogs(newLogs);
        localStorage.setItem('edu_counsel_logs', JSON.stringify(newLogs));
        setContent('');
    };

    const handleDelete = (id: string) => {
        if (!confirm('삭제하시겠습니까?')) return;
        const newLogs = counselLogs.filter(l => l.id !== id);
        setCounselLogs(newLogs);
        localStorage.setItem('edu_counsel_logs', JSON.stringify(newLogs));
    };

    const handleSave = () => {
        localStorage.setItem('edu_counsel_logs', JSON.stringify(counselLogs));
    };

    useEffect(() => {
        if (!onRegisterSave) return;
        return onRegisterSave('counsel', handleSave);
    }, [onRegisterSave, handleSave]);

    const handleUnlock = () => {
        if (pin.length !== 4) return;
        if (!savedPin) {
            localStorage.setItem('edu_counsel_pin', pin);
            setSavedPin(pin);
            setIsUnlocked(true);
            setPin('');
            alert('비밀번호가 설정되었습니다.');
            return;
        }
        if (pin === savedPin) {
            setIsUnlocked(true);
            setPin('');
            return;
        }
        alert('비밀번호가 올바르지 않습니다.');
    };

    const handleLock = () => {
        setIsUnlocked(false);
        setPin('');
    };

    const studentLogs = counselLogs.filter(l => l.studentId === selectedStudent);

    return (
        <div className="h-full flex flex-col p-2">
            <div className="mb-4 flex flex-wrap gap-2 items-center bg-teal-50 p-3 rounded-xl border border-teal-200">
                <select className="p-2 border rounded-lg font-bold" value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}>
                    {roster.map(s => <option key={s.id} value={s.id}>{s.number}. {s.name}</option>)}
                </select>
                <input type="date" className="p-2 border rounded-lg" value={date} onChange={e => setDate(e.target.value)} />
                <select className="p-2 border rounded-lg" value={type} onChange={e => setType(e.target.value)}>
                    <option>상담</option>
                    <option>관찰</option>
                    <option>전화</option>
                </select>
                <div className="ml-auto" />
            </div>

            {!isUnlocked && (
                <div className="mb-4 bg-white border-2 border-teal-200 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <div className="text-sm text-teal-700 font-bold">상담 기록은 비밀번호로 보호됩니다.</div>
                    <div className="flex items-center gap-2">
                        <input
                            type="password"
                            inputMode="numeric"
                            pattern="\d*"
                            maxLength={4}
                            value={pin}
                            onChange={(e) => setPin(e.currentTarget.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="비밀번호 4자리"
                            className="px-3 py-2 border rounded-lg text-sm font-bold tracking-widest"
                        />
                        <button
                            onClick={handleUnlock}
                            className="bg-teal-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-teal-700 text-sm"
                            disabled={pin.length !== 4}
                        >
                            {savedPin ? '열기' : '설정'}
                        </button>
                    </div>
                    <p className="text-xs text-teal-600">숫자 4자리로만 설정해주세요.</p>
                </div>
            )}
            {isUnlocked && (
                <div className="mb-4 flex justify-end">
                    <button onClick={handleLock} className="text-xs font-bold text-teal-700 hover:text-teal-900">
                        잠금
                    </button>
                </div>
            )}
            
            <div className="flex gap-2 mb-6 h-32">
                <textarea 
                    className="flex-1 p-3 border-2 border-teal-200 rounded-xl resize-none focus:ring-2 focus:ring-teal-500 outline-none" 
                    placeholder="내용을 입력하세요..." 
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    disabled={!isUnlocked}
                />
                <button
                    onClick={handleAdd}
                    disabled={!isUnlocked || !content.trim()}
                    className="bg-teal-600 text-white px-6 rounded-xl font-bold hover:bg-teal-700 shadow-md flex flex-col items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Save size={18}/> 기록
                </button>
            </div>

            <div className="flex-1 overflow-auto space-y-3 pr-2">
                {studentLogs.length === 0 && <div className="text-center text-gray-400 py-10">기록이 없습니다.</div>}
                {studentLogs.map(log => (
                    <div key={log.id} className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm relative group">
                        <div className="flex gap-2 mb-1 text-xs font-bold">
                            <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">{log.date}</span>
                            <span className={`px-2 py-0.5 rounded ${log.type === '상담' ? 'bg-blue-100 text-blue-700' : log.type === '관찰' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}`}>{log.type}</span>
                        </div>
                        <p className="text-gray-800 whitespace-pre-wrap">{log.content}</p>
                        <button onClick={() => handleDelete(log.id)} className="absolute top-3 right-3 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={16}/></button>
                    </div>
                ))}
            </div>
        </div>
    )
}

// 기록저장인쇄: 날짜·항목별 PDF/엑셀 다운로드 및 인쇄
const ExportRight = ({
    roster,
    contactInfo,
    counselLogs,
    exportDateFrom,
    exportDateTo,
    exportItems,
    onPrint,
}: {
    roster: ClassStudent[];
    contactInfo: Record<string, ContactInfoItem>;
    counselLogs: CounselLogItem[];
    exportDateFrom: string;
    exportDateTo: string;
    exportItems: Record<string, boolean>;
    onPrint: () => void;
}) => {
    const getName = (id: string) => roster.find(s => s.id === id)?.name ?? '-';

    const handleDownloadPdf = () => {
        const hasRoster = exportItems.roster && roster.length > 0;
        const hasContact = exportItems.contact && Object.keys(contactInfo).length > 0;
        const from = new Date(exportDateFrom);
        const to = new Date(exportDateTo);
        const hasCounsel = exportItems.counsel && counselLogs.some(l => { const d = new Date(l.date); return d >= from && d <= to; });
        const allSchedulesForPdf = scheduleService.getAllSchedules();
        const hasLog = exportItems.log && allSchedulesForPdf.some(i => i.type === 'handbook_log' && i.date >= exportDateFrom && i.date <= exportDateTo);
        if (!hasRoster && !hasContact && !hasCounsel && !hasLog) {
            alert('선택한 항목에 해당 날짜 범위의 데이터가 없습니다.');
            return;
        }
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        let y = 20;
        const line = (text: string, font: 'normal' | 'bold' = 'normal') => {
            doc.setFont(undefined, font);
            doc.text(text, 14, y);
            y += 7;
        };

        if (exportItems.roster && roster.length > 0) {
            doc.setFontSize(14);
            line('■ 명부', 'bold');
            doc.setFontSize(10);
            const rosterHeaders = ['No', '이름', '성별', '생년월일', '이전학년반', '형제자매', '비고'];
            roster.slice(0, 25).forEach((s, i) => {
                line(`${s.number}\t${s.name}\t${s.gender === 'male' ? '남' : s.gender === 'female' ? '여' : '-'}\t${s.birthDate ?? ''}\t${s.previousGradeClass ?? ''}\t${s.siblings ?? ''}\t${s.remarks ?? ''}`);
            });
            if (roster.length > 25) line(`... 외 ${roster.length - 25}명`);
            y += 10;
        }

        if (exportItems.contact && Object.keys(contactInfo).length > 0) {
            if (y > 250) { doc.addPage(); y = 20; }
            doc.setFontSize(14);
            line('■ 주소록', 'bold');
            doc.setFontSize(10);
            Object.entries(contactInfo).slice(0, 20).forEach(([id, info]) => {
                const name = getName(id);
                line(`${name}\t${info.phone}\t${info.motherPhone}\t${info.fatherPhone}\t${info.address}`);
            });
            y += 10;
        }

        if (exportItems.counsel && counselLogs.length > 0) {
            const filtered = counselLogs.filter(l => {
                const d = new Date(l.date);
                return d >= from && d <= to;
            });
            if (filtered.length > 0 && y > 240) { doc.addPage(); y = 20; }
            doc.setFontSize(14);
            line('■ 상담/관찰', 'bold');
            doc.setFontSize(10);
            filtered.slice(0, 15).forEach(l => {
                line(`${l.date}\t${getName(l.studentId)}\t${l.type}`);
                doc.text(l.content.slice(0, 80) + (l.content.length > 80 ? '...' : ''), 14, y);
                y += 10;
            });
            y += 10;
        }

        const logItems = allSchedulesForPdf.filter(i => i.type === 'handbook_log' && i.date >= exportDateFrom && i.date <= exportDateTo);
        if (exportItems.log && logItems.length > 0) {
            if (y > 240) { doc.addPage(); y = 20; }
            doc.setFontSize(14);
            line('■ 기록', 'bold');
            doc.setFontSize(10);
            logItems.slice(0, 15).forEach(item => {
                try {
                    const { title, body } = JSON.parse(item.content) as { title?: string; body?: string };
                    line(`${item.date}\t${title ?? '-'}`);
                    doc.text((body ?? '').slice(0, 80), 14, y);
                    y += 10;
                } catch {
                    line(`${item.date}\t${item.content.slice(0, 40)}`);
                }
            });
        }

        doc.save(`교무수첩_내보내기_${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    const handleDownloadExcel = () => {
        const wb = XLSX.utils.book_new();
        const toSheet = (arr: unknown[][], name: string) => {
            const ws = XLSX.utils.aoa_to_sheet(arr);
            XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
        };

        if (exportItems.roster && roster.length > 0) {
            toSheet(
                [['No', '이름', '성별', '생년월일', '이전학년반', '형제자매', '비고'], ...roster.map(s => [s.number, s.name, s.gender === 'male' ? '남' : s.gender === 'female' ? '여' : '', s.birthDate ?? '', s.previousGradeClass ?? '', s.siblings ?? '', s.remarks ?? ''])],
                '명부'
            );
        }
        if (exportItems.contact && Object.keys(contactInfo).length > 0) {
            toSheet(
                [['이름', '학생연락처', '모', '부', '주소'], ...Object.entries(contactInfo).map(([id, info]) => [getName(id), info.phone, info.motherPhone, info.fatherPhone, info.address])],
                '주소록'
            );
        }
        const from = new Date(exportDateFrom);
        const to = new Date(exportDateTo);
        if (exportItems.counsel && counselLogs.length > 0) {
            const filtered = counselLogs.filter(l => {
                const d = new Date(l.date);
                return d >= from && d <= to;
            });
            toSheet([['날짜', '학생', '유형', '내용'], ...filtered.map(l => [l.date, getName(l.studentId), l.type, l.content])], '상담관찰');
        }
        const allSchedules = scheduleService.getAllSchedules();
        const logItems = allSchedules.filter(i => i.type === 'handbook_log' && i.date >= exportDateFrom && i.date <= exportDateTo);
        if (exportItems.log && logItems.length > 0) {
            const rows: (string | number)[][] = [['날짜', '제목', '내용']];
            logItems.forEach(item => {
                try {
                    const { title, body } = JSON.parse(item.content) as { title?: string; body?: string };
                    rows.push([item.date, title ?? '', body ?? '']);
                } catch {
                    rows.push([item.date, '', item.content]);
                }
            });
            toSheet(rows, '기록');
        }

        if (wb.SheetNames.length === 0) {
            alert('선택한 항목에 내보낼 데이터가 없습니다.');
            return;
        }
        XLSX.writeFile(wb, `교무수첩_내보내기_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    return (
        <div className="h-full flex flex-col justify-center items-center p-6">
            <p className="text-stone-600 text-center mb-8 max-w-sm">선택한 날짜와 항목으로 PDF·엑셀을 다운로드하거나 인쇄할 수 있습니다.</p>
            <div className="flex flex-wrap justify-center gap-4">
                <button type="button" onClick={handleDownloadPdf} className="flex flex-col items-center justify-center gap-2 w-32 h-32 rounded-2xl bg-red-50 hover:bg-red-100 border-2 border-red-200 text-red-800 font-bold shadow-md hover:shadow-lg transition-all">
                    <FileText size={40} />
                    <span>PDF</span>
                    <span className="text-xs font-normal">다운로드</span>
                </button>
                <button type="button" onClick={handleDownloadExcel} className="flex flex-col items-center justify-center gap-2 w-32 h-32 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-200 text-emerald-800 font-bold shadow-md hover:shadow-lg transition-all">
                    <Download size={40} />
                    <span>엑셀</span>
                    <span className="text-xs font-normal">다운로드</span>
                </button>
                <button type="button" onClick={onPrint} className="flex flex-col items-center justify-center gap-2 w-32 h-32 rounded-2xl bg-slate-100 hover:bg-slate-200 border-2 border-slate-300 text-slate-800 font-bold shadow-md hover:shadow-lg transition-all">
                    <Printer size={40} />
                    <span>인쇄</span>
                </button>
            </div>
        </div>
    );
};

const LogRight = ({ currentDate, studentId, onRefresh, onRegisterSave }: { currentDate: Date, studentId: string, onRefresh: () => void, onRegisterSave?: (key: string, handler: () => void) => () => void }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const dateStr = currentDate.toISOString().split('T')[0];

    const handleSave = () => {
        if(!title.trim()) return;
        const payload = JSON.stringify({ title, body: content });
        scheduleService.addSchedule(studentId, dateStr, 'handbook_log', payload);
        setTitle(''); setContent('');
        onRefresh();
    };

    useEffect(() => {
        if (!onRegisterSave) return;
        return onRegisterSave('log', handleSave);
    }, [onRegisterSave, handleSave]);

    return (
        <div className="h-full flex flex-col bg-white p-8 shadow-inner rounded-2xl border border-stone-200">
            <div className="border-b-4 border-stone-800 pb-4 mb-6 flex items-end justify-between gap-4">
                <div className="flex-1">
                    <input 
                        className="w-full text-3xl font-black placeholder-stone-300 outline-none text-stone-800"
                        placeholder="주제 / 제목 입력"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                    />
                    <div className="text-right text-stone-400 text-sm mt-2 font-mono">{dateStr}</div>
                </div>
                <div className="no-print shrink-0" />
            </div>
            <textarea 
                className="flex-1 w-full bg-[url('https://www.transparenttextures.com/patterns/lined-paper.png')] leading-10 resize-none outline-none text-stone-800 text-xl p-2"
                placeholder="회의 내용이나 연수 내용을 기록하세요..."
                value={content}
                onChange={e => setContent(e.target.value)}
            />
            <div className="mt-6 flex justify-end no-print" />
        </div>
    )
}

const AcademicCalendarEditor = ({ semester, data, onClose, onSave }: { semester: number, data: AcademicWeek[], onClose: () => void, onSave: (d: AcademicWeek[]) => void }) => {
    const [localData, setLocalData] = useState<AcademicWeek[]>(data);
    const [selectedBrush, setSelectedBrush] = useState<string>('국'); 

    const handleDataChange = (weekIdx: number, field: keyof AcademicWeek, value: any) => {
        const newData = [...localData];
        newData[weekIdx] = { ...newData[weekIdx], [field]: value };
        setLocalData(newData);
    };

    const handleScheduleClick = (weekIdx: number, dayIdx: number, periodIdx: number) => {
        const newData = [...localData];
        const currentVal = newData[weekIdx].schedule[dayIdx][periodIdx];
        newData[weekIdx].schedule[dayIdx][periodIdx] = (currentVal === selectedBrush && selectedBrush !== '') ? '' : selectedBrush;
        setLocalData(newData);
    };

    const totalDays = localData.reduce((acc, curr) => acc + (parseInt(curr.daysCount.toString()) || 0), 0);

    const getBrushStyle = (code: string) => {
        const subj = SUBJECT_PALETTE.find(s => s.code === code);
        return subj ? subj.color : 'bg-white';
    };

    return (
        <div className="fixed inset-0 bg-white z-[100] flex flex-col overflow-hidden animate-fade-in-up">
            <div className="bg-stone-800 text-white p-4 flex justify-between items-center shadow-md shrink-0 no-print">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold flex items-center gap-2"><Grid size={24}/> {semester}학기 학사일정 편집</h2>
                    <div className="flex flex-wrap items-center bg-stone-700 rounded-lg p-1 gap-2 max-w-[60vw]">
                        {SUBJECT_PALETTE.map(subj => (
                            <button key={subj.name} onClick={() => setSelectedBrush(subj.code)} className={`px-3 py-1 rounded text-sm font-bold border-2 transition-all whitespace-nowrap flex items-center gap-1 ${selectedBrush === subj.code ? 'border-yellow-400 scale-105 z-10 shadow-lg' : 'border-transparent opacity-70 hover:opacity-100'} ${subj.color}`}>
                                {subj.code === '' ? <Eraser size={14}/> : subj.code}
                                <span className="hidden sm:inline">{subj.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 ml-3">
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shrink-0"
                    >
                        <Printer size={18}/> 출력
                    </button>
                    <button
                        type="button"
                        onClick={() => { onSave(localData); onClose(); }}
                        className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shrink-0"
                    >
                        <Save size={18}/> 저장 & 닫기
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="bg-stone-600 hover:bg-stone-500 text-white p-2 rounded-lg shrink-0"
                    >
                        <X size={18}/>
                    </button>
                </div>
            </div>
            <div id="printable-area" className="flex-1 overflow-auto p-2 sm:p-8 bg-stone-100 print:bg-white print:p-0">
                <div className="max-w-[1400px] mx-auto bg-white shadow-xl print:shadow-none p-4 print:p-0">
                    <h1 className="text-center text-3xl font-black mb-4 print:mb-2 print:text-2xl pt-4">{new Date().getFullYear()}학년도 {semester}학기 학사일정 및 시수표</h1>
                    <table className="w-full border-collapse border-2 border-black text-center text-xs sm:text-sm print:text-[10px]">
                        <thead>
                            <tr className="bg-gray-100 print:bg-gray-100 h-10">
                                <th rowSpan={2} className="border border-black w-8">주</th>
                                <th rowSpan={2} className="border border-black w-24">기 간</th>
                                <th rowSpan={2} className="border border-black w-10">수업<br/>일수</th>
                                <th colSpan={6} className="border border-black">월</th>
                                <th colSpan={6} className="border border-black">화</th>
                                <th colSpan={6} className="border border-black">수</th>
                                <th colSpan={6} className="border border-black">목</th>
                                <th colSpan={6} className="border border-black">금</th>
                                <th rowSpan={2} className="border border-black min-w-[100px]">비 고</th>
                            </tr>
                            <tr className="bg-gray-50 print:bg-gray-50 h-6 text-[10px]">
                                {[1,2,3,4,5,6].map(p => <th key={`m${p}`} className="border border-black w-6">{p}</th>)}
                                {[1,2,3,4,5,6].map(p => <th key={`t${p}`} className="border border-black w-6">{p}</th>)}
                                {[1,2,3,4,5,6].map(p => <th key={`w${p}`} className="border border-black w-6">{p}</th>)}
                                {[1,2,3,4,5,6].map(p => <th key={`th${p}`} className="border border-black w-6">{p}</th>)}
                                {[1,2,3,4,5,6].map(p => <th key={`f${p}`} className="border border-black w-6">{p}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {localData.map((week, wIdx) => (
                                <tr key={wIdx} className="h-8 hover:bg-gray-50 print:h-10">
                                    <td className="border border-black font-bold">{week.weekNum}</td>
                                    <td className="border border-black p-0"><input type="text" value={week.periodStr} onChange={(e) => handleDataChange(wIdx, 'periodStr', e.target.value)} className="w-full h-full text-center bg-transparent outline-none font-mono text-[11px] print:text-[9px]" placeholder="MM.DD-MM.DD"/></td>
                                    <td className="border border-black p-0"><input type="number" value={week.daysCount || ''} onChange={(e) => handleDataChange(wIdx, 'daysCount', parseInt(e.target.value))} className="w-full h-full text-center bg-transparent outline-none"/></td>
                                    {week.schedule.map((dayPeriods, dIdx) => (dayPeriods.map((periodVal, pIdx) => { const style = getBrushStyle(periodVal); return (<td key={`${dIdx}-${pIdx}`} className={`border border-gray-400 cursor-pointer hover:opacity-80 transition-colors font-bold text-center p-0 ${style}`} onClick={() => handleScheduleClick(wIdx, dIdx, pIdx)}>{periodVal}</td>)})))}
                                    <td className="border border-black p-0"><textarea value={week.remarks} onChange={(e) => handleDataChange(wIdx, 'remarks', e.target.value)} className="w-full h-full text-left p-1 bg-transparent outline-none resize-none text-[11px] leading-tight print:text-[9px] overflow-hidden" rows={2}/></td>
                                </tr>
                            ))}
                            <tr className="h-8 font-bold bg-gray-100 print:bg-gray-100">
                                <td colSpan={2} className="border border-black">계</td>
                                <td className="border border-black">{totalDays}</td>
                                <td colSpan={31} className="border border-black text-right px-4">작성일: {new Date().toLocaleDateString()}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
