import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Save, Home, Check, Trash2 } from 'lucide-react';
import * as noticeService from '../services/noticeService';

const SECTION_DIVIDER = '\n\n---\n\n';

function parseSections(content: string): [string, string] {
  const idx = content.indexOf(SECTION_DIVIDER);
  if (idx < 0) return [content, ''];
  return [content.slice(0, idx), content.slice(idx + SECTION_DIVIDER.length)];
}

interface NoticeAppProps {
  onBack: () => void;
  isTeacherMode: boolean;
}

export const NoticeApp: React.FC<NoticeAppProps> = ({ onBack, isTeacherMode }) => {
  const [currentDate, setCurrentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [section1, setSection1] = useState('');
  const [section2, setSection2] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const notice = await noticeService.getNoticeAsync(currentDate);
      if (cancelled) return;
      const raw = notice ? notice.content : '';
      const [s1, s2] = parseSections(raw);
      setSection1(s1);
      setSection2(s2);
      setIsSaved(false);
    })();
    return () => { cancelled = true; };
  }, [currentDate]);

  const handleDateChange = (offset: number) => {
    const date = new Date(currentDate);
    date.setDate(date.getDate() + offset);
    setCurrentDate(date.toISOString().split('T')[0]);
  };

  const getCombinedContent = () =>
    section2.trim() ? `${section1}${SECTION_DIVIDER}${section2}` : section1;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await noticeService.saveNoticeAsync(currentDate, getCombinedContent());
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = window.confirm('해당 날짜의 알림장을 삭제할까요?');
    if (!ok) return;
    await noticeService.deleteNoticeAsync(currentDate);
    setSection1('');
    setSection2('');
    setIsSaved(false);
  };

  // Format date for display (e.g., 2023년 10월 27일 금요일)
  const displayDate = new Date(currentDate).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  const textClass = 'bg-transparent border-none resize-none text-xl sm:text-2xl text-white placeholder-white/40 focus:ring-0 leading-loose tracking-wide font-hand w-full h-full';
  const textStyle = { textShadow: '1px 1px 2px rgba(0,0,0,0.5)', lineHeight: '1.8' };
  const emptyMsg = (
    <div className="h-full flex items-center justify-center text-white/40 text-lg sm:text-xl">
      오늘은 알림장이 없어요 😊
    </div>
  );

  return (
    <div className="min-h-screen bg-[#1e293b] flex flex-col items-center p-4 sm:p-6 font-hand overflow-auto">
      {/* 헤더: 칠판 밖 — 제목·날짜·홈 */}
      <div className="w-full max-w-7xl flex items-center justify-between gap-4 mb-4 text-[#f0fdf4]">
        <button
          onClick={onBack}
          className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 bg-red-500 rounded-full shadow-lg flex items-center justify-center border-4 border-red-700 hover:scale-105 transition-transform"
          title="처음으로"
        >
          <Home className="text-white w-6 h-6 sm:w-8 sm:h-8" />
        </button>
        <div className="flex flex-col items-center gap-2 min-w-0 flex-1">
          <h1 className="text-2xl sm:text-4xl font-bold tracking-widest border-b-2 border-white/40 pb-1">
            알림장
          </h1>
          <div className="flex items-center gap-3 sm:gap-6 text-lg sm:text-2xl font-bold">
            <button onClick={() => handleDateChange(-1)} className="p-1 hover:text-yellow-200 transition-colors">
              <ChevronLeft size={28} className="sm:w-9 sm:h-9" />
            </button>
            <span className="min-w-[200px] sm:min-w-[280px] text-center truncate">{displayDate}</span>
            <button onClick={() => handleDateChange(1)} className="p-1 hover:text-yellow-200 transition-colors">
              <ChevronRight size={28} className="sm:w-9 sm:h-9" />
            </button>
          </div>
        </div>
        <div className="w-12 sm:w-14 flex-shrink-0" aria-hidden />
      </div>

      {/* 칠판: 전체를 쓰는 2단락 영역 */}
      <div className="relative w-full max-w-7xl flex-1 min-h-[50vh] sm:min-h-[60vh] bg-[#1a3c28] rounded-3xl border-[14px] sm:border-[16px] border-[#5d4037] shadow-2xl flex flex-col overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] mix-blend-overlay" />
        <div className="absolute inset-0 pointer-events-none opacity-10 bg-gradient-to-br from-white via-transparent to-transparent" />

        {/* 칠판 본문: 좌우 2단락 */}
        <div className="flex-1 flex flex-col sm:flex-row relative z-10 p-4 sm:p-6 gap-4 sm:gap-6 min-h-0">
          <div className="flex-1 min-h-0 flex flex-col border border-white/20 rounded-xl overflow-hidden bg-black/10">
            {isTeacherMode ? (
              <textarea
                value={section1}
                onChange={(e) => { setSection1(e.target.value); setIsSaved(false); }}
                placeholder="1단락: 할 일, 준비물 등을 적어주세요..."
                className={`${textClass} p-4`}
                spellCheck={false}
                style={textStyle}
              />
            ) : (
              <div className="flex-1 p-4 text-white leading-loose font-hand whitespace-pre-wrap overflow-y-auto" style={{ lineHeight: '1.8' }}>
                {section1.trim() ? section1 : emptyMsg}
              </div>
            )}
          </div>
          <div className="flex-1 min-h-0 flex flex-col border border-white/20 rounded-xl overflow-hidden bg-black/10">
            {isTeacherMode ? (
              <textarea
                value={section2}
                onChange={(e) => { setSection2(e.target.value); setIsSaved(false); }}
                placeholder="2단락: 추가 내용을 적어주세요..."
                className={`${textClass} p-4`}
                spellCheck={false}
                style={textStyle}
              />
            ) : (
              <div className="flex-1 p-4 text-white leading-loose font-hand whitespace-pre-wrap overflow-y-auto" style={{ lineHeight: '1.8' }}>
                {section2.trim() ? section2 : emptyMsg}
              </div>
            )}
          </div>
        </div>

        {/* 하단 트레이: 저장·삭제 */}
        <div className="relative z-20 flex-shrink-0 bg-[#5d4037] h-14 sm:h-20 flex items-center justify-center border-t-4 border-[#3e2723] gap-3 px-4">
          <div className="absolute left-4 bottom-3 flex gap-2 pointer-events-none opacity-80">
            <div className="w-16 h-3 bg-white rounded-sm transform rotate-2" />
            <div className="w-10 h-3 bg-yellow-200 rounded-sm transform -rotate-1" />
            <div className="w-6 h-3 bg-red-300 rounded-sm transform rotate-6" />
          </div>
          {isTeacherMode && (
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`h-11 sm:h-12 px-6 rounded-lg shadow-lg font-bold text-lg flex items-center gap-2 transition-all ${
                  isSaved ? 'bg-green-600' : 'bg-blue-900 hover:bg-blue-800'
                } text-white`}
              >
                {isSaved ? <Check size={22} /> : <Save size={22} />}
                {isSaving ? '저장 중...' : isSaved ? '저장 완료' : '저장하기'}
              </button>
              <button
                onClick={handleDelete}
                className="h-11 sm:h-12 px-4 rounded-lg border-2 border-red-300 text-red-600 bg-white hover:bg-red-50 font-bold flex items-center gap-2"
              >
                <Trash2 size={20} /> 삭제
              </button>
            </div>
          )}
          <div className="absolute right-4 bottom-3 w-20 h-3 bg-blue-200 rounded-sm transform -rotate-1 pointer-events-none opacity-80" />
        </div>
      </div>
    </div>
  );
};
