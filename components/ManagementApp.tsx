
import React, { useState } from 'react';
import { Home, Bell, Ticket, MessageSquare, Award, UserCheck, Settings, ClipboardList, ClipboardCheck } from 'lucide-react';
import { NoticeApp } from './NoticeApp';
import { BoardApp } from '../BoardApp';
import { CouponApp } from './CouponApp';
import { MeetingApp } from './MeetingApp';
import { PointApp } from './PointApp';
import { RoleApp } from './RoleApp';
import { SurveyApp } from './SurveyApp';
import { Participant } from '../types';

interface ManagementAppProps {
  onBack: () => void;
  isTeacherMode: boolean;
  student: Participant | null;
  onLoginRequest: () => void;
}

type Tab = 'notice' | 'notice_board' | 'roles' | 'points' | 'coupon' | 'meeting' | 'survey';

export const ManagementApp: React.FC<ManagementAppProps> = ({ onBack, isTeacherMode, student, onLoginRequest }) => {
  const [activeTab, setActiveTab] = useState<Tab>('notice');

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: 'notice', label: '알림장', icon: Bell },
    { id: 'notice_board', label: '공지사항', icon: ClipboardList },
    { id: 'roles', label: '1인1역', icon: UserCheck },
    { id: 'points', label: '학급포인트', icon: Award },
    { id: 'coupon', label: '쿠폰함', icon: Ticket },
    { id: 'meeting', label: '학급회의', icon: MessageSquare },
    { id: 'survey', label: '설문', icon: ClipboardCheck },
  ];

  return (
    <div className="h-screen flex flex-col bg-[#FEF9E7] font-sans overflow-hidden">
      {/* Top Navigation Bar */}
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
                                ? 'bg-[#6EE7B7] text-white shadow-md scale-105 font-bold' 
                                : 'text-[#92400E] hover:bg-[#ECFDF5] hover:text-[#065F46]'}
                        `}
                    >
                        <tab.icon size={22} />
                        <span className="text-xs font-hand">{tab.label}</span>
                    </button>
                ))}
            </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-y-auto overflow-x-hidden bg-[#FEF9E7]">
        <div className="min-h-full">
            {activeTab === 'notice' && <NoticeApp onBack={onBack} isTeacherMode={isTeacherMode} />}
            {activeTab === 'notice_board' && (
              <BoardApp
                boardId="notice_board"
                onBack={onBack}
                isTeacherMode={isTeacherMode}
                student={student}
                onLoginRequest={onLoginRequest}
                embedded={true}
                allowStudentPost={false}
              />
            )}
            {activeTab === 'roles' && <RoleApp onBack={onBack} isTeacherMode={isTeacherMode} />}
            {activeTab === 'points' && <PointApp onBack={onBack} isTeacherMode={isTeacherMode} />}
            {activeTab === 'coupon' && <CouponApp onBack={onBack} isTeacherMode={isTeacherMode} student={student} onLoginRequest={onLoginRequest} />}
            {activeTab === 'meeting' && <MeetingApp onBack={onBack} isTeacherMode={isTeacherMode} student={student} onLoginRequest={onLoginRequest} />}
            {activeTab === 'survey' && <SurveyApp isTeacherMode={isTeacherMode} student={student} />}
        </div>
      </main>
    </div>
  );
};
