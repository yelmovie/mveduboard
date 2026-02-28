
import React, { useState } from 'react';
import { Home, Dices, Grid, Trophy, Users, Watch, Settings, Briefcase, RefreshCcw, Search } from 'lucide-react';
import { TimerApp } from './TimerApp';
import { DiceApp } from './DiceApp';
import { BingoApp } from './BingoApp';
import { DrawApp } from './DrawApp';
import { SeatApp } from './SeatApp';
import { CareerApp } from './CareerApp';
import { WordSearchApp } from './WordSearchApp';
import { Participant } from '../types';

interface ToolsAppProps {
  onBack: () => void;
  isTeacherMode: boolean;
  student: Participant | null;
  onLoginRequest: () => void;
}

type ToolTab = 'timer' | 'dice' | 'bingo' | 'picker' | 'seat' | 'career' | 'wordsearch';

export const ToolsApp: React.FC<ToolsAppProps> = ({ onBack, isTeacherMode, student, onLoginRequest }) => {
  const [activeTab, setActiveTab] = useState<ToolTab>('timer');

  const TABS: { id: ToolTab; label: string; icon: any }[] = [
    { id: 'timer', label: '타이머', icon: Watch },
    { id: 'dice', label: '주사위', icon: Dices },
    { id: 'bingo', label: '빙고', icon: Grid },
    { id: 'picker', label: '발표뽑기', icon: RefreshCcw },
    { id: 'seat', label: '자리배치', icon: Settings },
    { id: 'career', label: '진로월드컵', icon: Trophy },
    { id: 'wordsearch', label: '단어찾기', icon: Search },
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
                                ? 'bg-[#7DD3FC] text-white shadow-md scale-105 font-bold' 
                                : 'text-[#92400E] hover:bg-[#E0F2FE] hover:text-[#0369A1]'}
                        `}
                    >
                        <tab.icon size={22} />
                        <span className="text-xs font-hand">{tab.label}</span>
                    </button>
                ))}
            </div>
        </div>
      </header>

      <main className="flex-1 relative overflow-y-auto overflow-x-hidden bg-slate-100">
        <div className="min-h-full">
            {activeTab === 'timer' && <TimerApp onBack={onBack} isTeacherMode={isTeacherMode} />}
            {activeTab === 'dice' && <DiceApp onBack={onBack} />}
            {activeTab === 'bingo' && <BingoApp onBack={onBack} isTeacherMode={isTeacherMode} student={student} onLoginRequest={onLoginRequest} />}
            {activeTab === 'picker' && <DrawApp onBack={onBack} isTeacherMode={isTeacherMode} />}
            {activeTab === 'seat' && (
              <SeatApp onBack={onBack} isTeacherMode={isTeacherMode} studentName={student?.nickname} />
            )}
            {activeTab === 'career' && <CareerApp onBack={onBack} />}
            {activeTab === 'wordsearch' && <WordSearchApp onBack={onBack} isTeacherMode={isTeacherMode} student={student} />}
        </div>
      </main>
    </div>
  );
};
