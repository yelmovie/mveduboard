
import React, { useState, useEffect } from 'react';
import { Home, Calendar, Plus, Check, CheckCircle2, Circle, Trash2, UserCheck, ShieldCheck, Lock, RotateCcw, AlertTriangle, ArrowRight, XCircle, Star } from 'lucide-react';
import * as todoService from '../services/todoService';
import { TodoTask, TodoRecord, Participant, TodoStatus } from '../types';

interface TodoAppProps {
  onBack: () => void;
  isTeacherMode: boolean;
  student: Participant | null;
  onLoginRequest: () => void;
}

export const TodoApp: React.FC<TodoAppProps> = ({ onBack, isTeacherMode, student, onLoginRequest }) => {
  const [currentDate, setCurrentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [tasks, setTasks] = useState<TodoTask[]>([]);
  const [records, setRecords] = useState<Record<string, TodoRecord[]>>({}); // Map taskId -> records
  
  // Create State
  const [newTaskContent, setNewTaskContent] = useState('');
  const [isImportant, setIsImportant] = useState(false);
  
  // New States
  const [pastIncompleteCount, setPastIncompleteCount] = useState(0);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [yesterdayTasks, setYesterdayTasks] = useState<TodoTask[]>([]);
  const [selectedCopyTasks, setSelectedCopyTasks] = useState<Set<string>>(new Set());
  
  // Roster state
  const [roster, setRoster] = useState<{id: string, name: string, pureName: string}[]>([]);

  // Load data
  useEffect(() => {
    setRoster(todoService.getRoster());
    loadData();
  }, [currentDate]);

  // Teacher Real-time Polling (Auto-refresh every 2 seconds to see students disappearing)
  useEffect(() => {
      if (isTeacherMode) {
          const interval = setInterval(loadData, 2000);
          return () => clearInterval(interval);
      }
  }, [isTeacherMode, currentDate]);

  // Check past incomplete for student
  useEffect(() => {
      if (!isTeacherMode && student) {
          const count = todoService.checkPastIncomplete(student.id, new Date().toISOString().split('T')[0]);
          setPastIncompleteCount(count);
      }
  }, [student, isTeacherMode]);

  const loadData = () => {
    const t = todoService.getTasks(currentDate);
    setTasks(t);
    
    const recs: Record<string, TodoRecord[]> = {};
    t.forEach(task => {
        recs[task.id] = todoService.getRecords(task.id);
    });
    setRecords(recs);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentDate(e.target.value);
  };

  const getYesterdayDate = () => {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 1);
      return d.toISOString().split('T')[0];
  }

  // --- Teacher Handlers ---

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskContent.trim()) return;
    try {
        todoService.createTask(currentDate, newTaskContent, isImportant);
        setNewTaskContent('');
        setIsImportant(false);
        loadData();
    } catch (e: any) {
        alert(e.message);
    }
  };

  const handleDeleteTask = (taskId: string) => {
    if (!confirm('이 과제를 삭제하시겠습니까? 학생들의 기록도 함께 삭제됩니다.')) return;
    todoService.deleteTask(taskId);
    loadData();
  };

  const handleApproveAll = (taskId: string) => {
    if (!confirm('제출한 모든 학생을 승인하시겠습니까?')) return;
    todoService.approveAllForTask(taskId);
    loadData();
  };

  // Toggle status for teacher dashboard (Incomplete -> Done)
  // When a teacher clicks a name on the board, it marks them as done (removes them from list)
  const handleTeacherForceComplete = (taskId: string, studentId: string) => {
    const studentInfo = roster.find(s => s.id === studentId);
    if (studentInfo) {
        todoService.updateStudentStatus(taskId, { id: studentId, nickname: studentInfo.pureName }, 'approved');
        loadData();
    }
  };

  // --- Copy Logic (Carry Over) ---
  const handleOpenCopyModal = () => {
      const yDate = getYesterdayDate();
      const yTasks = todoService.getTasks(yDate);
      if (yTasks.length === 0) {
          alert(`${yDate}에 등록된 과제가 없습니다.`);
          return;
      }
      setYesterdayTasks(yTasks);
      setSelectedCopyTasks(new Set(yTasks.map(t => t.id))); // Default select all
      setShowCopyModal(true);
  };

  const handleCopySubmit = () => {
      if (selectedCopyTasks.size === 0) return;
      todoService.copyTasksToDate(getYesterdayDate(), currentDate, Array.from(selectedCopyTasks));
      setShowCopyModal(false);
      loadData();
      alert('과제를 가져왔습니다.');
  };

  // --- Student Handlers ---

  const handleStudentCheck = (taskId: string, currentRecord?: TodoRecord) => {
    if (!student) {
        onLoginRequest();
        return;
    }

    const taskDate = new Date(currentDate);
    const today = new Date();
    today.setHours(0,0,0,0);
    taskDate.setHours(0,0,0,0);

    if (currentRecord?.status === 'approved') {
        alert('선생님이 이미 확인한 과제입니다! 👍');
        return;
    }

    const nextStatus = currentRecord?.status === 'done' ? 'incomplete' : 'done';
    todoService.updateStudentStatus(taskId, student, nextStatus);
    loadData();
    
    // Update incomplete count if viewing past
    if (taskDate < today) {
        setTimeout(() => {
             const count = todoService.checkPastIncomplete(student.id, new Date().toISOString().split('T')[0]);
             setPastIncompleteCount(count);
        }, 100);
    }
  };

  // --- Render ---

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
       {/* Header */}
       <header className="bg-white shadow-sm sticky top-0 z-30">
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors">
                        <Home size={20} />
                    </button>
                    <div className="h-6 w-px bg-gray-200"></div>
                    <div className="bg-indigo-100 p-2 rounded-full text-indigo-600">
                        <CheckCircle2 size={24} />
                    </div>
                    <div>
                        <h1 className="font-bold text-gray-800 text-lg">오늘의 할 일</h1>
                        <p className="text-xs text-gray-500">
                            {isTeacherMode ? '선생님 관리 보드' : student ? `${student.nickname} 학생` : '학생 로그인 필요'}
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <input 
                            type="date" 
                            value={currentDate} 
                            onChange={handleDateChange}
                            className="pl-9 pr-3 py-2 bg-gray-50 border rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer hover:bg-gray-100"
                        />
                        <Calendar className="absolute left-2.5 top-2.5 text-gray-400 w-4 h-4" />
                    </div>
                </div>
            </div>
       </header>

       {/* Main Content */}
       <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 overflow-hidden flex flex-col">
            
            {/* Student Alert for Past Due */}
            {!isTeacherMode && pastIncompleteCount > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 flex items-center justify-between animate-pulse">
                    <div className="flex items-center gap-3 text-red-700">
                        <AlertTriangle size={24} />
                        <div>
                            <h3 className="font-bold">밀린 과제가 {pastIncompleteCount}개 있어요!</h3>
                            <p className="text-xs text-red-600">이전 날짜로 이동해서 완료해주세요.</p>
                        </div>
                    </div>
                    <button onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 1);
                        setCurrentDate(d.toISOString().split('T')[0]);
                    }} className="px-4 py-2 bg-white border border-red-200 rounded-lg text-sm font-bold text-red-600 hover:bg-red-50">
                        어제로 이동
                    </button>
                </div>
            )}

            {/* Teacher: Create Task & Copy */}
            {isTeacherMode && (
                <div className="bg-white rounded-2xl shadow-sm p-4 mb-6 border border-gray-200 flex flex-col md:flex-row gap-4 justify-between items-center">
                    <form onSubmit={handleCreateTask} className="flex gap-2 w-full md:w-auto flex-1 max-w-2xl">
                        <div className="relative flex-1">
                            <Plus className="absolute left-3 top-3.5 text-gray-400" size={20} />
                            <input 
                                type="text" 
                                value={newTaskContent}
                                onChange={(e) => setNewTaskContent(e.target.value)}
                                placeholder="새 과제 등록 (예: 수학익힘책 30p 풀기)"
                                className="w-full border-2 border-indigo-100 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium"
                                maxLength={50}
                            />
                        </div>
                        <button 
                            type="button" 
                            onClick={() => setIsImportant(!isImportant)}
                            className={`px-4 py-3 rounded-xl font-bold flex items-center gap-1 transition-colors border-2 ${isImportant ? 'bg-rose-100 border-rose-400 text-rose-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                            title="필수 과제로 설정"
                        >
                            <Star size={18} fill={isImportant ? "currentColor" : "none"} />
                            <span className="hidden sm:inline">필수</span>
                        </button>
                        <button 
                            type="submit" 
                            disabled={tasks.length >= 10 || !newTaskContent.trim()}
                            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-md active:scale-95 whitespace-nowrap"
                        >
                            등록
                        </button>
                    </form>
                    <button 
                        onClick={handleOpenCopyModal}
                        className="text-sm flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-4 py-3 rounded-xl text-gray-700 font-bold transition-colors border border-gray-200 whitespace-nowrap"
                    >
                        <RotateCcw size={16} /> 어제 과제 가져오기
                    </button>
                </div>
            )}

            {/* --- Teacher View: Dashboard Board Style --- */}
            {isTeacherMode ? (
                <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4 custom-scrollbar">
                    <div className="flex gap-4 min-w-max h-full items-stretch">
                        {tasks.length === 0 ? (
                            <div className="w-full h-64 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50/50">
                                <CheckCircle2 size={48} className="mb-4 opacity-20" />
                                <p className="text-lg font-medium">등록된 과제가 없습니다.</p>
                                <p className="text-sm">위 입력창에서 과제를 등록하거나 어제 과제를 가져오세요.</p>
                            </div>
                        ) : (
                            tasks.map((task, index) => {
                                const taskRecords = records[task.id] || [];
                                
                                // Split students into incomplete and complete
                                const incompleteStudents = roster.filter(student => {
                                    const record = taskRecords.find(r => r.student_id === student.id);
                                    return !record || record.status === 'incomplete';
                                });
                                
                                const completedCount = roster.length - incompleteStudents.length;
                                
                                return (
                                    <div key={task.id} className={`w-[280px] md:w-[320px] flex flex-col bg-white rounded-2xl shadow-md border-2 ${task.isImportant ? 'border-rose-400 ring-4 ring-rose-100' : 'border-gray-200'} overflow-hidden shrink-0 transition-transform hover:translate-y-[-2px] hover:shadow-lg`}>
                                        {/* Task Header */}
                                        <div className={`${task.isImportant ? 'bg-rose-500' : 'bg-slate-800'} text-white p-4 flex justify-between items-start gap-2 min-h-[80px]`}>
                                            <div className="flex-1">
                                                <div className="text-xs font-bold mb-1 flex items-center gap-1">
                                                    <span className={task.isImportant ? 'text-rose-200' : 'text-slate-400'}>과제 {index + 1}</span>
                                                    {task.isImportant && <span className="bg-white/20 px-1.5 rounded text-[10px] text-white">중요</span>}
                                                </div>
                                                <h3 className="font-bold text-lg leading-snug break-keep">{task.content}</h3>
                                            </div>
                                            <button 
                                                onClick={() => handleDeleteTask(task.id)}
                                                className={`text-slate-500 hover:text-red-200 p-1 rounded transition-colors ${task.isImportant ? 'text-rose-300 hover:bg-rose-600' : 'hover:bg-slate-700'}`}
                                                title="과제 삭제"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>

                                        {/* Body: Incomplete Students (Large Names) */}
                                        <div className="flex-1 p-4 bg-white relative overflow-y-auto">
                                            {incompleteStudents.length === 0 ? (
                                                <div className="h-full flex flex-col items-center justify-center text-green-500 animate-fade-in-up">
                                                    <ShieldCheck size={64} className="mb-2 drop-shadow-md" />
                                                    <span className="font-bold text-xl">모두 완료!</span>
                                                    <span className="text-sm opacity-80">훌륭해요 👍</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap content-start gap-2">
                                                    {incompleteStudents.map(s => (
                                                        <button 
                                                            key={s.id}
                                                            onClick={() => handleTeacherForceComplete(task.id, s.id)}
                                                            className="text-2xl font-black text-indigo-900 hover:text-red-500 hover:line-through transition-all cursor-pointer font-hand transform hover:scale-110 active:scale-95 px-1"
                                                            title="클릭하면 완료 처리됩니다"
                                                        >
                                                            {s.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Footer: Stats */}
                                        <div className="bg-gray-50 p-3 border-t border-gray-100 flex justify-between items-center text-xs font-bold text-gray-500">
                                            <div className="flex items-center gap-1">
                                                <UserCheck size={14} className="text-green-600"/>
                                                <span className="text-green-700">{completedCount}명 완료</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <XCircle size={14} className="text-red-400"/>
                                                <span className="text-red-500">{incompleteStudents.length}명 미완료</span>
                                            </div>
                                        </div>
                                        
                                        {incompleteStudents.length === 0 && (
                                            <div className="bg-green-100 p-2 text-center text-xs font-bold text-green-700 cursor-pointer hover:bg-green-200 transition-colors" onClick={() => handleApproveAll(task.id)}>
                                                전체 승인 처리하기 (클릭)
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                        {/* Placeholder for spacing */}
                        <div className="w-4 shrink-0"></div>
                    </div>
                </div>
            ) : (
            /* --- Student View: List Style --- */
            <div className="space-y-4">
                {tasks.length === 0 ? (
                    <div className="text-center py-20 text-gray-400 bg-white rounded-3xl border-2 border-dashed border-gray-200">
                        <CheckCircle2 size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="text-lg font-medium">등록된 과제가 없습니다.</p>
                    </div>
                ) : (
                    tasks.map((task, index) => {
                        const myRecord = student ? records[task.id]?.find(r => r.student_id === student.id) : undefined;
                        const myStatus = myRecord?.status || 'incomplete';
                        
                        const totalDone = records[task.id]?.filter(r => r.status === 'done' || r.status === 'approved').length || 0;

                        return (
                            <div key={task.id} className={`bg-white rounded-2xl shadow-sm border ${task.isImportant ? 'border-rose-200 bg-rose-50/30' : 'border-gray-100'} overflow-hidden transition-all hover:shadow-md`}>
                                <div className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                                    <div className="flex items-start gap-4 flex-1">
                                        <div className={`
                                            font-bold w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg relative
                                            ${myStatus === 'approved' ? 'bg-green-100 text-green-600' : task.isImportant ? 'bg-rose-200 text-rose-700' : 'bg-gray-100 text-gray-500'}
                                        `}>
                                            {index + 1}
                                            {task.isImportant && <Star size={12} className="absolute -top-1 -right-1 text-rose-500 fill-rose-500" />}
                                        </div>
                                        <div>
                                            <h3 className={`text-lg font-bold mb-1 transition-all ${myStatus === 'approved' || myStatus === 'done' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                                                {task.content}
                                            </h3>
                                            
                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                {task.isImportant && <span className="bg-rose-100 text-rose-600 px-2 py-0.5 rounded font-bold">필수</span>}
                                                <span className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                                                    <UserCheck size={12} /> 
                                                    {totalDone}명 완료
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="w-full sm:w-auto flex justify-end items-center gap-3">
                                        <button 
                                            onClick={() => handleStudentCheck(task.id, myRecord)}
                                            disabled={myStatus === 'approved'}
                                            className={`
                                                flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-lg transition-all transform active:scale-95 shadow-sm border-2 w-full sm:w-auto justify-center
                                                ${myStatus === 'approved' 
                                                    ? 'bg-green-500 text-white border-green-600 cursor-default opacity-80' 
                                                    : myStatus === 'done' 
                                                        ? 'bg-yellow-400 text-white border-yellow-500 hover:bg-yellow-500 shadow-md scale-105' 
                                                        : task.isImportant 
                                                            ? 'bg-white text-rose-500 border-rose-300 hover:bg-rose-50' 
                                                            : 'bg-white text-gray-400 border-gray-200 hover:border-green-400 hover:text-green-500 hover:shadow-md'}
                                            `}
                                        >
                                            {myStatus === 'approved' ? <ShieldCheck /> : 
                                                myStatus === 'done' ? <CheckCircle2 /> : <Circle />}
                                            
                                            {myStatus === 'approved' ? '승인됨' : 
                                                myStatus === 'done' ? '다 했어요!' : '아직 안함'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
            )}
       </main>

       {showCopyModal && (
           <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
               <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 animate-fade-in-up">
                   <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                       <RotateCcw size={20} className="text-green-600"/> 어제({getYesterdayDate()}) 과제 가져오기
                   </h3>
                   <div className="max-h-60 overflow-y-auto space-y-2 mb-6 custom-scrollbar">
                       {yesterdayTasks.map(task => (
                           <label key={task.id} className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-gray-50">
                               <input 
                                    type="checkbox" 
                                    checked={selectedCopyTasks.has(task.id)}
                                    onChange={(e) => {
                                        const newSet = new Set(selectedCopyTasks);
                                        if (e.target.checked) newSet.add(task.id);
                                        else newSet.delete(task.id);
                                        setSelectedCopyTasks(newSet);
                                    }}
                                    className="w-5 h-5 accent-green-600"
                               />
                               <span className="text-gray-800">{task.content}</span>
                           </label>
                       ))}
                   </div>
                   <div className="flex gap-2">
                       <button onClick={() => setShowCopyModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold">취소</button>
                       <button onClick={handleCopySubmit} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700">
                           {selectedCopyTasks.size}개 가져오기
                       </button>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};
