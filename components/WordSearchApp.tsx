
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Home, Search, RefreshCcw, Check, Plus, Trophy, Grid, Sparkles, Wand2, BookOpen, ExternalLink, Info, ArrowRight } from 'lucide-react';
import * as wordSearchService from '../services/wordSearchService';
import { Participant, WordSearchGame } from '../types';

interface WordSearchAppProps {
  onBack: () => void;
  isTeacherMode: boolean;
  student?: Participant | null;
}

const MysticalWrapper: React.FC<{children: React.ReactNode}> = ({children}) => (
    <div className="min-h-screen bg-slate-900 flex flex-col font-sans relative overflow-hidden text-white selection:bg-violet-500 selection:text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900 via-slate-950 to-black opacity-80 pointer-events-none"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 animate-pulse pointer-events-none"></div>
        <div className="relative z-10 w-full h-full flex flex-col">
            {children}
        </div>
    </div>
);

export const WordSearchApp: React.FC<WordSearchAppProps> = ({ onBack, isTeacherMode, student }) => {
  const [game, setGame] = useState<WordSearchGame | null>(null);
  const [teacherView, setTeacherView] = useState<'game' | 'builder'>('game');
  
  // Creation State
  const [title, setTitle] = useState('');
  const [theme, setTheme] = useState('');
  const [aiWordCount, setAiWordCount] = useState<number>(10);
  const [wordsInput, setWordsInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [leaderboard, setLeaderboard] = useState<wordSearchService.WordSearchRankEntry[]>([]);

  const playerId = student?.id || 'guest';
  const playerName = student?.nickname || '나';

  const formatTime = (ms: number) => {
      const totalSec = Math.max(0, Math.floor(ms / 1000));
      const min = Math.floor(totalSec / 60);
      const sec = totalSec % 60;
      return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // Game Interaction State
  const [selectionStart, setSelectionStart] = useState<{r: number, c: number} | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{r: number, c: number} | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [foundCells, setFoundCells] = useState<Set<string>>(new Set()); // To highlight grid cells locally

  useEffect(() => {
    loadGame();
    // Poll for shared found words updates (cooperative mode simulation)
    const interval = setInterval(loadGame, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadGame = () => {
    const g = wordSearchService.getGame();
    setGame(g);
    if (g) {
        setLeaderboard(wordSearchService.getLeaderboard(g.id));
    }
    // Restore found cells highlight if game exists
    if (g && g.foundWords.length > 0) {
        // Since we don't store cell coordinates, we rely on the user finding them again 
        // OR we could scan the grid to re-highlight found words. 
        // For simplicity in this demo, we let the local state handle immediate feedback,
        // and rely on the list for persistence. Ideally, backend stores indices.
        // However, we can keep the local foundCells state persistent if we want better UX.
        // For now, we just keep the list sync.
    }
  };

  // --- Teacher Logic ---
  const handleGenerateAI = async () => {
      if (!theme.trim()) {
          alert('테마를 입력해주세요.');
          return;
      }
      setIsGenerating(true);
      try {
          const words = await wordSearchService.generateWordsWithAI(theme, aiWordCount);
          if (words.length > 0) {
              setWordsInput(words.join('\n'));
          } else {
              alert('단어 생성에 실패했습니다. 다른 테마로 시도해보세요.');
          }
      } finally {
          setIsGenerating(false);
      }
  };

  const handleCreate = () => {
    if (!title.trim()) {
        alert('제목을 입력해주세요.');
        return;
    }
    const words = wordsInput.split(/[,\n]+/).map(w => w.trim()).filter(w => w !== '');
    if (words.length < 3) {
        alert('최소 3개의 단어를 입력해주세요.');
        return;
    }
    wordSearchService.createGame(title, words);
    setTitle('');
    setTheme('');
    setWordsInput('');
    setFoundCells(new Set()); // Reset local highlights
    loadGame();
    setTeacherView('game');
  };

  const handleOpenBuilder = () => {
    setTeacherView('builder');
    if (!title && game?.title) {
      setTitle(game.title);
    }
  };

  const handleReset = () => {
      if(confirm('게임을 종료하고 삭제하시겠습니까?')) {
          wordSearchService.resetGame();
          setGame(null);
          setFoundCells(new Set());
      }
  };

  // --- Game Interaction Logic ---
  
  const getSelectedCells = (start: {r: number, c: number}, end: {r: number, c: number}) => {
      const cells: {r: number, c: number, char: string}[] = [];
      if (!game) return cells;

      const dr = end.r - start.r;
      const dc = end.c - start.c;
      
      // Determine step direction
      const steps = Math.max(Math.abs(dr), Math.abs(dc));
      if (steps === 0) return [{ ...start, char: game.grid[start.r][start.c] }];

      // Only allow horizontal, vertical, diagonal
      if (Math.abs(dr) !== 0 && Math.abs(dc) !== 0 && Math.abs(dr) !== Math.abs(dc)) {
          return []; // Invalid selection
      }

      const rStep = dr === 0 ? 0 : dr / Math.abs(dr);
      const cStep = dc === 0 ? 0 : dc / Math.abs(dc);

      for (let i = 0; i <= steps; i++) {
          const r = start.r + i * rStep;
          const c = start.c + i * cStep;
          cells.push({ r, c, char: game.grid[r][c] });
      }
      return cells;
  };

  // Unified Interaction Handler
  const handleInteractionStart = (r: number, c: number, e?: React.MouseEvent | React.TouchEvent) => {
      if (e) e.preventDefault(); // Stop native drag/select

      // If we are already in "Click-Click" mode (waiting for 2nd click)
      if (selectionStart && !isDragging) {
          if (selectionStart.r === r && selectionStart.c === c) {
              // Clicked same cell -> Cancel selection
              setSelectionStart(null);
              setSelectionEnd(null);
          } else {
              // Clicked different cell -> Finish selection
              const cells = getSelectedCells(selectionStart, {r, c});
              processSelection(cells);
              setSelectionStart(null);
              setSelectionEnd(null);
          }
          return;
      }

      // Start dragging or First Click
      setIsDragging(true);
      setSelectionStart({r, c});
      setSelectionEnd({r, c});
  };

  const handleInteractionMove = (r: number, c: number) => {
      if (isDragging) {
          setSelectionEnd({r, c});
      } else if (selectionStart) {
          // In Click-Click mode, update preview line
          setSelectionEnd({r, c});
      }
  };

  const handleInteractionEnd = () => {
      if (isDragging) {
          setIsDragging(false);
          // If start != end, it was a drag -> process it
          if (selectionStart && selectionEnd) {
              if (selectionStart.r !== selectionEnd.r || selectionStart.c !== selectionEnd.c) {
                  const cells = getSelectedCells(selectionStart, selectionEnd);
                  processSelection(cells);
                  setSelectionStart(null);
                  setSelectionEnd(null);
              }
              // If start == end, it was a single click. 
              // We leave selectionStart set to enter "Click-Click" mode.
          }
      }
  };

  // Touch Move Handler for Dragging on Mobile
  const handleTouchMove = (e: React.TouchEvent) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      if (element && element.hasAttribute('data-r')) {
          const r = parseInt(element.getAttribute('data-r')!);
          const c = parseInt(element.getAttribute('data-c')!);
          handleInteractionMove(r, c);
      }
  }

  const processSelection = (cells: {r: number, c: number, char: string}[]) => {
      if (cells.length > 0) {
          const selectedWord = cells.map(c => c.char).join('');
          const reversedWord = selectedWord.split('').reverse().join('');
          
          const foundForward = wordSearchService.findWord(selectedWord);
          const foundReverse = wordSearchService.findWord(reversedWord);

          if (foundForward || foundReverse) {
              const newFound = new Set(foundCells);
              cells.forEach(cell => newFound.add(`${cell.r}-${cell.c}`));
              setFoundCells(newFound);
          }
      }
  };

  const isSelected = (r: number, c: number) => {
      if (!selectionStart || !selectionEnd) return false;
      const cells = getSelectedCells(selectionStart, selectionEnd);
      return cells.some(cell => cell.r === r && cell.c === c);
  };

  const isFoundCell = (r: number, c: number) => {
      return foundCells.has(`${r}-${c}`);
  }

  const isGameComplete = game && game.words.length > 0 && game.foundWords.length === game.words.length;

  const handleCompleteReset = () => {
      if (!game) return;
      wordSearchService.resetProgress();
      setFoundCells(new Set());
      setSelectionStart(null);
      setSelectionEnd(null);
      setIsDragging(false);
      const startKey = `edu_wordsearch_start_${game.id}_${playerId}`;
      localStorage.removeItem(startKey);
      loadGame();
  };

  const topRanks = useMemo(() => {
      const sorted = [...leaderboard].sort((a, b) => a.timeMs - b.timeMs);
      return sorted.slice(0, 3);
  }, [leaderboard]);

  useEffect(() => {
      if (!game) return;
      const startKey = `edu_wordsearch_start_${game.id}_${playerId}`;
      if (!localStorage.getItem(startKey)) {
          localStorage.setItem(startKey, String(Date.now()));
      }
  }, [game, playerId]);

  useEffect(() => {
      if (!game || !isGameComplete) return;
      const startKey = `edu_wordsearch_start_${game.id}_${playerId}`;
      const startRaw = localStorage.getItem(startKey);
      const startAt = startRaw ? Number(startRaw) : Date.now();
      const timeMs = Math.max(0, Date.now() - startAt);
      const updated = wordSearchService.upsertLeaderboardEntry(game.id, {
          id: playerId,
          name: playerName,
          timeMs,
          finishedAt: new Date().toISOString(),
      });
      setLeaderboard(updated);
  }, [game, isGameComplete, playerId, playerName]);

  // --- Render ---

  if (!game || (isTeacherMode && teacherView === 'builder')) {
      if (!isTeacherMode) {
          return (
              <MysticalWrapper>
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                      <div className="relative">
                          <Search size={80} className="text-violet-400 mb-4 opacity-50 animate-bounce" />
                          <Sparkles className="absolute -top-2 -right-4 text-yellow-300 animate-pulse" />
                      </div>
                      <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-200 to-fuchsia-200 mb-2">아직 마법 퍼즐이 없어요</h2>
                      <p className="text-indigo-200 opacity-80">선생님이 신비한 단어를 숨길 때까지 기다려주세요.</p>
                      <button onClick={onBack} className="mt-8 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">돌아가기</button>
                  </div>
              </MysticalWrapper>
          )
      }

      // Teacher Creation Studio View
      return (
          <MysticalWrapper>
              <div className="flex-1 flex flex-col p-4 overflow-y-auto custom-scrollbar">
                  <header className="flex justify-between items-center mb-8 bg-black/20 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
                      <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                          <Wand2 className="text-yellow-400" /> 단어 마법 생성소
                      </h1>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setTeacherView('game')}
                          className="bg-white/10 text-white px-4 py-2 rounded-xl font-bold hover:bg-white/20"
                        >
                          돌아가기
                        </button>
                        <button onClick={onBack} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-colors">
                            <Home size={20} />
                        </button>
                      </div>
                  </header>

                  <div className="max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Left Panel: Input */}
                      <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/20 flex flex-col gap-6">
                          <div>
                              <h2 className="text-xl font-bold text-violet-200 mb-4 border-b border-white/10 pb-2">1. 마법 설정</h2>
                              
                              <label className="block text-sm font-bold text-indigo-200 mb-2">퍼즐 제목</label>
                              <input 
                                type="text" 
                                value={title} onChange={e => setTitle(e.target.value)}
                                className="w-full bg-black/30 border border-white/20 rounded-xl p-3 text-white placeholder-white/30 focus:ring-2 focus:ring-violet-500 focus:outline-none transition-all"
                                placeholder="예: 신비한 동물 찾기"
                              />
                          </div>

                          <div className="bg-indigo-900/40 p-4 rounded-xl border border-indigo-500/30">
                              <label className="block text-sm font-bold text-indigo-200 mb-2">
                                  AI 단어 추천 <span className="text-xs font-normal opacity-70">(테마를 입력하세요)</span>
                              </label>
                              <div className="flex gap-2 mb-4">
                                  <input 
                                    type="text" 
                                    value={theme} onChange={e => setTheme(e.target.value)}
                                    className="flex-1 bg-black/30 border border-white/20 rounded-xl p-3 text-white placeholder-white/30 focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                    placeholder="예: 우주, 과일, 한국사"
                                  />
                                  <button 
                                    onClick={handleGenerateAI}
                                    disabled={isGenerating}
                                    className="bg-violet-600 text-white font-bold px-4 rounded-xl hover:bg-violet-500 disabled:bg-slate-700 transition-colors flex items-center justify-center min-w-[80px]"
                                  >
                                      {isGenerating ? <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div> : <Wand2 size={20} />}
                                  </button>
                              </div>
                              
                              <div className="flex gap-4">
                                  {[5, 10, 15, 20].map(cnt => (
                                      <label key={cnt} className="flex items-center gap-2 cursor-pointer">
                                          <input 
                                            type="radio" 
                                            name="wordCount" 
                                            checked={aiWordCount === cnt} 
                                            onChange={() => setAiWordCount(cnt)}
                                            className="w-4 h-4 accent-violet-500"
                                          />
                                          <span className="text-sm text-indigo-200">{cnt}개</span>
                                      </label>
                                  ))}
                              </div>
                          </div>

                          <div className="flex-1 flex flex-col">
                              <label className="block text-sm font-bold text-indigo-200 mb-2">단어 목록 (직접 입력 가능)</label>
                              <textarea 
                                value={wordsInput}
                                onChange={e => setWordsInput(e.target.value)}
                                className="flex-1 min-h-[150px] w-full bg-black/30 border border-white/20 rounded-xl p-3 text-white placeholder-white/30 resize-none focus:ring-2 focus:ring-violet-500 focus:outline-none custom-scrollbar"
                                placeholder={`사과\n포도\n바나나\n(AI가 찾은 단어가 여기 나타납니다)`}
                              />
                              <p className="text-xs text-indigo-300 mt-2 text-right">
                                  입력된 단어: {wordsInput.split(/[,\n]+/).filter(w=>w.trim()!=='').length}개
                              </p>
                          </div>
                      </div>

                      {/* Right Panel: Action */}
                      <div className="flex flex-col justify-center gap-6">
                          <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-3xl p-8 shadow-lg border border-white/20 text-center relative overflow-hidden group">
                              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 animate-pulse pointer-events-none"></div>
                              <h2 className="text-2xl font-black text-white mb-4 relative z-10">준비 되셨나요?</h2>
                              <p className="text-indigo-100 mb-8 relative z-10">아이들을 위한 신비한 단어 찾기 퍼즐을<br/>지금 바로 생성합니다.</p>
                              <button 
                                onClick={handleCreate}
                                className="w-full bg-white text-indigo-900 font-black py-4 rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.4)] hover:scale-105 transition-transform active:scale-95 flex items-center justify-center gap-2 text-xl relative z-10"
                              >
                                  <Sparkles size={24} className="text-yellow-500" /> 퍼즐 생성하기
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          </MysticalWrapper>
      );
  }

  // --- Game View ---
  return (
      <MysticalWrapper>
          <div 
            className="flex-1 flex flex-col items-center p-4 font-sans select-none" 
            onMouseUp={handleInteractionEnd}
            onTouchEnd={handleInteractionEnd}
          >
              <header className="w-full max-w-6xl flex justify-between items-center mb-4 z-20">
                  <div className="flex items-center gap-3 bg-black/30 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md">
                      <button onClick={onBack} className="bg-white/10 p-2 rounded-full hover:bg-white/20 text-white transition-colors"><Home size={20}/></button>
                      <h1 className="text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-200 to-cyan-200 drop-shadow-md">
                          {game.title}
                      </h1>
                  </div>
                  <div className="flex items-center gap-2">
                      {isTeacherMode && (
                          <button
                            onClick={handleOpenBuilder}
                            className="bg-violet-500/20 text-violet-200 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-violet-500/40 border border-violet-300/20 transition-colors"
                          >
                            <Wand2 size={18} /> AI 단어 생성
                          </button>
                      )}
                      {isTeacherMode && (
                          <button onClick={handleReset} className="bg-red-500/20 text-red-300 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-red-500/40 border border-red-500/30 transition-colors">
                              <RefreshCcw size={18} /> 게임 종료
                          </button>
                      )}
                      <button onClick={onBack} className="bg-white/10 text-white px-4 py-2 rounded-lg font-bold hover:bg-white/20 border border-white/10 transition-colors">
                          나가기
                      </button>
                  </div>
              </header>

              {/* Rules Banner */}
              <div className="w-full max-w-2xl bg-indigo-900/50 backdrop-blur-sm border border-indigo-500/30 rounded-xl p-3 mb-6 flex items-center justify-center gap-3 text-indigo-200 animate-fade-in-down shadow-lg text-center">
                  <Info size={20} className="text-yellow-400 shrink-0" />
                  <span className="font-bold text-sm sm:text-base">
                      드래그하거나, 시작 글자와 끝 글자를 클릭하세요!
                  </span>
              </div>

              <div className="flex flex-col lg:flex-row gap-8 w-full max-w-7xl items-stretch justify-center h-full pb-8">
                  
                  {/* 3D Grid Board */}
                  <div className="flex-1 flex items-center justify-center perspective-1000 z-10 relative">
                      {/* Success Overlay */}
                      {isGameComplete && (
                          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm rounded-3xl animate-fade-in">
                              <div className="text-center p-8 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-3xl shadow-[0_0_50px_rgba(255,255,255,0.3)] border-4 border-yellow-400 transform scale-110">
                                  <Trophy size={80} className="mx-auto mb-4 text-yellow-300 animate-bounce filter drop-shadow-lg" />
                                  <h2 className="text-4xl font-black text-white mb-2 text-shadow-lg">모든 단어 발견!</h2>
                                  <p className="text-white/90 text-lg mb-6">정말 대단해요! 훌륭한 관찰력입니다.</p>
                                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                      <button
                                        onClick={handleCompleteReset}
                                        className="bg-white text-violet-700 font-black px-8 h-12 rounded-full shadow-xl hover:scale-105 transition-transform flex items-center justify-center gap-2 w-full sm:w-auto"
                                      >
                                          <Check size={24} /> 완료
                                      </button>
                                      <button
                                        onClick={onBack}
                                        className="bg-gray-100 text-gray-900 font-bold px-8 h-12 rounded-full shadow-md hover:bg-gray-200 transition-colors w-full sm:w-auto"
                                      >
                                          나가기
                                      </button>
                                  </div>
                              </div>
                          </div>
                      )}

                      <div 
                        className="bg-white/5 backdrop-blur-md p-6 md:p-8 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 transform rotate-x-12 transition-transform duration-500 hover:rotate-x-0"
                        style={{ transformStyle: 'preserve-3d', transform: 'rotateX(5deg)' }}
                      >
                          <div 
                            className="grid gap-2 md:gap-3 touch-none"
                            style={{ 
                                gridTemplateColumns: `repeat(${game.size}, minmax(0, 1fr))`
                            }}
                            onMouseLeave={() => { if(isDragging) setSelectionEnd(selectionStart); }} // Reset end to start if dragging out, or handle gracefully
                            onTouchMove={handleTouchMove}
                          >
                              {game.grid.map((row, r) => (
                                  row.map((char, c) => {
                                      const active = isSelected(r, c);
                                      const found = isFoundCell(r, c);
                                      const isStart = selectionStart?.r === r && selectionStart?.c === c;
                                      
                                      return (
                                          <div
                                            key={`${r}-${c}`}
                                            data-r={r}
                                            data-c={c}
                                            onMouseDown={(e) => handleInteractionStart(r, c, e)}
                                            onMouseEnter={() => handleInteractionMove(r, c)}
                                            onTouchStart={(e) => handleInteractionStart(r, c, e)}
                                            className={`
                                                w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 flex items-center justify-center font-bold text-2xl sm:text-4xl rounded-xl cursor-pointer transition-all duration-200 select-none
                                                ${isStart && !selectionEnd
                                                    ? 'bg-yellow-400 text-purple-900 scale-110 shadow-[0_0_15px_#facc15] z-30 border-2 border-white animate-pulse' // Click-Start state
                                                    : active 
                                                        ? 'bg-yellow-400 text-purple-900 scale-110 shadow-[0_0_15px_#facc15] z-20 border-2 border-white' 
                                                        : found 
                                                            ? 'bg-green-500 text-white border-2 border-green-300 shadow-[0_0_10px_#4ade80] scale-105 z-10'
                                                            : 'bg-white/10 text-indigo-100 hover:bg-white/20 border border-white/5'}
                                            `}
                                          >
                                              {char}
                                          </div>
                                      )
                                  })
                              ))}
                          </div>
                      </div>
                  </div>

                  {/* Word List & Tools */}
                  <div className="w-full lg:w-96 bg-black/40 backdrop-blur-xl rounded-3xl p-6 border border-white/10 flex flex-col shadow-2xl z-20">
                      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2 border-b border-white/10 pb-3">
                          <Trophy className="text-yellow-400" /> 찾아야 할 단어
                          <span className="text-sm font-normal text-gray-400 ml-auto">{game.foundWords.length} / {game.words.length}</span>
                      </h2>
                      {topRanks.length > 0 && (
                          <div className="mb-4 bg-white/5 border border-white/10 rounded-2xl p-4">
                              <div className="text-sm font-bold text-indigo-200 mb-2">금·은·동</div>
                              <div className="space-y-2">
                                  {topRanks.map((r, idx) => (
                                      <div key={r.id} className="flex items-center justify-between bg-black/30 rounded-xl px-3 py-2 text-sm text-white">
                                          <div className="flex items-center gap-2 font-bold">
                                              <span className={idx === 0 ? 'animate-bounce' : idx === 1 ? 'animate-pulse' : 'animate-fade-in'}>{['🥇','🥈','🥉'][idx]}</span>
                                              <span>{r.name}</span>
                                          </div>
                                          <span className="text-indigo-200 font-mono">{formatTime(r.timeMs)}</span>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                      
                      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                          <div className="flex flex-wrap gap-2">
                              {game.words.map(word => {
                                  const isFound = game.foundWords.includes(word);
                                  return (
                                      <div 
                                        key={word} 
                                        className={`
                                            px-4 py-2 rounded-full font-bold text-lg border transition-all duration-500 flex items-center gap-2
                                            ${isFound 
                                                ? 'bg-green-500/20 border-green-400 text-green-300 shadow-[0_0_10px_rgba(74,222,128,0.3)] order-last opacity-70' 
                                                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}
                                        `}
                                      >
                                          {word}
                                          {isFound && <Check size={18} className="text-green-400 animate-scale-in"/>}
                                      </div>
                                  )
                              })}
                          </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-white/10">
                          <a 
                            href="https://ko.dict.naver.com/#/main" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-indigo-500/30 group"
                          >
                              <BookOpen size={20} className="group-hover:scale-110 transition-transform" />
                              <span>마법 사전 펼치기</span>
                              <ExternalLink size={14} className="opacity-50" />
                          </a>
                          <p className="text-xs text-indigo-300 text-center mt-2 opacity-70">
                              모르는 단어의 뜻을 찾아보세요!
                          </p>
                      </div>
                  </div>
              </div>
          </div>
      </MysticalWrapper>
  );
};
