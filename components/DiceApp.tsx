
import React, { useState, useEffect, useRef } from 'react';
import { Home, Dices, RefreshCcw, Sparkles } from 'lucide-react';

interface DiceAppProps {
  onBack: () => void;
}

interface DiceProps {
  value: number;
  isRolling: boolean;
  index: number;
}

const MysticalDice: React.FC<DiceProps> = ({ value, isRolling, index }) => {
  // Calculate final rotation based on value to show the correct face front
  // 1: front, 6: back, 2: right, 5: left, 3: top, 4: bottom
  const getRotation = (val: number) => {
      switch(val) {
          case 1: return { x: 0, y: 0 };
          case 6: return { x: 180, y: 0 };
          case 2: return { x: 0, y: -90 };
          case 5: return { x: 0, y: 90 };
          case 3: return { x: -90, y: 0 };
          case 4: return { x: 90, y: 0 };
          default: return { x: 0, y: 0 };
      }
  };

  const targetRot = getRotation(value);
  
  // Add random full spins for rolling effect
  // If rolling, we just spin wildly. If settled, we go to target.
  // To ensure it spins, we add multiples of 360 to the target.
  const [rotation, setRotation] = useState({ x: 0, y: 0 });

  useEffect(() => {
      if (isRolling) {
          // Spin wildly
          setRotation({ 
              x: 720 + Math.random() * 360, 
              y: 720 + Math.random() * 360 
          });
      } else {
          // Land on target (normalize close to 0 but keep accumulated rotation for smoothness if needed, 
          // but for this simple version, resetting to base mod 360 is fine or just setting target)
          // To make it look like it landed from the spin, we ideally calculate the nearest multiple of 360.
          // For simplicity here: explicit set.
          setRotation(targetRot);
      }
  }, [value, isRolling]);

  const renderDots = (num: number) => {
      const dotPositions: Record<number, number[]> = {
          1: [4],
          2: [2, 6],
          3: [2, 4, 6],
          4: [0, 2, 6, 8],
          5: [0, 2, 4, 6, 8],
          6: [0, 2, 3, 5, 6, 8]
      };
      const dots = dotPositions[num] || [];
      
      return (
          <div className="grid grid-cols-3 grid-rows-3 gap-1 w-full h-full p-2 sm:p-4">
              {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-center">
                      {dots.includes(i) && (
                          <div className="w-full h-full rounded-full bg-cyan-300 shadow-[0_0_10px_#22d3ee] animate-pulse"></div>
                      )}
                  </div>
              ))}
          </div>
      );
  };

  return (
      <div className="relative w-40 h-40 sm:w-56 sm:h-56 perspective-1000 group">
          <div 
            className="w-full h-full relative transition-transform duration-[800ms] ease-out preserve-3d"
            style={{ 
                transformStyle: 'preserve-3d',
                transform: isRolling 
                    ? `rotateX(${rotation.x * 5}deg) rotateY(${rotation.y * 5}deg)` 
                    : `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`
            }}
          >
              {[1, 2, 3, 4, 5, 6].map((num) => {
                  let transform = '';
                  // TranslateZ is half the size of the dice (w-40 = 160px -> 80px)
                  // We need to use responsive values, so we use percentage or calc.
                  // Since Tailwind classes are fixed, we'll assume the SM size for calc or use a CSS variable.
                  // Simpler: Just stick to the larger size transform.
                  const size = 224; // 56 * 4 (tailwind units) ~ 224px. Half is 112px.
                  const smSize = 160; // 40 * 4 = 160px. Half is 80px.
                  
                  // Use CSS variable for translateZ depth to handle responsive size
                  // Or just use the smaller one for safety, gaps are okay for "mystical floating parts"
                  
                  switch(num) {
                      case 1: transform = 'rotateY(0deg) translateZ(var(--depth))'; break;
                      case 6: transform = 'rotateY(180deg) translateZ(var(--depth))'; break;
                      case 2: transform = 'rotateY(90deg) translateZ(var(--depth))'; break;
                      case 5: transform = 'rotateY(-90deg) translateZ(var(--depth))'; break;
                      case 3: transform = 'rotateX(90deg) translateZ(var(--depth))'; break;
                      case 4: transform = 'rotateX(-90deg) translateZ(var(--depth))'; break;
                  }

                  return (
                      <div 
                        key={num}
                        className="absolute inset-0 bg-indigo-900/80 border-2 border-indigo-400/50 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-[inset_0_0_30px_rgba(79,70,229,0.5)]"
                        style={{ transform }}
                      >
                          {/* Inner glowing core look */}
                          <div className="absolute inset-2 border border-indigo-300/30 rounded-xl"></div>
                          {renderDots(num)}
                          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none rounded-2xl"></div>
                      </div>
                  );
              })}
          </div>
          {/* Floor Glow Shadow */}
          <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-3/4 h-8 bg-black/40 blur-xl rounded-[100%]"></div>
      </div>
  );
};

