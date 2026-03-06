
import React, { useState, useEffect } from 'react';
import { Home, RefreshCcw, CheckSquare, User, Award, Trophy, Star, Sparkles, Crown } from 'lucide-react';
import * as pointService from '../services/pointService';
import * as studentService from '../services/studentService';
import { PointStudent } from '../types';

interface PointAppProps {
  onBack: () => void;
  isTeacherMode: boolean;
}

export const PointApp: React.FC<PointAppProps> = ({ onBack, isTeacherMode }) => {
  const [students, setStudents] = useState<PointStudent[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [rewardType, setRewardType] = useState<'good' | 'bad'>('good');

  useEffect(() => {
    const init = async () => {
      try {
        await studentService.preloadClassId();
        const fetched = await studentService.fetchRosterFromDb();
        if (fetched.length > 0) {
          studentService.saveRoster(fetched);
        }
      } catch {}
      try { await pointService.loadPointDataAsync(); } catch {}
      loadData();
    };
    init();
  }, [isTeacherMode]);

  const loadData = () => {
    setStudents(pointService.getStudents());
  };

  const handleCardClick = (id: string) => {
    if (!isTeacherMode) return;
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) { newSelected.delete(id); } else { newSelected.add(id); }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === students.length) { setSelectedIds(new Set()); } else { setSelectedIds(new Set(students.map(s => s.id))); }
  };

  const handleOpenReward = (type: 'good' | 'bad') => {
    if (selectedIds.size === 0) { alert('학생을 먼저 선택해주세요!'); return; }
    setRewardType(type);
    setShowRewardModal(true);
  };

  const handleGivePoints = (amount: number, reason: string) => {
    const updated = pointService.updatePoints(Array.from(selectedIds), amount, reason);
    setStudents(updated);
    setShowRewardModal(false);
    setSelectedIds(new Set()); 
  };

  const handleReset = () => {
    if (confirm('모든 점수를 초기화하시겠습니까?')) {
        const updated = pointService.resetPoints();
        setStudents(updated);
    }
  }

  const totalPoints = students.reduce((sum, s) => sum + s.points, 0);

  // Sort: Top 3 highlighter (Visual only, doesn't change roster order)
  const maxScore = Math.max(...students.map(s => s.points));

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col font-sans select-none relative overflow-hidden text-white">
      {/* Mystical Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-indigo-900 via-slate-950 to-black opacity-80 pointer-events-none"></div>
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 animate-pulse pointer-events-none"></div>
      
      {/* Header */}
      <header className="relative z-20 p-4 flex items-center justify-between">
         <div className="flex items-center gap-3">
             <button onClick={onBack} className="bg-white/10 p-3 rounded-full hover:bg-white/20 transition-colors backdrop-blur-md shadow-lg border border-white/10">
                 <Home size={22} className="text-indigo-200" />
             </button>
             <div className="flex flex-col">
                 <span className="text-indigo-400 text-xs font-bold tracking-widest uppercase mb-0.5">Class Rewards</span>
                 <h1 className="font-black text-2xl md:text-3xl text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-amber-500 drop-shadow-[0_2px_10px_rgba(234,179,8,0.5)] flex items-center gap-2">
                    <Crown size={28} className="text-yellow-400 fill-yellow-400" /> 
                    학급 포인트
                 </h1>
             </div>
         </div>
         <div className="flex items-center gap-2">
             {isTeacherMode && (
                 <button onClick={handleReset} className="bg-white/5 border border-white/10 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2">
                     <RefreshCcw size={16} /> 초기화
                 </button>
             )}
         </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full pb-32 overflow-y-auto custom-scrollbar">
          
          {/* Total Score Banner */}
          <div className="bg-gradient-to-r from-violet-600/80 to-indigo-600/80 backdrop-blur-md rounded-3xl p-6 mb-10 shadow-[0_10px_40px_rgba(124,58,237,0.3)] border border-white/10 flex items-center justify-between relative overflow-hidden group">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
              <div className="absolute -right-10 -top-10 bg-yellow-400/20 w-40 h-40 blur-3xl rounded-full group-hover:bg-yellow-400/30 transition-all"></div>
              
              <div className="flex items-center gap-6 relative z-10">
                  <div className="bg-white/10 p-4 rounded-2xl border border-white/20 shadow-inner">
                      <Trophy size={40} className="text-yellow-300 drop-shadow-[0_0_15px_rgba(253,224,71,0.6)]" />
                  </div>
                  <div>
                      <h2 className="text-xl font-bold text-indigo-100 mb-1">우리반 명예의 전당</h2>
                      <p className="text-sm text-indigo-300">모두 함께 목표를 향해 달려가요! 🚀</p>
                  </div>
              </div>
              <div className="text-right relative z-10">
                  <div className="text-sm font-bold text-indigo-300 mb-1">Total Points</div>
                  <div className="text-5xl font-black text-white tracking-tighter drop-shadow-xl flex items-baseline justify-end gap-1">
                      {totalPoints} <span className="text-2xl opacity-60">pts</span>
                  </div>
              </div>
          </div>

          {/* Student Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4 md:gap-6">
              {students.map((student) => {
                  const isSelected = selectedIds.has(student.id);
                  const isTop = student.points > 0 && student.points === maxScore;
                  
                  return (
                      <button 
                        key={student.id}
                        onClick={() => handleCardClick(student.id)}
                        disabled={!isTeacherMode}
                        className={`
                            relative group flex flex-col items-center p-4 rounded-3xl transition-all duration-200
                            ${isSelected 
                                ? 'bg-gradient-to-b from-indigo-500 to-violet-600 shadow-[0_0_25px_rgba(139,92,246,0.6)] scale-105 border-2 border-yellow-300 z-10' 
                                : 'bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 shadow-lg hover:-translate-y-1'}
                        `}
                      >
                          {/* Rank Badge */}
                          {isTop && (
                              <div className="absolute -top-3 -right-2 bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-1 rounded-full shadow-lg border-2 border-slate-900 z-20 flex items-center gap-1">
                                  <Crown size={10} fill="currentColor" /> MVP
                              </div>
                          )}

                          {/* Avatar Container */}
                          <div className={`
                              w-20 h-20 rounded-full flex items-center justify-center text-5xl mb-3 shadow-inner relative overflow-visible transition-transform duration-300
                              ${isSelected ? 'bg-white/20 scale-110' : 'bg-slate-900/50 group-hover:scale-110'}
                          `}>
                              <div className="drop-shadow-2xl filter">{student.avatarId}</div>
                              {isSelected && <div className="absolute inset-0 border-2 border-yellow-300 rounded-full animate-ping opacity-20"></div>}
                          </div>

                          {/* Info */}
                          <div className="text-center w-full">
                              <div className={`text-xs font-bold mb-1 ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>
                                  No.{student.number}
                              </div>
                              <div className={`font-bold text-lg truncate w-full ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                                  {student.name}
                              </div>
                          </div>

                          {/* Points Badge */}
                          <div className={`
                              mt-3 px-4 py-1.5 rounded-full font-black text-lg shadow-inner min-w-[3rem] text-center transition-colors
                              ${student.points > 0 
                                  ? (isSelected ? 'bg-yellow-400 text-yellow-900' : 'bg-slate-900 text-yellow-400 border border-yellow-500/30') 
                                  : (isSelected ? 'bg-indigo-700 text-indigo-300' : 'bg-slate-900 text-slate-600')}
                          `}>
                              {student.points}
                          </div>

                          {/* Selection Check */}
                          {isSelected && (
                              <div className="absolute top-3 left-3 text-yellow-300 drop-shadow-md">
                                  <CheckSquare size={20} fill="currentColor" className="text-indigo-600" />
                              </div>
                          )}
                      </button>
                  );
              })}
          </div>
      </main>

      {/* Floating Toolbar (Teacher Only) */}
      {isTeacherMode && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-30 w-[95%] max-w-3xl">
              <div className="bg-slate-800/90 backdrop-blur-xl p-3 rounded-3xl border border-slate-600/50 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col sm:flex-row items-center justify-between gap-4">
                  
                  {/* Left: Selection Info */}
                  <div className="flex items-center gap-4 px-4 w-full sm:w-auto justify-between sm:justify-start">
                      <button onClick={handleSelectAll} className="flex items-center gap-2 text-slate-300 hover:text-white font-bold transition-colors">
                          <CheckSquare size={20} className={selectedIds.size === students.length ? 'text-indigo-400' : ''} />
                          {selectedIds.size === students.length ? '해제' : '전체'}
                      </button>
                      <div className="h-8 w-px bg-slate-600 hidden sm:block"></div>
                      <span className="text-indigo-300 font-bold bg-indigo-900/50 px-3 py-1 rounded-lg border border-indigo-500/30">
                          {selectedIds.size}명 선택
                      </span>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button className="flex-1 sm:flex-none h-12 px-6 rounded-2xl bg-slate-700 text-slate-300 font-bold hover:bg-slate-600 hover:text-white transition-all flex items-center justify-center gap-2">
                          <User size={18} /> <span className="hidden sm:inline">누가기록</span>
                      </button>
                      <button 
                        onClick={() => handleOpenReward('bad')}
                        className="flex-1 sm:flex-none h-12 px-6 rounded-2xl bg-gradient-to-b from-red-500 to-red-600 text-white font-bold shadow-lg shadow-red-900/30 hover:translate-y-0.5 hover:shadow-none transition-all active:scale-95 border-b-4 border-red-800 active:border-b-0"
                      >
                          노력 요함
                      </button>
                      <button 
                        onClick={() => handleOpenReward('good')}
                        className="flex-1 sm:flex-none h-12 px-8 rounded-2xl bg-gradient-to-b from-indigo-500 to-indigo-600 text-white font-bold shadow-lg shadow-indigo-900/30 hover:translate-y-0.5 hover:shadow-none transition-all active:scale-95 border-b-4 border-indigo-800 active:border-b-0 flex items-center gap-2"
                      >
                          <Star size={18} fill="currentColor" /> 칭찬하기
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Reward Modal */}
      {showRewardModal && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-800 rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100 border border-slate-700">
                  <div className={`p-8 text-white flex justify-between items-center bg-gradient-to-r ${rewardType === 'good' ? 'from-indigo-600 to-violet-600' : 'from-red-600 to-orange-600'}`}>
                      <div>
                          <h2 className="text-2xl font-black flex items-center gap-2 mb-1">
                              {rewardType === 'good' ? <Sparkles className="text-yellow-300"/> : <Award />} 
                              {rewardType === 'good' ? '칭찬 점수' : '노력 점수'}
                          </h2>
                          <p className="text-white/70 text-sm font-medium">{selectedIds.size}명의 학생에게 부여합니다.</p>
                      </div>
                      <div className="bg-white/20 px-4 py-2 rounded-2xl text-xl font-bold backdrop-blur-sm">
                          {rewardType === 'good' ? '+' : '-'}
                      </div>
                  </div>
                  
                  <div className="p-6 grid grid-cols-1 gap-3 max-h-[50vh] overflow-y-auto">
                      {(rewardType === 'good' ? pointService.getRewardCategories() : pointService.getPenaltyCategories()).map((cat, idx) => (
                          <button 
                            key={idx} 
                            onClick={() => handleGivePoints(cat.score, cat.label)} 
                            className="flex items-center justify-between p-5 rounded-2xl bg-slate-700 border border-slate-600 hover:bg-slate-600 hover:border-slate-500 transition-all group text-left shadow-sm active:scale-95"
                          >
                              <span className="font-bold text-slate-100 text-lg group-hover:text-white">{cat.label}</span>
                              <span className={`font-black text-xl ${cat.score > 0 ? 'text-indigo-400' : 'text-red-400'}`}>
                                  {cat.score > 0 ? '+' : ''}{cat.score}
                              </span>
                          </button>
                      ))}
                  </div>
                  
                  <div className="p-4 bg-slate-900/50 text-center border-t border-slate-700">
                      <button onClick={() => setShowRewardModal(false)} className="text-slate-400 font-bold hover:text-white transition-colors py-2">
                          취소하기
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
