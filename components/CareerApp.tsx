
import React, { useState } from 'react';
import { Home, Trophy, Sparkles, User, RefreshCcw } from 'lucide-react';
import * as careerService from '../services/careerService';
import { Career } from '../types';

interface CareerAppProps {
  onBack: () => void;
}

type Mode = 'lobby' | 'tournament' | 'winner';

// Shared Wrapper for 3D Mystical Theme (Consistent with BingoApp)
const MysticalWrapper: React.FC<{children: React.ReactNode}> = ({children}) => (
    <div className="min-h-[calc(100vh-6rem)] bg-slate-900 flex flex-col font-sans relative overflow-hidden text-white">
        {/* Background FX */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900 via-slate-950 to-black opacity-80 pointer-events-none"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 animate-pulse pointer-events-none"></div>
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full p-4">
            {children}
        </div>
    </div>
);

export const CareerApp: React.FC<CareerAppProps> = ({ onBack }) => {
  const [mode, setMode] = useState<Mode>('lobby');
  const [candidates, setCandidates] = useState<Career[]>([]);
  const [currentRound, setCurrentRound] = useState<{ left: Career, right: Career, remaining: Career[], nextRound: Career[] } | null>(null);
  const [winner, setWinner] = useState<Career | null>(null);
  const [roundName, setRoundName] = useState('16강');

  const startGame = () => {
      const initial = careerService.startTournament(16); // 16 items
      setCandidates(initial);
      setupNextMatch(initial, []);
      setMode('tournament');
      setRoundName('16강');
  };

  const setupNextMatch = (pool: Career[], winners: Career[]) => {
      // If pool is empty, it means round finished
      if (pool.length === 0) {
          if (winners.length === 1) {
              setWinner(winners[0]);
              setMode('winner');
              return;
          }
          // Start next round with winners
          const newPool = [...winners];
          // Determine round name
          const rName = newPool.length === 4 ? '4강' : newPool.length === 2 ? '결승' : `${newPool.length}강`;
          setRoundName(rName);
          
          const left = newPool[0];
          const right = newPool[1];
          const remaining = newPool.slice(2);
          
          setCurrentRound({
              left,
              right,
              remaining,
              nextRound: []
          });
      } else {
          // Continue current round
          const left = pool[0];
          const right = pool[1];
          const remaining = pool.slice(2);
          
          setCurrentRound({
              left,
              right,
              remaining,
              nextRound: winners
          });
      }
  };

  const handleSelect = (selected: Career) => {
      if (!currentRound) return;
      const newNextRound = [...currentRound.nextRound, selected];
      setupNextMatch(currentRound.remaining, newNextRound);
  };

  // --- Render ---

  if (mode === 'lobby') {
      return (
          <MysticalWrapper>
              <div className="bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-3xl shadow-[0_0_30px_rgba(124,58,237,0.3)] w-full max-w-md text-center space-y-8 animate-fade-in-up">
                  <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-5 rounded-full w-24 h-24 flex items-center justify-center mx-auto shadow-lg mb-2">
                      <Trophy size={48} className="text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-orange-200 mb-2">진로 월드컵</h1>
                    <p className="text-indigo-200">나의 운명을 찾아 떠나는 신비한 여행<br/><span className="text-sm opacity-70">당신의 잠재력을 깨워보세요</span></p>
                  </div>
                  
                  <button 
                    onClick={startGame}
                    className="w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all bg-indigo-600 text-white shadow-lg hover:bg-indigo-500 active:scale-95"
                  >
                      게임 시작하기 <Sparkles size={20} />
                  </button>

                  <button onClick={onBack} className="text-slate-400 hover:text-white underline text-sm">나가기</button>
              </div>
          </MysticalWrapper>
      );
  }

  if (mode === 'tournament' && currentRound) {
      return (
          <MysticalWrapper>
              <div className="w-full max-w-5xl flex flex-col h-full">
                  <header className="text-center mb-8 relative">
                      <div className="absolute left-0 top-0">
                          <button onClick={onBack} className="bg-white/10 p-2 rounded-full hover:bg-white/20"><Home size={20}/></button>
                      </div>
                      <h2 className="text-3xl font-black text-white drop-shadow-md animate-pulse">{roundName}</h2>
                      <p className="text-indigo-300">직관적으로 더 끌리는 직업을 선택하세요!</p>
                  </header>

                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 items-stretch">
                      {/* Left Choice */}
                      <button 
                        onClick={() => handleSelect(currentRound.left)}
                        className="group relative bg-gradient-to-br from-indigo-800 to-blue-900 rounded-3xl p-8 border-4 border-transparent hover:border-yellow-400 hover:shadow-[0_0_40px_rgba(250,204,21,0.5)] transition-all flex flex-col items-center justify-center text-center gap-6"
                      >
                          <div className="text-8xl group-hover:scale-110 transition-transform filter drop-shadow-lg">
                              {currentRound.left.icon || '🎓'}
                          </div>
                          <div>
                              <h3 className="text-3xl font-bold text-white mb-2">{currentRound.left.name}</h3>
                              <p className="text-indigo-200 text-sm">{currentRound.left.description}</p>
                          </div>
                          <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-20 transition-opacity rounded-2xl"></div>
                      </button>

                      {/* VS Badge */}
                      <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none hidden md:block">
                          <div className="bg-red-600 text-white font-black text-2xl w-16 h-16 rounded-full flex items-center justify-center border-4 border-slate-900 shadow-xl skew-x-[-10deg]">
                              VS
                          </div>
                      </div>

                      {/* Right Choice */}
                      <button 
                        onClick={() => handleSelect(currentRound.right)}
                        className="group relative bg-gradient-to-br from-purple-800 to-pink-900 rounded-3xl p-8 border-4 border-transparent hover:border-yellow-400 hover:shadow-[0_0_40px_rgba(250,204,21,0.5)] transition-all flex flex-col items-center justify-center text-center gap-6"
                      >
                          <div className="text-8xl group-hover:scale-110 transition-transform filter drop-shadow-lg">
                              {currentRound.right.icon || '🚀'}
                          </div>
                          <div>
                              <h3 className="text-3xl font-bold text-white mb-2">{currentRound.right.name}</h3>
                              <p className="text-purple-200 text-sm">{currentRound.right.description}</p>
                          </div>
                          <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-20 transition-opacity rounded-2xl"></div>
                      </button>
                  </div>
              </div>
          </MysticalWrapper>
      );
  }

  if (mode === 'winner' && winner) {
      return (
          <MysticalWrapper>
              <div className="text-center animate-fade-in-up max-w-2xl w-full bg-black/40 backdrop-blur-md p-10 rounded-[3rem] border border-white/20 shadow-2xl relative">
                  {/* Confetti / Glow */}
                  <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/20 to-transparent rounded-[3rem] pointer-events-none"></div>
                  
                  <h2 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-orange-500 mb-8 drop-shadow-sm">
                      🏆 당신의 선택은?
                  </h2>

                  <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-1 rounded-[2rem] shadow-xl inline-block mb-8 transform hover:scale-105 transition-transform duration-500">
                      <div className="bg-slate-900 rounded-[1.9rem] p-10 flex flex-col items-center">
                          <div className="text-[8rem] mb-4 animate-bounce filter drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]">
                              {winner.icon || '🌟'}
                          </div>
                          <h3 className="text-5xl font-bold text-white mb-2">{winner.name}</h3>
                          <div className="bg-white/20 px-4 py-1 rounded-full text-sm font-bold text-indigo-200 mb-4">
                              {careerService.INTELLIGENCE_DATA[winner.intelligence]?.name}
                          </div>
                          <p className="text-lg text-slate-300 max-w-md">{winner.description}</p>
                      </div>
                  </div>

                  <div className="flex flex-col gap-4 justify-center relative z-10 w-full">
                      <div className="flex flex-col sm:flex-row gap-4 justify-center w-full">
                          <button onClick={startGame} className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 h-12 rounded-full font-bold transition-colors w-full sm:w-auto">
                              <RefreshCcw size={20} /> 다시하기
                          </button>
                          <button
                            onClick={onBack}
                            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 h-12 rounded-full font-bold shadow-lg transition-colors w-full sm:w-auto"
                          >
                              <Home size={20} /> 메인으로
                          </button>
                      </div>
                      <div className="flex justify-center w-full">
                          <a
                            href="https://www.career.go.kr/cloud/j/main/home"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 bg-gray-100 text-gray-900 px-8 h-12 rounded-full font-bold shadow-md hover:bg-gray-200 transition-colors w-full sm:w-auto"
                          >
                              <User size={20} /> 주니어 커리어넷 탐색하기
                          </a>
                      </div>
                  </div>
              </div>
          </MysticalWrapper>
      );
  }

  return <div>Loading...</div>;
};