export const DiceApp: React.FC<DiceAppProps> = ({ onBack }) => {
  const [diceCount, setDiceCount] = useState<1 | 2>(1);
  const [values, setValues] = useState<number[]>([1]);
  const [isRolling, setIsRolling] = useState(false);

  const rollDice = () => {
    if (isRolling) return;
    setIsRolling(true);
    
    // Play sound if possible (omitted for simplicity, visual only)
    
    setTimeout(() => {
      const newValues = Array(diceCount).fill(0).map(() => Math.floor(Math.random() * 6) + 1);
      setValues(newValues);
      setIsRolling(false);
    }, 1000); // Longer duration for the heavy 3d spin
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Mystical Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900 via-slate-900 to-black opacity-80"></div>
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 animate-pulse"></div>
      
      <div className="absolute top-4 left-4 z-10">
          <button onClick={onBack} className="bg-white/10 p-3 rounded-full shadow-md text-indigo-300 hover:text-white hover:bg-white/20 transition-colors backdrop-blur-sm">
              <Home size={24} />
          </button>
      </div>

      <div className="text-center mb-16 z-10">
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-indigo-400 mb-4 flex items-center justify-center gap-4 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]">
              <Sparkles size={40} className="text-yellow-400 animate-spin-slow" /> 
              운명의 주사위
              <Sparkles size={40} className="text-yellow-400 animate-spin-slow" />
          </h1>
          <p className="text-indigo-200 text-lg opacity-80">버튼을 눌러 운명을 확인하세요!</p>
      </div>

      {/* Dice Container with CSS Variable for Depth */}
      <div 
        className="flex flex-col sm:flex-row gap-16 sm:gap-24 mb-20 items-center justify-center min-h-[300px] z-10" 
        onClick={rollDice}
        style={{ '--depth': '112px' } as React.CSSProperties} // Mobile: 80px, Desktop: 112px handled via media query ideally, hardcoded larger here for "double size" request
      >
          {/* Override css var for mobile via style tag injection or just use inline logic in component. 
              For simplicity, we assume the component uses the Tailwind responsive classes `w-40 sm:w-56`.
              w-40 = 10rem = 160px -> depth 80px
              w-56 = 14rem = 224px -> depth 112px
          */}
          <style>{`
            @media (max-width: 640px) {
                .preserve-3d { --depth: 80px; }
            }
            @media (min-width: 641px) {
                .preserve-3d { --depth: 112px; }
            }
          `}</style>

          {Array(diceCount).fill(0).map((_, i) => (
              <MysticalDice 
                key={i} 
                index={i}
                value={values[i] || 1} 
                isRolling={isRolling} 
              />
          ))}
      </div>

      <div className="flex flex-col gap-6 w-full max-w-sm z-10">
          <div className="text-center">
               <span className="text-3xl font-bold text-white bg-white/10 px-8 py-3 rounded-full shadow-[0_0_20px_rgba(100,100,255,0.3)] backdrop-blur-md border border-white/20">
                   합계: <span className="text-cyan-300 ml-2 text-4xl drop-shadow-md">{isRolling ? '?' : values.reduce((a, b) => a + b, 0)}</span>
               </span>
          </div>

          <button 
            onClick={rollDice}
            disabled={isRolling}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-5 rounded-2xl shadow-[0_0_30px_rgba(99,102,241,0.6)] transform transition-all active:scale-95 flex items-center justify-center gap-3 text-2xl border-t border-white/20"
          >
             <RefreshCcw size={28} className={isRolling ? 'animate-spin' : ''} />
             {isRolling ? '운명을 굴리는 중...' : '주사위 굴리기'}
          </button>
          
          <div className="flex bg-slate-800/50 p-1 rounded-xl shadow-inner backdrop-blur-sm border border-slate-700">
              <button 
                onClick={() => { setDiceCount(1); setValues([1]); }}
                className={`flex-1 py-3 rounded-lg font-bold transition-all ${diceCount === 1 ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                  주사위 1개
              </button>
              <button 
                onClick={() => { setDiceCount(2); setValues([1, 1]); }}
                className={`flex-1 py-3 rounded-lg font-bold transition-all ${diceCount === 2 ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                  주사위 2개
              </button>
          </div>
      </div>
    </div>
  );
};
