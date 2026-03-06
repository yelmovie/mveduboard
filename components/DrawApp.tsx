
import React, { useState, useEffect, useRef } from 'react';
import { Home, Settings, Play, RotateCcw, Users, Hash, Dices, Sparkles, Wand2, RefreshCw } from 'lucide-react';
import * as drawService from '../services/drawService';
import * as studentService from '../services/studentService';

interface DrawAppProps {
  onBack: () => void;
  isTeacherMode: boolean;
}

type DrawMode = 'number' | 'name';

// --- Slot Machine Animation Component ---
const SlotMachine: React.FC<{ names: string[]; duration: number }> = ({ names, duration }) => {
    const [current, setCurrent] = useState(0);
    useEffect(() => {
        if (names.length === 0) return;
        let speed = 50;
        let elapsed = 0;
        const tick = () => {
            setCurrent(prev => (prev + 1) % names.length);
            elapsed += speed;
            if (elapsed < duration) {
                speed = Math.min(speed + 8, 300);
                setTimeout(tick, speed);
            }
        };
        tick();
    }, [names, duration]);
    return (
        <div className="text-6xl md:text-8xl font-black text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.5)] animate-pulse text-center break-keep">
            {names[current] || '?'}
        </div>
    );
};

// --- Confetti Burst Component ---
const ConfettiBurst: React.FC = () => {
    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#A78BFA', '#F472B6', '#34D399', '#60A5FA', '#FBBF24'];
    return (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
            {Array.from({ length: 80 }).map((_, i) => {
                const color = colors[i % colors.length];
                const left = Math.random() * 100;
                const delay = Math.random() * 0.5;
                const size = Math.random() * 10 + 5;
                const rotation = Math.random() * 360;
                return (
                    <div
                        key={i}
                        className="absolute animate-confetti-fall"
                        style={{
                            left: `${left}%`,
                            top: '-20px',
                            width: `${size}px`,
                            height: `${size * 0.6}px`,
                            backgroundColor: color,
                            borderRadius: '2px',
                            transform: `rotate(${rotation}deg)`,
                            animationDelay: `${delay}s`,
                            animationDuration: `${2 + Math.random() * 2}s`,
                        }}
                    />
                );
            })}
            <style>{`
                @keyframes confetti-fall {
                    0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
                    100% { transform: translateY(100vh) rotate(720deg) scale(0.5); opacity: 0; }
                }
                .animate-confetti-fall { animation: confetti-fall linear forwards; }
            `}</style>
        </div>
    );
};

