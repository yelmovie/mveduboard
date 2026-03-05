
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Home, Grid, Shuffle, Save, Users, Settings, Eraser, CheckSquare, RefreshCcw, Sparkles } from 'lucide-react';
import * as seatService from '../services/seatService';
import * as studentService from '../services/studentService';
import { SeatLayout, SeatStudent } from '../types';

interface SeatAppProps {
  onBack: () => void;
  isTeacherMode: boolean;
  studentName?: string | null;
}

const SeatConfetti: React.FC = () => {
  const colors = ['#F59E0B', '#EF4444', '#10B981', '#6366F1', '#EC4899', '#3B82F6', '#F97316'];
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {Array.from({ length: 60 }).map((_, i) => (
        <div
          key={i}
          className="absolute animate-seat-confetti"
          style={{
            left: `${Math.random() * 100}%`,
            top: '-10px',
            width: `${Math.random() * 8 + 4}px`,
            height: `${Math.random() * 5 + 3}px`,
            backgroundColor: colors[i % colors.length],
            borderRadius: '2px',
            transform: `rotate(${Math.random() * 360}deg)`,
            animationDelay: `${Math.random() * 0.8}s`,
            animationDuration: `${2 + Math.random() * 2}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes seat-confetti { 0% { transform: translateY(0) rotate(0deg); opacity:1; } 100% { transform: translateY(100vh) rotate(720deg); opacity:0; } }
        .animate-seat-confetti { animation: seat-confetti linear forwards; }
      `}</style>
    </div>
  );
};

export const SeatApp: React.FC<SeatAppProps> = ({ onBack, isTeacherMode, studentName }) => {
  const [layout, setLayout] = useState<SeatLayout | null>(null);
  
  // Setup State
  const [isEditing, setIsEditing] = useState(false);
  const [rows, setRows] = useState(5);
  const [cols, setCols] = useState(8);
  const [nameInput, setNameInput] = useState('');
  
  // Seat configuration map (true = desk, false = aisle)
  const [tempSeatMap, setTempSeatMap] = useState<boolean[]>([]);

  // Animation state
  const [isShuffling, setIsShuffling] = useState(false);
  const [shuffleDisplay, setShuffleDisplay] = useState<(SeatStudent | null)[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [revealedSeats, setRevealedSeats] = useState<Set<number>>(new Set());
  const shuffleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);

  const currentStudentName = studentName?.trim();

  useEffect(() => {
    const init = async () => {
      try { await studentService.fetchRosterFromDb(); } catch {}
      try { await seatService.loadSeatDataAsync(); } catch {}
      const saved = seatService.getSeatLayout();
      if (saved) {
          setLayout(saved);
          setRows(saved.rows);
          setCols(saved.cols);
          setTempSeatMap(saved.seatMap || Array(saved.rows * saved.cols).fill(true));
      } else {
          setRows(5);
          setCols(8);
          setTempSeatMap(Array(40).fill(true));
          setIsEditing(true); 
      }
    };
    init();
  }, []);

  // Update temp seat map when dimensions change
  useEffect(() => {
      const total = rows * cols;
      if (tempSeatMap.length !== total) {
          const newMap = Array(total).fill(true);
          setTempSeatMap(newMap); 
      }
  }, [rows, cols]);

  const runShuffleAnimation = useCallback((finalAssignments: (SeatStudent | null)[], names: string[]) => {
    setIsShuffling(true);
    setIsEditing(false);
    setRevealedSeats(new Set());
    setShowConfetti(false);

    const totalSlots = rows * cols;
    const validMap = tempSeatMap.length === totalSlots ? tempSeatMap : Array(totalSlots).fill(true);
    const seatIndices = validMap.map((v, i) => v ? i : -1).filter(i => i >= 0);

    let tick = 0;
    const maxTicks = 20;
    const interval = setInterval(() => {
      tick++;
      const scrambled: (SeatStudent | null)[] = Array(totalSlots).fill(null);
      const shuffledNames = [...names].sort(() => Math.random() - 0.5);
      let ni = 0;
      for (const si of seatIndices) {
        if (ni < shuffledNames.length) {
          scrambled[si] = { id: '', name: shuffledNames[ni++] };
        }
      }
      setShuffleDisplay(scrambled);

      if (tick >= maxTicks) {
        clearInterval(interval);
        setShuffleDisplay(finalAssignments);

        let revealIdx = 0;
        const revealOrder = seatIndices.filter(i => finalAssignments[i] !== null).sort(() => Math.random() - 0.5);
        const revealInterval = setInterval(() => {
          if (revealIdx >= revealOrder.length) {
            clearInterval(revealInterval);
            setIsShuffling(false);
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 3500);
            return;
          }
          setRevealedSeats(prev => {
            const next = new Set(prev);
            const batch = Math.min(3, revealOrder.length - revealIdx);
            for (let b = 0; b < batch; b++) {
              next.add(revealOrder[revealIdx + b]);
            }
            return next;
          });
          revealIdx += 3;
        }, 120);
      }
    }, 100);
  }, [rows, cols, tempSeatMap]);

  const handleShuffle = () => {
    let names: string[];

    if (!nameInput.trim()) {
        if (layout) {
            names = layout.assignments.filter(s => s !== null).map(s => s!.name);
        } else {
            alert('학생 명단을 입력해주세요.');
            return;
        }
    } else {
        names = nameInput.split(/[\n,]+/).map(s => s.trim()).filter(s => s !== '');
    }

    const availableSeats = tempSeatMap.filter(s => s).length;
    if (names.length > availableSeats) {
        alert(`학생 수(${names.length}명)가 배치 가능한 자리(${availableSeats}석)보다 많습니다!`);
        return;
    }

    if (layout) {
      seatService.saveHistory(layout);
    }

    const finalAssignments = seatService.shuffleSeats(names, rows, cols, tempSeatMap);
    const newLayout = seatService.saveSeatLayout(rows, cols, finalAssignments, tempSeatMap);
    setLayout(newLayout);

    runShuffleAnimation(finalAssignments, names);
  };

  const handleEdit = () => {
    setIsEditing(true);
    if (layout) {
        // Pre-fill names
        const names = layout.assignments.filter(s => s !== null).map(s => s!.name).join('\n');
        setNameInput(names);
        setTempSeatMap(layout.seatMap || Array(layout.rows * layout.cols).fill(true));
    }
  };

  const handleLoadRoster = async () => {
      if(nameInput && !confirm('현재 입력된 명단이 삭제되고 학급 명부에서 새로 불러옵니다. 계속하시겠습니까?')) return;
      try { await studentService.fetchRosterFromDb(); } catch {}
      const students = studentService.getRoster();
      const names = students.map(s => s.name).join('\n');
      setNameInput(names);
  }

  const toggleSeat = (index: number) => {
      const newMap = [...tempSeatMap];
      newMap[index] = !newMap[index];
      setTempSeatMap(newMap);
  };

  const handleSeatDragStart = (e: React.DragEvent, idx: number) => {
    if (!layout || isShuffling) return;
    const seatStudent = layout.assignments[idx];
    if (!seatStudent) return;
    setDragSourceIndex(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
    e.dataTransfer.setData('application/json', JSON.stringify(seatStudent));
  };

  const handleSeatDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleSeatDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (dragSourceIndex === null || !layout || isShuffling) return;
    const seatMap = layout.seatMap || Array(layout.rows * layout.cols).fill(true);
    if (!seatMap[targetIdx]) return;
    const newAssignments = [...layout.assignments];
    const src = newAssignments[dragSourceIndex];
    const tgt = newAssignments[targetIdx];
    newAssignments[dragSourceIndex] = tgt;
    newAssignments[targetIdx] = src;
    const newLayout = seatService.saveSeatLayout(layout.rows, layout.cols, newAssignments, seatMap);
    setLayout(newLayout);
    setDragSourceIndex(null);
  };

  const handleSeatDragEnd = () => {
    setDragSourceIndex(null);
  };

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col font-sans">
      <header className="bg-white shadow-sm p-4 flex justify-between items-center sticky top-0 z-10">
         <div className="flex items-center gap-3">
             <button onClick={onBack} className="bg-gray-100 p-2 rounded-full text-gray-500 hover:bg-gray-200"><Home size={20}/></button>
             <h1 className="font-bold text-amber-900 text-xl flex items-center gap-2"><Grid /> 자리 배치도</h1>
         </div>
         {isTeacherMode && (
             <div className="flex gap-2">
                 {isEditing ? (
                     <button onClick={handleShuffle} className="bg-amber-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-amber-600 shadow-md">
                         <Shuffle size={18} /> 배치 및 저장
                     </button>
                 ) : (
                     <button onClick={handleEdit} className="bg-white border border-gray-300 text-gray-600 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-gray-50 shadow-sm">
                         <Settings size={18} /> 설정 변경
                     </button>
                 )}
             </div>
         )}
      </header>

      <main className="flex-1 p-4 md:p-8 overflow-auto">
         {isTeacherMode && isEditing ? (
             <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
                 {/* Setup Panel */}
                 <div className="lg:w-80 shrink-0 bg-white p-6 rounded-2xl shadow-lg border-t-8 border-amber-500 h-fit">
                     <h2 className="text-xl font-bold mb-6 text-gray-800">자리 배치 설정</h2>
                     
                     <div className="grid grid-cols-2 gap-4 mb-6">
                         <div>
                             <label className="block text-sm font-bold text-gray-600 mb-1">가로 (열)</label>
                             <input type="number" value={cols} onChange={e => setCols(Math.max(1, parseInt(e.target.value)))} className="w-full border rounded-lg p-2" min="1" max="10"/>
                         </div>
                         <div>
                             <label className="block text-sm font-bold text-gray-600 mb-1">세로 (행)</label>
                             <input type="number" value={rows} onChange={e => setRows(Math.max(1, parseInt(e.target.value)))} className="w-full border rounded-lg p-2" min="1" max="10"/>
                         </div>
                     </div>

                     <div className="mb-6">
                         <div className="flex justify-between items-center mb-1">
                            <label className="block text-sm font-bold text-gray-600">학생 명단</label>
                            <button 
                                onClick={handleLoadRoster}
                                className="text-xs flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-1 rounded hover:bg-amber-200 font-bold transition-colors"
                            >
                                <RefreshCcw size={10} /> 학급 명부
                            </button>
                         </div>
                         <textarea 
                            value={nameInput}
                            onChange={e => setNameInput(e.target.value)}
                            className="w-full h-48 border rounded-lg p-3 resize-none focus:ring-2 focus:ring-amber-500"
                            placeholder="김철수&#10;이영희&#10;박민수..."
                         />
                         <p className="text-right text-xs text-gray-400 mt-1">
                             현재인원: {nameInput.split(/[\n,]+/).filter(s=>s.trim()).length}명
                         </p>
                     </div>
                     
                     <div className="bg-amber-50 p-4 rounded-xl text-amber-800 text-xs mb-4">
                         💡 오른쪽 그리드의 칸을 클릭하여 책상을 놓을지(흰색), 통로로 비울지(회색) 선택하세요.
                     </div>
                 </div>

                 {/* Grid Editor */}
                 <div className="flex-1 flex flex-col items-center justify-center bg-gray-200/50 rounded-2xl border-2 border-dashed border-gray-300 p-8 min-h-[500px]">
                     <div className="w-full bg-black/80 text-white text-center py-2 rounded-lg mb-8 max-w-md shadow-md">
                         교탁 / 칠판 (Click to Toggle Seats)
                     </div>
                     <div 
                        className="grid gap-2 w-full max-w-4xl"
                        style={{ 
                            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` 
                        }}
                     >
                         {Array.from({ length: rows * cols }).map((_, idx) => {
                             const isActive = tempSeatMap[idx];
                             return (
                                 <button 
                                    key={idx} 
                                    onClick={() => toggleSeat(idx)}
                                    className={`
                                        aspect-[4/3] rounded-xl flex flex-col items-center justify-center p-2 shadow-sm transition-all
                                        ${isActive 
                                            ? 'bg-white border-2 border-amber-400 hover:bg-amber-50' 
                                            : 'bg-gray-300/50 border-2 border-transparent hover:bg-gray-300'}
                                    `}
                                 >
                                     {isActive ? (
                                         <CheckSquare className="text-amber-500 opacity-50" />
                                     ) : (
                                         <Eraser className="text-gray-400 opacity-50" />
                                     )}
                                 </button>
                             );
                         })}
                     </div>
                 </div>
             </div>
         ) : (
             <div className="max-w-6xl mx-auto">
                 {showConfetti && <SeatConfetti />}
                 {layout ? (
                     <div className="flex flex-col items-center">
                         <div className="w-full bg-black/80 text-white text-center py-2 rounded-lg mb-8 max-w-md shadow-md">
                             교탁 / 칠판
                         </div>
                         {isTeacherMode && !isShuffling && (
                           <p className="text-sm text-amber-700 mb-4 font-medium">학생 이름을 드래그하여 자리 변경</p>
                         )}

                         {isShuffling && (
                           <div className="mb-6 text-center">
                             <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-6 py-3 rounded-full font-bold text-lg shadow-md animate-pulse">
                               <Sparkles className="text-amber-500" size={24} /> 자리 배치 중...
                             </div>
                           </div>
                         )}
                         
                         <div 
                            className="grid gap-4 md:gap-6 w-full max-w-5xl"
                            style={{ 
                                gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))` 
                            }}
                         >
                            {(isShuffling ? shuffleDisplay : layout.assignments).map((seatStudent, idx) => {
                                 const isSeat = layout.seatMap ? layout.seatMap[idx] : true;
                                 const isCurrentSeat =
                                   !isTeacherMode &&
                                   !!currentStudentName &&
                                   seatStudent?.name === currentStudentName;
                                 
                                 if (!isSeat) {
                                     return <div key={idx} className="aspect-[4/3]"></div>;
                                 }

                                 const isRevealed = !isShuffling || revealedSeats.has(idx);
                                 const isJustRevealed = isShuffling && revealedSeats.has(idx);

                                 const isDraggable = isTeacherMode && !isShuffling && !!seatStudent;
                                 const isDragging = dragSourceIndex === idx;

                                 return (
                                     <div 
                                        key={idx} 
                                        draggable={isDraggable}
                                        onDragStart={isDraggable ? (e) => handleSeatDragStart(e, idx) : undefined}
                                        onDragOver={isTeacherMode && !isShuffling ? handleSeatDragOver : undefined}
                                        onDrop={isTeacherMode && !isShuffling ? (e) => handleSeatDrop(e, idx) : undefined}
                                        onDragEnd={handleSeatDragEnd}
                                        className={`
                                            aspect-[4/3] rounded-xl flex flex-col items-center justify-center p-2 shadow-sm border-b-4 transition-all duration-300
                                        ${seatStudent ? 'bg-white border-amber-200' : 'bg-white/50 border-gray-200 border-dashed'}
                                        ${isCurrentSeat ? 'ring-4 ring-sky-300 bg-sky-100 border-sky-400 shadow-md' : ''}
                                        ${isJustRevealed ? 'scale-110 ring-4 ring-amber-400 shadow-lg bg-amber-50 border-amber-400' : ''}
                                        ${isShuffling && !isRevealed && seatStudent ? 'bg-amber-100/80' : ''}
                                        ${isDraggable ? 'cursor-grab active:cursor-grabbing' : ''}
                                        ${isDragging ? 'opacity-50 scale-95' : ''}
                                        `}
                                        style={isJustRevealed ? { animation: 'seat-pop 0.4s ease-out' } : undefined}
                                     >
                                        {seatStudent ? (
                                          isRevealed ? (
                                             <>
                                               <Users size={24} className={isCurrentSeat ? 'text-sky-500 mb-1' : isJustRevealed ? 'text-amber-600 mb-1' : 'text-amber-400 mb-1'} />
                                               <span
                                                 className={`font-bold text-lg md:text-xl truncate w-full text-center ${isCurrentSeat ? 'text-sky-900' : isJustRevealed ? 'text-amber-900' : 'text-gray-800'}`}
                                               >
                                                   {seatStudent.name}
                                               </span>
                                             </>
                                          ) : (
                                            <div className="text-2xl animate-pulse">❓</div>
                                          )
                                         ) : (
                                             <span className="text-gray-300 text-xs">빈 자리</span>
                                         )}
                                     </div>
                                 );
                             })}
                         </div>
                         <style>{`
                           @keyframes seat-pop {
                             0% { transform: scale(0.5); opacity: 0.5; }
                             60% { transform: scale(1.15); }
                             100% { transform: scale(1.1); opacity: 1; }
                           }
                         `}</style>
                     </div>
                 ) : (
                     <div className="text-center py-20 text-gray-400">
                         <Grid size={64} className="mx-auto mb-4 opacity-30" />
                         <p>아직 자리가 배치되지 않았습니다.</p>
                     </div>
                 )}
             </div>
         )}
      </main>
    </div>
  );
};
