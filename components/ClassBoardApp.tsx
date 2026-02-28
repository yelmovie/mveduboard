
import React, { useState } from 'react';
import { Home, ClipboardList, Palette, PenTool, Images, MessageCircle, Mail } from 'lucide-react';
import { BoardApp } from '../BoardApp';
import { MangaApp } from './MangaApp';
import { ChatApp } from './ChatApp';
import { MessageApp } from './MessageApp';
import { Participant } from '../types';

interface ClassBoardAppProps {
  onBack: () => void;
  isTeacherMode: boolean;
  student: Participant | null;
  onLoginRequest: () => void;
}

type Tab = 'board' | 'gallery' | 'album' | 'manga' | 'talk';

export const ClassBoardApp: React.FC<ClassBoardAppProps> = ({ onBack, isTeacherMode, student, onLoginRequest }) => {
  const [activeTab, setActiveTab] = useState<Tab>('board');

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: 'board', label: '자유게시판', icon: ClipboardList },
    { id: 'gallery', label: '작품 갤러리', icon: Palette },
    { id: 'album', label: '우리반 사진첩', icon: Images },
    { id: 'manga', label: '만화그리기', icon: PenTool },
    { id: 'talk', label: '우리교실 톡톡', icon: MessageCircle },
  ];

  return (
    <div className="h-screen flex flex-col bg-[#FEF9E7] font-sans overflow-hidden">
      <header className="bg-white text-[#78350F] shadow-sm z-30 shrink-0 border-b border-[#FCD34D]">
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
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                            flex flex-col items-center justify-center px-6 py-2 rounded-2xl transition-all min-w-[5rem] gap-1
                            ${activeTab === tab.id 
                                ? 'bg-[#FCD34D] text-[#78350F] shadow-md scale-105 font-bold border-2 border-white' 
                                : 'text-[#92400E] hover:bg-[#FFFBEB] hover:text-[#B45309]'}
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
        <div className="h-full w-full relative overflow-y-auto min-h-0 flex flex-col">
            {activeTab === 'board' && <BoardApp boardId="board" onBack={onBack} isTeacherMode={isTeacherMode} student={student} onLoginRequest={onLoginRequest} embedded={true} />}
            {activeTab === 'gallery' && <BoardApp boardId="gallery" onBack={onBack} isTeacherMode={isTeacherMode} student={student} onLoginRequest={onLoginRequest} embedded={true} />}
            {activeTab === 'album' && <BoardApp boardId="album" onBack={onBack} isTeacherMode={isTeacherMode} student={student} onLoginRequest={onLoginRequest} embedded={true} />}
            {activeTab === 'manga' && <MangaApp onBack={onBack} isTeacherMode={isTeacherMode} student={student} onLoginRequest={onLoginRequest} embedded={true} />}
            {activeTab === 'talk' && <ChatApp onBack={() => {}} isTeacherMode={isTeacherMode} student={student} embedded={true} />}
        </div>
      </main>
    </div>
  );
};