// --- Winner Reveal Component ---
const WinnerReveal: React.FC<{ name: string; index: number }> = ({ name, index }) => {
    const [show, setShow] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => setShow(true), index * 200);
        return () => clearTimeout(timer);
    }, [index]);
    return (
        <div className={`transition-all duration-700 ${show ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
            <div className="relative bg-gradient-to-br from-yellow-400 via-amber-300 to-yellow-500 p-1 rounded-3xl shadow-[0_0_60px_rgba(250,204,21,0.6)]">
                <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-[20px] px-12 py-10 text-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-40"></div>
                    <div className="relative z-10">
                        <div className="text-yellow-400 text-sm font-bold tracking-[0.3em] mb-3">SELECTED</div>
                        <div className="text-5xl md:text-7xl font-black text-white break-keep leading-tight drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                            {name}
                        </div>
                    </div>
                    <div className="absolute inset-0 pointer-events-none">
                        {Array.from({ length: 15 }).map((_, i) => (
                            <div key={i} className="absolute w-1 h-1 bg-yellow-300 rounded-full animate-ping" style={{ top: `${Math.random()*100}%`, left: `${Math.random()*100}%`, animationDelay: `${i*0.15}s`, animationDuration: '1.5s' }} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const DrawApp: React.FC<DrawAppProps> = ({ onBack, isTeacherMode }) => {
  // Load initial state
  const savedConfig = isTeacherMode ? drawService.getTeacherConfig() : null;
  const sharedState = drawService.getDrawState();

  // --- Setup State (Teacher Only) ---
  const [setupMode, setSetupMode] = useState<DrawMode>(savedConfig?.setupMode || 'name');
  const [numRange, setNumRange] = useState(savedConfig?.numRange || { min: 1, max: 30 });
  const [nameList, setNameList] = useState<string[]>(savedConfig?.nameList || []);
  const [nameInput, setNameInput] = useState(savedConfig?.nameList?.join('\n') || '');
  
  const [drawCount, setDrawCount] = useState(savedConfig?.drawCount || 1);
  const [allowDuplicates, setAllowDuplicates] = useState(savedConfig?.allowDuplicates || false);
  
  // --- Runtime State ---
  const [isPlaying, setIsPlaying] = useState(isTeacherMode ? (savedConfig?.isPlaying || false) : sharedState.isActive);
  const [pool, setPool] = useState<string[]>(savedConfig?.pool || []); 
  const [winners, setWinners] = useState<string[]>(isTeacherMode ? sharedState.result : []); 
  const [isAnimating, setIsAnimating] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [slotNames, setSlotNames] = useState<string[]>([]); 

  // --- Student Sync State ---
  const [remoteResult, setRemoteResult] = useState<string[]>(sharedState.result);
  const [remoteAnimating, setRemoteAnimating] = useState(sharedState.isAnimating);

  // --- Effects ---

  // Preload roster from DB and auto-fill name list
  useEffect(() => {
    if (!isTeacherMode) return;
    const loadRoster = async () => {
      try {
        await studentService.preloadClassId();
        await studentService.fetchRosterFromDb();
      } catch {}
      const roster = drawService.getClassRoster();
      if (roster.length > 0 && nameList.length === 0) {
        setNameList(roster);
        setNameInput(roster.join('\n'));
      }
    };
    loadRoster();
  }, [isTeacherMode]);

  // Polling for Student Sync
  useEffect(() => {
    if (!isTeacherMode) {
      const interval = setInterval(() => {
        const state = drawService.getDrawState();
        setIsPlaying(state.isActive);
        setRemoteResult(state.result);
        setRemoteAnimating(state.isAnimating);
      }, 500);
      return () => clearInterval(interval);
    }
  }, [isTeacherMode]);

  // 뽑을 인원이 남은 인원보다 크면 자동 조정
  useEffect(() => {
    if (isTeacherMode && pool.length > 0 && drawCount > pool.length) {
      setDrawCount(pool.length);
    }
  }, [isTeacherMode, pool.length, drawCount]);

  // Sync Teacher state to cloud
  useEffect(() => {
    if (isTeacherMode) {
      drawService.updateDrawState({
        isActive: isPlaying,
        result: winners,
        isAnimating: isAnimating
      });

      drawService.saveTeacherConfig({
        setupMode,
        numRange,
        nameList,
        drawCount,
        allowDuplicates,
        showAnimation: true, // Always true for mystical mode
        pool,
        isPlaying
      });
    }
  }, [isPlaying, winners, isAnimating, isTeacherMode, setupMode, numRange, nameList, drawCount, allowDuplicates, pool]);

  // --- Handlers ---

  const handleAddClassRoster = async () => {
    try {
      await studentService.preloadClassId();
      await studentService.fetchRosterFromDb();
    } catch {}
    const roster = drawService.getClassRoster();
    setNameList(roster);
    setNameInput(roster.join('\n'));
  };

  const handleNameInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNameInput(e.target.value);
    const names = e.target.value.split('\n').map(s => s.trim()).filter(s => s !== '');
    setNameList(names);
  };

  const handleStartGame = () => {
    let initialPool: string[] = [];
    if (setupMode === 'number') {
      for (let i = numRange.min; i <= numRange.max; i++) {
        initialPool.push(i.toString());
      }
    } else {
      if (nameList.length === 0) {
        alert('이름을 입력해주세요!');
        return;
      }
      initialPool = [...nameList];
    }
    
    setPool(initialPool);
    setWinners([]);
    setIsPlaying(true);
  };

  const handlePick = () => {
    if (pool.length === 0) {
      alert('뽑을 대상이 없습니다! 초기화 버튼을 눌러주세요.');
      return;
    }

    const countToPick = Math.min(drawCount, pool.length);
    
    setIsAnimating(true);
    setWinners([]);
    setShowConfetti(false);
    setSlotNames([...pool].sort(() => Math.random() - 0.5));

    setTimeout(() => {
        const currentPool = [...pool];
        const newWinners: string[] = [];

        for (let i = 0; i < countToPick; i++) {
            if (currentPool.length === 0) break;
            const randomIndex = Math.floor(Math.random() * currentPool.length);
            newWinners.push(currentPool[randomIndex]);
            
            if (!allowDuplicates) {
                currentPool.splice(randomIndex, 1);
            }
        }

        setWinners(newWinners);
        setPool(currentPool);
        setIsAnimating(false);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 4000);
    }, 3000);
  };

  const handleResetPool = () => {
    if (confirm('전체 명단을 초기화하시겠습니까?')) {
        let initialPool: string[] = [];
        if (setupMode === 'number') {
            for (let i = numRange.min; i <= numRange.max; i++) {
                initialPool.push(i.toString());
            }
        } else {
            initialPool = [...nameList];
        }
        setPool(initialPool);
        setWinners([]);
    }
  };

  const handleBackToSetup = () => {
      setIsPlaying(false);
  }

  // --- Views ---

  // 1. Setup View (Teacher Only)
  if (isTeacherMode && !isPlaying) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white w-full max-w-2xl rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-violet-600 p-6 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2 text-2xl font-bold font-hand">
                    <Wand2 /> 신비한 발표 뽑기
                </div>
                <button onClick={onBack} className="bg-white/20 p-2 rounded-full hover:bg-white/30">
                    <Home size={20} />
                </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-8">
                {/* Mode */}
                <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button 
                        onClick={() => setSetupMode('name')}
                        className={`flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${setupMode === 'name' ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Users size={20} /> 이름 뽑기
                    </button>
                    <button 
                        onClick={() => setSetupMode('number')}
                        className={`flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${setupMode === 'number' ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Hash size={20} /> 번호 뽑기
                    </button>
                </div>

                {/* Content Input */}
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                    {setupMode === 'number' ? (
                        <div className="flex items-center gap-4 justify-center text-xl font-bold text-gray-700">
                            <input 
                                type="number" value={numRange.min} 
                                onChange={(e) => setNumRange({...numRange, min: parseInt(e.target.value)})}
                                className="w-24 p-2 text-center border rounded-xl focus:ring-2 focus:ring-violet-500"
                            />
                            <span>부터</span>
                            <input 
                                type="number" value={numRange.max} 
                                onChange={(e) => setNumRange({...numRange, max: parseInt(e.target.value)})}
                                className="w-24 p-2 text-center border rounded-xl focus:ring-2 focus:ring-violet-500"
                            />
                            <span>까지</span>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-bold text-gray-600">학생 명단</label>
                                <button 
                                    onClick={handleAddClassRoster}
                                    className="text-xs bg-violet-100 text-violet-700 px-3 py-1 rounded-full hover:bg-violet-200 font-bold border border-violet-200 flex items-center gap-1"
                                >
                                    <Users size={12} /> 우리반 명단 불러오기
                                </button>
                            </div>
                            <textarea 
                                value={nameInput}
                                onChange={handleNameInputChange}
                                className="w-full h-32 p-3 border rounded-xl focus:ring-2 focus:ring-violet-500 resize-none text-gray-800"
                                placeholder="예: 김철수&#10;이영희&#10;박민수"
                            />
                            <div className="text-right text-xs text-gray-500">
                                총 {nameList.length}명
                            </div>
                        </div>
                    )}
                </div>

                {/* Settings */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-gray-600">뽑을 인원 (기본값)</label>
                        <div className="flex items-center gap-3">
                             <input 
                                type="range" min="1" max="20" 
                                value={Math.min(20, Math.max(1, drawCount))} 
                                onChange={(e) => setDrawCount(parseInt(e.target.value) || 1)}
                                className="flex-1 accent-violet-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                            />
                            <input 
                                type="number" min={1} max={20} 
                                value={drawCount} 
                                onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) setDrawCount(Math.min(20, Math.max(1, v))); }}
                                className="w-14 text-center text-xl font-black text-violet-600 border border-violet-200 rounded-lg py-1"
                            />
                            <span className="text-gray-600 font-medium">명</span>
                        </div>
                    </div>
                    
                    <div className="space-y-2 flex items-center">
                        <label className="flex items-center gap-2 cursor-pointer bg-white border px-3 py-2 rounded-lg w-full hover:bg-gray-50">
                            <input 
                                type="checkbox" 
                                checked={allowDuplicates} 
                                onChange={(e) => setAllowDuplicates(e.target.checked)}
                                className="w-5 h-5 accent-violet-600 rounded"
                            />
                            <span className="text-gray-700 font-bold text-sm">중복 당첨 허용</span>
                        </label>
                    </div>
                </div>

                <button 
                    onClick={handleStartGame}
                    className="w-full bg-violet-600 hover:bg-violet-700 text-white text-xl font-bold py-4 rounded-2xl shadow-lg transform transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                    <Play size={24} fill="currentColor" /> 마법 시작하기
                </button>
            </div>
        </div>
      </div>
    );
  }

  // 2. Play View (Shared Style, Different Controls)
  const isStudent = !isTeacherMode;
  const currentResult = isTeacherMode ? winners : remoteResult;
  const currentAnimating = isTeacherMode ? isAnimating : remoteAnimating;
  
  // Background style
  const bgStyle = "bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-indigo-950 to-black";

  return (
    <div className={`min-h-screen ${bgStyle} flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans`}>
        {/* Mystical Background Elements */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-40 animate-pulse pointer-events-none"></div>
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            {[...Array(20)].map((_, i) => (
                <div key={i} className="absolute bg-white rounded-full opacity-20 animate-float" 
                     style={{
                         top: `${Math.random() * 100}%`,
                         left: `${Math.random() * 100}%`,
                         width: `${Math.random() * 4 + 1}px`,
                         height: `${Math.random() * 4 + 1}px`,
                         animationDuration: `${Math.random() * 10 + 5}s`
                     }}
                ></div>
            ))}
        </div>

        {/* Controls Overlay (Teacher) */}
        {isTeacherMode && (
            <div className="absolute top-0 left-0 right-0 p-4 z-30 flex justify-between items-start bg-gradient-to-b from-black/60 to-transparent">
                <button onClick={handleBackToSetup} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full backdrop-blur-md transition-colors">
                    <Settings size={18} /> 설정
                </button>
                <div className="text-right">
                    <div className="text-white/80 text-sm font-bold bg-black/40 px-3 py-1 rounded-full border border-white/10">
                        남은 인원: <span className="text-yellow-400 text-lg">{pool.length}</span>
                    </div>
                </div>
            </div>
        )}

        {/* Home Button (Student) */}
        {isStudent && (
            <button onClick={onBack} className="absolute top-4 left-4 z-30 text-white/50 hover:text-white transition-colors">
                <Home size={24} />
            </button>
        )}

        {/* Confetti */}
        {showConfetti && <ConfettiBurst />}

        {/* Main Stage */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-6xl">
            
            {/* Title / Status */}
            <div className="mb-12 text-center">
                {currentAnimating ? (
                    <h2 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-orange-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]">
                        두근두근... 누구일까요?
                    </h2>
                ) : currentResult.length > 0 ? (
                    <h2 className="text-3xl md:text-5xl font-black text-white drop-shadow-lg flex items-center justify-center gap-3">
                        <Sparkles className="text-yellow-400 animate-spin" /> 축하합니다! <Sparkles className="text-yellow-400 animate-spin" />
                    </h2>
                ) : (
                    <h2 className="text-2xl md:text-4xl font-bold text-indigo-200 opacity-80">
                        {isTeacherMode ? "마법의 버튼을 눌러주세요" : "선생님의 신호를 기다리는 중..."}
                    </h2>
                )}
            </div>

            {/* Main Display Area */}
            <div className="flex flex-wrap justify-center gap-8 min-h-[300px] items-center">
                {currentAnimating ? (
                    <div className="flex flex-col items-center gap-8">
                        <div className="relative">
                            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-violet-600 blur-2xl opacity-60 animate-pulse" />
                            <div className="relative bg-gradient-to-br from-slate-900/90 to-indigo-950/90 backdrop-blur-md border-2 border-white/20 rounded-3xl px-16 py-12 shadow-[0_0_80px_rgba(139,92,246,0.4)]">
                                <SlotMachine names={slotNames} duration={2800} />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="w-3 h-3 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                            ))}
                        </div>
                    </div>
                ) : currentResult.length > 0 ? (
                    <div className="flex flex-wrap justify-center gap-6">
                        {currentResult.map((res, idx) => (
                            <WinnerReveal key={`${res}-${idx}`} name={res} index={idx} />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-40 h-40 rounded-full bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border-2 border-white/10 flex items-center justify-center backdrop-blur-sm">
                            <Wand2 size={64} className="text-indigo-300/50" />
                        </div>
                    </div>
                )}
            </div>

            {/* Teacher Controls Bottom: 뽑을 인원 입력 + 발표자 뽑기 */}
            {isTeacherMode && (
                <div className="mt-12 flex flex-col items-center gap-4 z-20">
                    <div className="flex items-center gap-3 bg-black/30 backdrop-blur-md rounded-2xl border border-white/10 px-6 py-3">
                        <span className="text-white/90 font-bold">뽑을 인원</span>
                        <input 
                            type="number" 
                            min={1} 
                            max={Math.max(1, pool.length)} 
                            value={drawCount} 
                            onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) setDrawCount(Math.min(Math.max(1, pool.length), Math.max(1, v))); }}
                            className="w-16 text-center text-xl font-black text-violet-300 bg-slate-800/80 border border-white/20 rounded-xl py-2 focus:outline-none focus:ring-2 focus:ring-violet-400"
                        />
                        <span className="text-white/80 font-medium">명</span>
                    </div>
                    <div className="flex gap-4">
                        <button 
                            onClick={handleResetPool}
                            disabled={currentAnimating}
                            className="w-16 h-16 rounded-full bg-slate-800 border border-slate-600 text-slate-400 hover:text-white hover:border-white hover:bg-slate-700 flex items-center justify-center transition-all disabled:opacity-50"
                            title="초기화"
                        >
                            <RefreshCw size={24} />
                        </button>
                        
                        <button 
                            onClick={handlePick}
                            disabled={currentAnimating || pool.length === 0}
                            className={`
                                px-12 py-4 rounded-full text-2xl font-black shadow-[0_0_30px_rgba(124,58,237,0.6)] transition-all transform hover:scale-105 active:scale-95 flex items-center gap-3 border-2 border-violet-400
                                ${currentAnimating || pool.length === 0 
                                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed border-slate-600' 
                                    : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500'}
                            `}
                        >
                            <Wand2 size={32} className={currentAnimating ? 'animate-spin' : ''} />
                            {currentAnimating ? '주문 외우는 중...' : '발표자 뽑기'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};
