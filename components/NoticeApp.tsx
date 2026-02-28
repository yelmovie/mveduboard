
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Save, Home, Calendar, Check, Trash2 } from 'lucide-react';
import * as noticeService from '../services/noticeService';

interface NoticeAppProps {
  onBack: () => void;
  isTeacherMode: boolean;
}

export const NoticeApp: React.FC<NoticeAppProps> = ({ onBack, isTeacherMode }) => {
  // Date state: YYYY-MM-DD string
  const [currentDate, setCurrentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Load notice when date changes
  useEffect(() => {
    const notice = noticeService.getNotice(currentDate);
    setContent(notice ? notice.content : '');
    setIsSaved(false); // Reset saved state on date change
  }, [currentDate]);

  const handleDateChange = (offset: number) => {
    const date = new Date(currentDate);
    date.setDate(date.getDate() + offset);
    setCurrentDate(date.toISOString().split('T')[0]);
  };

  const handleSave = () => {
    setIsSaving(true);
    // Simulate slight network delay for effect
    setTimeout(() => {
        noticeService.saveNotice(currentDate, content);
        setIsSaving(false);
        setIsSaved(true);
        
        // Reset "Saved" state after 2 seconds
        setTimeout(() => {
            setIsSaved(false);
        }, 2000);
    }, 500);
  };

  const handleDelete = () => {
    const ok = window.confirm('해당 날짜의 알림장을 삭제할까요?');
    if (!ok) return;
    noticeService.deleteNotice(currentDate);
    setContent('');
    setIsSaved(false);
  };

  // Format date for display (e.g., 2023년 10월 27일 금요일)
  const displayDate = new Date(currentDate).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  return (
    <div className="min-h-screen bg-[#1e293b] flex items-center justify-center p-4 sm:p-10 font-hand overflow-hidden select-none">
      
      {/* Blackboard Container */}
      <div className="relative w-full max-w-7xl aspect-[4/5] sm:aspect-[16/10] bg-[#1a3c28] rounded-3xl border-[16px] border-[#5d4037] shadow-2xl flex flex-col overflow-hidden">
        
        {/* Chalk Dust Texture Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] mix-blend-overlay"></div>
        <div className="absolute inset-0 pointer-events-none opacity-10 bg-gradient-to-br from-white via-transparent to-transparent"></div>

        {/* Header (Top Frame) */}
        <div className="relative z-10 flex items-center justify-between p-6 sm:p-8 text-[#f0fdf4]">
            {/* Home Button (Magnet Style) */}
            <button 
                onClick={onBack}
                className="group flex flex-col items-center justify-center transform hover:scale-110 transition-transform"
                title="처음으로"
            >
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-red-500 rounded-full shadow-lg flex items-center justify-center border-4 border-red-700">
                    <Home className="text-white w-8 h-8 sm:w-10 sm:h-10" />
                </div>
            </button>

            {/* Title & Date */}
            <div className="flex flex-col items-center gap-3">
                <h1 className="text-3xl sm:text-5xl opacity-90 tracking-widest border-b-4 border-white/30 pb-2">알림장</h1>
                <div className="flex items-center gap-6 text-2xl sm:text-4xl font-bold bg-black/10 px-6 py-2 rounded-full">
                    <button onClick={() => handleDateChange(-1)} className="hover:text-yellow-200 transition-colors">
                        <ChevronLeft size={36} />
                    </button>
                    <span className="min-w-[280px] text-center">{displayDate}</span>
                    <button onClick={() => handleDateChange(1)} className="hover:text-yellow-200 transition-colors">
                        <ChevronRight size={36} />
                    </button>
                </div>
            </div>

            {/* Spacer for symmetry or extra tool */}
            <div className="w-14 sm:w-16"></div>
        </div>

        {/* Main Blackboard Area */}
        <div className="flex-1 relative p-6 sm:p-12 flex flex-col">
            {isTeacherMode ? (
                <textarea
                    value={content}
                    onChange={(e) => {
                        setContent(e.target.value);
                        setIsSaved(false); // Reset saved state on edit
                    }}
                    placeholder="선생님, 오늘 할 일을 여기에 적어주세요..."
                    className="flex-1 w-full h-full bg-transparent border-none resize-none text-2xl sm:text-4xl text-white placeholder-white/30 focus:ring-0 leading-loose tracking-wide font-hand"
                    spellCheck={false}
                    style={{
                        textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                        lineHeight: '1.8'
                    }}
                />
            ) : (
                <div className="flex-1 w-full h-full text-2xl sm:text-4xl text-white leading-loose tracking-wide font-hand whitespace-pre-wrap overflow-y-auto custom-scrollbar" style={{ lineHeight: '1.8' }}>
                    {content ? content : (
                        <div className="h-full flex items-center justify-center text-white/40">
                            오늘은 알림장이 없어요 😊
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Bottom Tray (Chalk ledge) */}
        <div className="relative z-20 bg-[#5d4037] h-16 sm:h-24 flex items-center justify-center border-t-8 border-[#3e2723] shadow-inner">
             
             {/* Decorations: Chalks */}
             <div className="absolute left-10 bottom-4 flex gap-4 pointer-events-none">
                <div className="w-24 h-4 bg-white rounded-sm transform rotate-3 shadow-md"></div>
                <div className="w-16 h-4 bg-yellow-200 rounded-sm transform -rotate-2 shadow-md"></div>
                <div className="w-8 h-4 bg-red-300 rounded-sm transform rotate-12 shadow-md"></div>
             </div>

             {/* Eraser / Save Button */}
             {isTeacherMode && (
                 <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                     <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className={`
                            group relative w-full sm:w-64 h-12 sm:h-16 rounded-lg shadow-xl transform transition-all flex items-center justify-center border-b-8 active:translate-y-0 active:border-b-0
                            ${isSaved 
                                ? 'bg-green-600 border-green-800 hover:-translate-y-0' 
                                : 'bg-blue-900 border-blue-950 hover:-translate-y-1'}
                        `}
                     >
                        {/* Eraser Felt Texture */}
                        <div className="absolute bottom-0 w-full h-4 bg-gray-800 rounded-b opacity-50"></div>
                        <div className="flex items-center gap-3 text-white font-bold text-xl sm:text-2xl z-10">
                            {isSaved ? <Check size={28} /> : <Save size={28} />}
                            <span>
                                {isSaving ? '저장 중...' : isSaved ? '저장 완료' : '저장하기'}
                            </span>
                        </div>
                     </button>
                     <button
                        onClick={handleDelete}
                        className="w-full sm:w-48 h-12 sm:h-16 rounded-lg border-2 border-red-300 text-red-600 bg-white hover:bg-red-50 shadow-md font-bold text-lg flex items-center justify-center gap-2"
                     >
                        <Trash2 size={20} /> 삭제
                     </button>
                 </div>
             )}

             {/* Right side chalks */}
             <div className="absolute right-10 bottom-4 flex gap-2 pointer-events-none">
                 <div className="w-28 h-4 bg-blue-200 rounded-sm transform -rotate-1 shadow-md"></div>
             </div>
        </div>

      </div>
    </div>
  );
};
