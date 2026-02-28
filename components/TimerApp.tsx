
import React, { useState, useEffect, useRef } from 'react';
import { Home, Play, Pause, RotateCcw, Volume2, VolumeX, Watch, Timer, Hourglass, PieChart, Circle, StopCircle, Monitor, User, ThumbsUp, Sparkles, X } from 'lucide-react';
import * as timerService from '../services/timerService';
import { TimerState, TimerType, PomodoroState } from '../types';

interface TimerAppProps {
  onBack: () => void;
  isTeacherMode: boolean;
}

export const TimerApp: React.FC<TimerAppProps> = ({ onBack, isTeacherMode }) => {
  // --- View Mode (For Students) ---
  const [viewMode, setViewMode] = useState<'class' | 'personal'>('class');

  // --- Public Timer State ---
  const [timerState, setTimerState] = useState<TimerState>(timerService.getTimerState());
  const [localRemaining, setLocalRemaining] = useState(timerState.remainingTime);
  
  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);

  // --- Personal Pomodoro State ---
  const [pomoState, setPomoState] = useState<PomodoroState>({
    status: 'work',
    remaining: 25 * 60,
    isRunning: false,
  });
  const [pomoCount, setPomoCount] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState('');
  const [showPomoHelp, setShowPomoHelp] = useState(false);

  // --- Synchronization Effect (Public Timer) ---
  useEffect(() => {
    // Poll for updates (especially for students)
    const interval = setInterval(() => {
      const serverState = timerService.getTimerState();
      
      if (!isTeacherMode || (isTeacherMode && !serverState.isRunning)) {
           setTimerState(serverState);
      }
      
      // Calculate real remaining for display
      const realRemaining = timerService.calculateRemaining(serverState);
      setLocalRemaining(realRemaining);

      // Handle Auto-Stop at 0
      if (serverState.isRunning && realRemaining <= 0) {
        playSound('end');
        if (isTeacherMode) {
            timerService.updateTimerState({ isRunning: false, remainingTime: 0 });
        }
      } else if (serverState.isRunning && realRemaining === 60) {
        playSound('warning');
      }

    }, 500); // Check every 0.5s

    return () => clearInterval(interval);
  }, [isTeacherMode]);


  // --- Pomodoro Effect ---
  useEffect(() => {
    let interval: number;
    if (pomoState.isRunning && pomoState.remaining > 0) {
      interval = window.setInterval(() => {
        setPomoState(prev => {
          // Finish Logic
          if (prev.remaining <= 1) {
            playSound('end');
            
            // If it was work mode, increment count and check for celebration
            if (prev.status === 'work') {
                const newCount = pomoCount + 1;
                setPomoCount(newCount);
                
                // Milestone Check (Every 5 counts)
                if (newCount > 0 && newCount % 5 === 0) {
                    triggerCelebration(newCount);
                }
            }

            return { ...prev, remaining: 0, isRunning: false };
          }
          return { ...prev, remaining: prev.remaining - 1 };
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [pomoState.isRunning, pomoCount]);

  const triggerCelebration = (count: number) => {
      const messages = [
          "전설적인 집중력! 🏆", 
          "오늘의 학습왕! 👑", 
          "한계를 돌파했다! 🚀", 
          "신의 경지에 도달! ⚡"
      ];
      setCelebrationMessage(messages[Math.floor(Math.random() * messages.length)]);
      setShowCelebration(true);
      
      // Hide after 5 seconds
      setTimeout(() => setShowCelebration(false), 5000);
  };

  // --- Sound Logic ---
  const playSound = (type: 'start' | 'warning' | 'end') => {
    if (timerState.isMuted) return;
    
    // Simple Oscillator Beeps to avoid external assets
    if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    
    if (type === 'start') {
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'warning') {
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    } else if (type === 'end') {
        // Ding-dong style
        osc.frequency.setValueAtTime(800, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 1);
        osc.start(now);
        osc.stop(now + 1);
        
        setTimeout(() => {
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.frequency.setValueAtTime(600, ctx.currentTime);
            gain2.gain.setValueAtTime(0.2, ctx.currentTime);
            gain2.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.5);
            osc2.start(ctx.currentTime);
            osc2.stop(ctx.currentTime + 1.5);
        }, 800);
    }
  };

  // --- Teacher Controls ---

  const handleStartStop = () => {
    const nextState = !timerState.isRunning;
    if (nextState) playSound('start');
    
    timerService.updateTimerState({
        isRunning: nextState,
        remainingTime: localRemaining,
    });
  };

  const handleReset = () => {
    const resetTime = timerState.type === 'stopwatch' ? 0 : timerState.totalDuration;
    setLocalRemaining(resetTime);
    timerService.updateTimerState({
        isRunning: false,
        remainingTime: resetTime,
    });
  };

  const handleAddTime = (seconds: number) => {
    const newTime = localRemaining + seconds;
    setLocalRemaining(newTime);
    timerService.updateTimerState({
        remainingTime: newTime,
    });
  };

  const handleSetTime = (minutes: number) => {
    const seconds = minutes * 60;
    setLocalRemaining(seconds);
    timerService.updateTimerState({
        totalDuration: seconds,
        remainingTime: seconds,
        isRunning: false
    });
  };

  const handleSwitchMode = (type: TimerType) => {
    if (timerState.isRunning) {
        if (!confirm('타이머가 작동 중입니다. 변경하면 정지되고 초기화됩니다. 계속하시겠습니까?')) return;
    }
    const defaultTime = type === 'stopwatch' ? 0 : 300;
    setTimerState(prev => ({ ...prev, type }));
    setLocalRemaining(defaultTime);
    timerService.updateTimerState({
        type,
        isRunning: false,
        totalDuration: defaultTime,
        remainingTime: defaultTime
    });
  };

  const handleToggleMute = () => {
    const next = !timerState.isMuted;
    timerService.updateTimerState({ isMuted: next });
    setTimerState(prev => ({...prev, isMuted: next}));
  };

  // --- Visual Components ---

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const renderVisual = () => {
    const progress = timerState.type === 'stopwatch' 
        ? 1 
        : Math.max(0, Math.min(1, localRemaining / (timerState.totalDuration || 1)));

    switch (timerState.type) {
        case 'digital':
            return (
                <div className="relative group">
                    {/* Glowing Background */}
                    <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg blur-xl opacity-30 group-hover:opacity-50 transition duration-1000 animate-pulse"></div>
                    <div className="relative font-mono text-[6rem] sm:text-[8rem] font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-cyan-200 tracking-tighter tabular-nums drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]" style={{ textShadow: '0 0 20px rgba(0,255,255,0.5)' }}>
                        {formatTime(localRemaining)}
                    </div>
                </div>
            );
        case 'analog':
            return (
                <div className="relative w-64 h-64 sm:w-80 sm:h-80 bg-black/40 rounded-full border-4 border-cyan-500/30 shadow-[0_0_50px_rgba(6,182,212,0.2)] flex items-center justify-center backdrop-blur-sm">
                    {/* Glowing Ring */}
                    <svg className="absolute inset-0 transform -rotate-90 drop-shadow-[0_0_10px_#22d3ee]" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="#1e293b" strokeWidth="2" />
                        <circle 
                            cx="50" cy="50" r="45" fill="none" stroke="#22d3ee" strokeWidth="3" 
                            strokeDasharray={`${2 * Math.PI * 45}`}
                            strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress)}`}
                            className="transition-all duration-1000 ease-linear"
                            strokeLinecap="round"
                        />
                    </svg>
                    {/* Inner Markers */}
                    {[...Array(12)].map((_, i) => (
                        <div key={i} className="absolute w-1 h-3 bg-cyan-400/50 origin-bottom rounded-full" 
                             style={{ 
                                 transform: `rotate(${i * 30}deg) translateY(-36px)`,
                                 transformOrigin: '50% 100%',
                                 top: '50%', left: '50%', marginTop: '-1.5px', marginLeft: '-0.5px'
                             }} 
                        />
                    ))}
                    <div className="absolute font-mono text-3xl font-bold text-white drop-shadow-md">{formatTime(localRemaining)}</div>
                </div>
            );
        case 'pie':
            return (
                <div className="relative w-64 h-64 sm:w-80 sm:h-80 filter drop-shadow-[0_0_20px_rgba(244,63,94,0.4)]">
                    <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                        <circle cx="50" cy="50" r="45" fill="#334155" opacity="0.5" />
                        <path 
                            d={`M 50 50 L 50 5 A 45 45 0 ${progress > 0.5 ? 1 : 0} 1 ${50 + 45 * Math.sin(2 * Math.PI * progress)} ${50 - 45 * Math.cos(2 * Math.PI * progress)} Z`}
                            fill="#f43f5e"
                            className="transition-all duration-500"
                            stroke="white"
                            strokeWidth="0.5"
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center font-mono text-4xl font-bold text-white drop-shadow-lg">
                        {formatTime(localRemaining)}
                    </div>
                </div>
            );
        case 'hourglass':
            return (
                <div className="flex flex-col items-center">
                    <div className="relative w-32 h-48 sm:w-40 sm:h-60 rounded-3xl bg-white/5 border border-white/20 overflow-hidden shadow-[0_0_30px_rgba(234,179,8,0.2)] backdrop-blur-md">
                        {/* Glass Shine */}
                        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
                        {/* Sand Top */}
                        <div 
                            className="absolute top-0 left-0 right-0 bg-yellow-400 transition-all duration-500 ease-linear shadow-[0_0_20px_#facc15]"
                            style={{ height: `${progress * 50}%`, borderBottomLeftRadius: '1.5rem', borderBottomRightRadius: '1.5rem' }}
                        ></div>
                        {/* Sand Bottom */}
                        <div 
                            className="absolute bottom-0 left-0 right-0 bg-yellow-400 transition-all duration-500 ease-linear shadow-[0_0_20px_#facc15]"
                            style={{ height: `${(1 - progress) * 50}%`, borderTopLeftRadius: '1.5rem', borderTopRightRadius: '1.5rem' }}
                        ></div>
                         {/* Stream */}
                         {timerState.isRunning && progress > 0 && (
                            <div className="absolute top-1/2 left-1/2 w-0.5 h-full bg-yellow-200 -ml-0.5 animate-pulse shadow-[0_0_10px_white]"></div>
                         )}
                    </div>
                    <div className="mt-4 font-mono text-4xl font-bold text-yellow-300 drop-shadow-md">{formatTime(localRemaining)}</div>
                </div>
            );
        case 'balloon':
            const scale = 0.5 + (1 - progress) * 1.5; 
            const isPopped = localRemaining <= 0 && timerState.totalDuration > 0;
            return (
                <div className="flex flex-col items-center justify-center h-80 w-full relative overflow-hidden perspective-500">
                    {!isPopped ? (
                         <div 
                            className="rounded-full shadow-[inset_-10px_-10px_20px_rgba(0,0,0,0.5),0_0_30px_rgba(239,68,68,0.6)] transition-transform duration-500 relative flex items-center justify-center text-white font-bold text-2xl bg-gradient-to-br from-red-400 to-red-700"
                            style={{ width: '180px', height: '220px', transform: `scale(${scale})` }}
                         >
                            <div className="absolute bottom-[-10px] w-4 h-6 bg-red-800 rounded-b"></div>
                            <span className="drop-shadow-lg z-10">{formatTime(localRemaining)}</span>
                            {/* Reflection */}
                            <div className="absolute top-8 right-8 w-12 h-16 bg-white rounded-[50%] opacity-20 transform rotate-45 blur-sm"></div>
                         </div>
                    ) : (
                        <div className="text-6xl animate-bounce text-red-500 font-black drop-shadow-[0_0_20px_red]">💥 펑!</div>
                    )}
                </div>
            );
        case 'stopwatch':
            return (
                <div className="flex flex-col items-center gap-4">
                    <div className="font-mono text-[6rem] sm:text-[8rem] font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 tracking-tighter drop-shadow-2xl">
                        {formatTime(localRemaining)}
                    </div>
                    <div className="text-xl text-blue-400 uppercase tracking-widest font-bold animate-pulse">Running</div>
                </div>
            );
    }
  };

  // --- Render ---

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col font-sans overflow-hidden relative">
        <style>{`
            @keyframes spin-3d {
                0% { transform: rotateY(0deg) rotateX(0deg) scale(0.5); opacity: 0; }
                50% { transform: rotateY(180deg) rotateX(10deg) scale(1.2); opacity: 1; }
                100% { transform: rotateY(360deg) rotateX(0deg) scale(1); opacity: 1; }
            }
            @keyframes float {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-20px); }
            }
            .animate-spin-3d {
                animation: spin-3d 1.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards, float 3s ease-in-out infinite;
                transform-style: preserve-3d;
            }
        `}</style>

        {/* Background Elements */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-900 to-black pointer-events-none"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 animate-pulse pointer-events-none"></div>

        {/* Header */}
        <header className="bg-white/5 backdrop-blur-md shadow-lg sticky top-0 z-30 border-b border-white/10">
            <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-indigo-200 hover:text-white transition-colors">
                        <Home size={20} />
                    </button>
                    <div className="h-6 w-px bg-white/20"></div>
                    <div className="flex bg-black/30 p-1 rounded-lg border border-white/10">
                        {/* Student Tab Switcher */}
                        <button 
                            onClick={() => setViewMode('class')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-all ${viewMode === 'class' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            <Monitor size={16} /> 공용 타이머
                        </button>
                        {!isTeacherMode && (
                             <button 
                                onClick={() => setViewMode('personal')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-all ${viewMode === 'personal' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                <User size={16} /> 나만의 뽀모도로
                            </button>
                        )}
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <button onClick={handleToggleMute} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                        {timerState.isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                    </button>
                </div>
            </div>
        </header>

        {/* Main Body */}
        <main className="flex-1 flex flex-col items-center justify-center p-4 relative z-10">
            
            {/* Celebration Overlay */}
            {showCelebration && (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-none">
                    <div className="absolute inset-0 overflow-hidden">
                        {[...Array(20)].map((_, i) => (
                            <Sparkles 
                                key={i} 
                                className="absolute text-yellow-400 animate-pulse" 
                                style={{
                                    top: `${Math.random() * 100}%`,
                                    left: `${Math.random() * 100}%`,
                                    transform: `scale(${Math.random() * 2 + 0.5})`,
                                    animationDuration: `${Math.random() * 2 + 1}s`
                                }}
                            />
                        ))}
                    </div>
                    
                    <div className="animate-spin-3d flex flex-col items-center justify-center">
                        <div className="text-[12rem] filter drop-shadow-[0_0_50px_rgba(234,179,8,0.8)] rotate-12">
                            👍
                        </div>
                        <h1 className="mt-8 text-5xl sm:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-orange-400 to-red-500 drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)] text-center tracking-tighter">
                            {celebrationMessage}
                        </h1>
                        <p className="text-white text-2xl mt-4 font-bold tracking-widest uppercase">
                            {pomoCount}회 달성!
                        </p>
                    </div>
                </div>
            )}

            {/* View: Class Timer */}
            {viewMode === 'class' && (
                <div className="w-full max-w-4xl flex flex-col items-center gap-12 animate-fade-in-up">
                    {/* Visual Area - SCALED UP 2X */}
                    <div className="flex-1 flex items-center justify-center w-full min-h-[400px] transform scale-150 sm:scale-[2.0] origin-center my-10 sm:my-20">
                        {renderVisual()}
                    </div>

                    {/* Teacher Controls */}
                    {isTeacherMode ? (
                        <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl shadow-2xl w-full border border-white/20 mt-10">
                             {/* Timer Type Selector */}
                             <div className="flex flex-wrap gap-2 justify-center mb-6">
                                {[
                                    { id: 'digital', icon: Timer, label: '디지털' },
                                    { id: 'analog', icon: Watch, label: '시계' },
                                    { id: 'pie', icon: PieChart, label: '파이' },
                                    { id: 'hourglass', icon: Hourglass, label: '모래시계' },
                                    { id: 'balloon', icon: Circle, label: '풍선' },
                                    { id: 'stopwatch', icon: StopCircle, label: '스톱워치' },
                                ].map((t) => (
                                    <button 
                                        key={t.id}
                                        onClick={() => handleSwitchMode(t.id as TimerType)}
                                        className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-bold transition-all border
                                            ${timerState.type === t.id 
                                                ? 'bg-indigo-500 text-white border-indigo-400 shadow-[0_0_10px_#6366f1]' 
                                                : 'bg-black/30 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white'}`}
                                    >
                                        <t.icon size={16} /> {t.label}
                                    </button>
                                ))}
                             </div>

                             <div className="h-px bg-white/10 mb-6"></div>

                             {/* Main Action Buttons */}
                             <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                                <div className="flex items-center gap-2">
                                     <button onClick={() => handleAddTime(60)} className="px-3 py-1 bg-white/5 hover:bg-white/20 border border-white/10 rounded text-xs font-bold text-slate-300 transition-colors">+1분</button>
                                     <button onClick={() => handleAddTime(300)} className="px-3 py-1 bg-white/5 hover:bg-white/20 border border-white/10 rounded text-xs font-bold text-slate-300 transition-colors">+5분</button>
                                     <button onClick={() => handleAddTime(600)} className="px-3 py-1 bg-white/5 hover:bg-white/20 border border-white/10 rounded text-xs font-bold text-slate-300 transition-colors">+10분</button>
                                     {timerState.type !== 'stopwatch' && (
                                         <div className="flex items-center gap-1 ml-2">
                                             <button onClick={() => handleSetTime(5)} className="px-2 py-1 border border-white/10 rounded text-xs text-slate-500 hover:text-white hover:border-white/30">5분</button>
                                             <button onClick={() => handleSetTime(10)} className="px-2 py-1 border border-white/10 rounded text-xs text-slate-500 hover:text-white hover:border-white/30">10분</button>
                                             <button onClick={() => handleSetTime(40)} className="px-2 py-1 border border-white/10 rounded text-xs text-slate-500 hover:text-white hover:border-white/30">40분</button>
                                         </div>
                                     )}
                                </div>

                                <div className="flex items-center gap-4">
                                    <button 
                                        onClick={handleReset}
                                        className="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors border border-white/10"
                                    >
                                        <RotateCcw size={24} />
                                    </button>
                                    <button 
                                        onClick={handleStartStop}
                                        className={`w-20 h-20 flex items-center justify-center rounded-full shadow-[0_0_30px_rgba(0,0,0,0.5)] transition-all active:scale-95 border-4 ${timerState.isRunning ? 'bg-red-600 border-red-800 hover:bg-red-500 text-white' : 'bg-green-600 border-green-800 hover:bg-green-500 text-white'}`}
                                    >
                                        {timerState.isRunning ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                                    </button>
                                </div>
                             </div>
                        </div>
                    ) : (
                        <div className="text-slate-500 text-sm mt-8 animate-pulse">
                            선생님이 타이머를 조작하고 있습니다.
                        </div>
                    )}
                </div>
            )}

            {/* View: Personal Pomodoro */}
            {viewMode === 'personal' && !isTeacherMode && (
                <div className="w-full max-w-md bg-white/5 backdrop-blur-xl rounded-3xl shadow-2xl p-8 text-center animate-fade-in-up border border-white/10 transform scale-110">
                    {/* Top Stats Banner */}
                    <div className="flex items-center justify-center gap-2 mb-6 bg-black/30 p-2 rounded-full border border-white/10 w-fit mx-auto px-4">
                        <ThumbsUp size={16} className="text-yellow-400" />
                        <span className="text-white text-sm font-bold">오늘의 집중: <span className="text-yellow-400 text-lg">{pomoCount}회</span></span>
                    </div>

                    <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-purple-300 mb-2">🔮 나의 뽀모도로</h2>
                    <p className="text-indigo-200/60 text-sm mb-4">집중의 마법을 부려보세요</p>
                    <button
                        type="button"
                        onClick={() => setShowPomoHelp(true)}
                        className="h-12 w-full sm:w-auto px-5 rounded-xl bg-white/10 text-white font-bold border border-white/20 hover:bg-white/20 transition-colors mb-8"
                    >
                        뽀모도로 학습법이란?
                    </button>

                    {/* 3D Orb Visualization - SCALED UP */}
                    <div className="transform scale-[1.5] origin-center my-6 mb-32">
                        <div className="w-52 h-52 mx-auto relative flex items-center justify-center">
                            {/* Stem & Leaf */}
                            <div className="absolute -top-10 flex items-center justify-center gap-1">
                                <div className="w-8 h-3 bg-emerald-500 rounded-full rotate-[-20deg] shadow-md"></div>
                                <div className="w-6 h-6 bg-emerald-400 rounded-full -mt-2 shadow-md"></div>
                                <div className="w-8 h-3 bg-emerald-500 rounded-full rotate-[20deg] shadow-md"></div>
                            </div>

                            {/* Tomato Body */}
                            <div className={`
                                w-48 h-48 rounded-full flex items-center justify-center relative transition-all duration-1000
                                shadow-[0_0_50px_rgba(0,0,0,0.5)]
                                ${pomoState.status === 'work' 
                                    ? 'bg-gradient-to-br from-red-400 via-red-600 to-rose-900 shadow-[0_0_40px_#f87171]' 
                                    : 'bg-gradient-to-br from-emerald-400 via-teal-600 to-blue-900 shadow-[0_0_40px_#34d399]'}
                            `}>
                                {/* Glossy Reflection */}
                                <div className="absolute top-5 left-8 w-16 h-8 bg-white opacity-25 rounded-full blur-md transform -rotate-12"></div>
                                {/* Inner Ring */}
                                <div className="absolute inset-2 rounded-full border border-white/20"></div>

                                <div className="text-4xl font-mono font-bold text-white drop-shadow-lg z-10">
                                    {formatTime(pomoState.remaining)}
                                </div>
                                <div className={`absolute -bottom-12 px-3 py-1 rounded-full text-[10px] font-bold text-white uppercase tracking-wider border border-white/20 backdrop-blur-md ${pomoState.status === 'work' ? 'bg-red-500/60' : 'bg-emerald-500/60'}`}>
                                    {pomoState.status === 'work' ? '🔥 집중 모드' : '🌿 휴식 모드'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-center gap-4 mb-8 mt-4">
                        <button 
                            onClick={() => setPomoState(p => ({ ...p, isRunning: !p.isRunning }))}
                            className={`px-8 py-3 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 border border-white/20 ${pomoState.isRunning ? 'bg-slate-600 hover:bg-slate-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}
                        >
                            {pomoState.isRunning ? '마법 일시정지' : '마법 시작하기'}
                        </button>
                        <button 
                            onClick={() => setPomoState({ status: 'work', remaining: 25 * 60, isRunning: false })}
                            className="px-4 py-3 rounded-xl font-bold text-slate-300 bg-white/10 hover:bg-white/20 border border-white/10"
                        >
                            <RotateCcw size={20} />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <button 
                            onClick={() => setPomoState({ status: 'work', remaining: 25 * 60, isRunning: false })}
                            className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 font-bold hover:bg-red-500/20 transition-colors"
                        >
                            25분 집중
                        </button>
                        <button 
                            onClick={() => setPomoState({ status: 'rest', remaining: 5 * 60, isRunning: false })}
                            className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 font-bold hover:bg-emerald-500/20 transition-colors"
                        >
                            5분 휴식
                        </button>
                    </div>
                </div>
            )}
        </main>
        
        {showPomoHelp && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
                <div className="w-full max-w-lg bg-gray-50 text-gray-800 rounded-3xl shadow-2xl border border-gray-200">
                    <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
                        <div className="font-bold text-lg">뽀모도로 학습법 안내</div>
                        <button
                            type="button"
                            onClick={() => setShowPomoHelp(false)}
                            className="p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-200"
                            aria-label="닫기"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    <div className="px-6 py-5 space-y-3 text-sm leading-6">
                        <p>
                            뽀모도로 학습법은 <strong>25분 집중 + 5분 휴식</strong>을 한 세트로 반복하는
                            시간 관리 방법이에요.
                        </p>
                        <p>
                            한 세트가 끝나면 잠깐 쉬고, 다시 집중하는 과정을 반복하면
                            <strong>집중력과 기억력</strong>을 더 오래 유지할 수 있어요.
                        </p>
                        <p>
                            오늘은 2~4세트를 목표로 시작해보세요!
                        </p>
                    </div>
                    <div className="px-6 pb-6">
                        <button
                            type="button"
                            onClick={() => setShowPomoHelp(false)}
                            className="h-12 w-full rounded-xl bg-indigo-600 text-white font-bold shadow-md hover:bg-indigo-700 transition-colors"
                        >
                            확인
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
