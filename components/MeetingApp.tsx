
import React, { useState, useEffect } from 'react';
import { Home, MessageSquare, ThumbsUp, Plus, Trash2, ArrowRight, CheckCircle2, XCircle, PieChart, Users, ChevronDown, ChevronUp } from 'lucide-react';
import * as meetingService from '../services/meetingService';
import * as studentService from '../services/studentService';
import { Agenda, AgendaStatus, Participant, ClassStudent } from '../types';

interface MeetingAppProps {
  onBack: () => void;
  isTeacherMode: boolean;
  student: Participant | null;
  onLoginRequest: () => void;
}

export const MeetingApp: React.FC<MeetingAppProps> = ({ onBack, isTeacherMode, student, onLoginRequest }) => {
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [roster, setRoster] = useState<ClassStudent[]>([]);
  
  // Create Agenda State
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [authorName, setAuthorName] = useState('');

  // UI State
  const [expandedVoteId, setExpandedVoteId] = useState<string | null>(null);

  // Current User ID for Voting (use roster-based stable id for students)
  const normalizeName = (value: string) => value.replace(/\s+/g, '');
  const rosterStudent = student
    ? roster.find((s) => normalizeName(s.name) === normalizeName(student.nickname))
    : null;
  const currentUserId = isTeacherMode
    ? 'teacher'
    : rosterStudent?.id || (student ? `name:${normalizeName(student.nickname)}` : null);
  const isExecutive = !!rosterStudent?.executiveRole;
  const canFinalize = isTeacherMode || isExecutive;

  useEffect(() => {
    loadData();
    setRoster(studentService.getRoster());
    
    // Poll for live votes
    const interval = setInterval(loadData, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadData = () => {
    setAgendas(meetingService.getAgendas());
  };

  const handleOpenCreate = () => {
      // Allow anyone to open the create modal
      setAuthorName(isTeacherMode ? '선생님' : student?.nickname || '');
      setShowCreate(true);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !authorName.trim()) {
        alert('이름과 제목을 입력해주세요.');
        return;
    }

    meetingService.createAgenda(newTitle, newDesc, authorName);
    setNewTitle('');
    setNewDesc('');
    setShowCreate(false);
    loadData();
  };

  const handleDelete = (id: string) => {
    if(!confirm('안건을 삭제하시겠습니까?')) return;
    meetingService.deleteAgenda(id);
    loadData();
  };

  const handleLike = (id: string) => {
    meetingService.toggleLike(id);
    loadData();
  };

  const handleVote = (id: string, type: 'agree' | 'disagree') => {
      if (!currentUserId) {
          onLoginRequest();
          return;
      }
      if (!isTeacherMode && !rosterStudent) {
          alert('학급 명부에 등록된 이름으로 로그인해야 투표할 수 있어요.');
          return;
      }
      meetingService.voteAgenda(id, currentUserId, type);
      loadData();
  };

  const handleMove = (id: string, nextStatus: AgendaStatus, result?: string) => {
    if (!canFinalize) {
        alert('결정 완료는 선생님/임원만 할 수 있습니다.');
        return;
    }
    meetingService.updateAgendaStatus(id, nextStatus, result);
    loadData();
  };

  // Group by status
  const proposed = agendas.filter(a => a.status === 'proposed').sort((a,b) => b.likes - a.likes);
  const discussing = agendas.filter(a => a.status === 'discussing');
  const decided = agendas.filter(a => a.status === 'decided');

  const Column = ({ title, items, status, color }: { title: string, items: Agenda[], status: AgendaStatus, color: string }) => (
    <div className="flex-1 min-w-[340px] bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col h-[75vh]">
        <div className={`p-4 border-b-4 ${color} rounded-t-2xl bg-gray-50`}>
            <h2 className="font-bold text-gray-700 flex items-center justify-between">
                {title}
                <span className="bg-white px-2 py-0.5 rounded-full text-xs shadow-sm border">{items.length}</span>
            </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50/50">
            {items.map(item => {
                // Vote calculations
                const votes = item.votes || {};
                const voteEntries = Object.entries(votes);
                const agreeEntries = voteEntries.filter(([_, v]) => v === 'agree');
                const disagreeEntries = voteEntries.filter(([_, v]) => v === 'disagree');
                
                const agreeCount = agreeEntries.length;
                const disagreeCount = disagreeEntries.length;
                const totalVotes = agreeCount + disagreeCount;
                
                const myVote = currentUserId ? votes[currentUserId] : null;

                // Voter Names Logic
                const getVoterName = (id: string) => {
                    if (id === 'teacher') return '선생님';
                    const s = roster.find(s => s.id === id);
                    return s ? s.name : '알수없음';
                };

                const agreeNames = agreeEntries.map(([id]) => getVoterName(id));
                const disagreeNames = disagreeEntries.map(([id]) => getVoterName(id));
                
                // Calculate missing students
                const votedStudentIds = new Set(voteEntries.map(([id]) => id));
                const missingStudents = roster.filter(s => !votedStudentIds.has(s.id));

                return (
                    <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{item.author}</span>
                            {isTeacherMode && (
                                <button onClick={() => handleDelete(item.id)} className="text-gray-300 hover:text-red-400">
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                        <h3 className="font-bold text-gray-800 mb-1">{item.title}</h3>
                        {item.description && <p className="text-sm text-gray-600 mb-3 whitespace-pre-wrap">{item.description}</p>}
                        
                        {/* Status Specific UI */}
                        
                        {/* 1. Proposed: Likes */}
                        {status === 'proposed' && (
                            <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                                <button 
                                    onClick={() => handleLike(item.id)}
                                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-500"
                                >
                                    <ThumbsUp size={16} /> 좋아요 {item.likes}
                                </button>
                                {isTeacherMode && (
                                    <button onClick={() => handleMove(item.id, 'discussing')} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold flex items-center gap-1">
                                        토의 시작 <ArrowRight size={12}/>
                                    </button>
                                )}
                            </div>
                        )}

                        {/* 2. Discussing: Vote Buttons & Detailed Status */}
                        {status === 'discussing' && (
                            <div className="pt-2 border-t border-gray-50">
                                <div className="flex gap-2 mb-2">
                                    <button 
                                        onClick={() => handleVote(item.id, 'agree')}
                                        className={`flex-1 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-1 transition-all ${myVote === 'agree' ? 'bg-green-500 text-white shadow-md' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                                    >
                                        <CheckCircle2 size={16} /> 찬성 ({agreeCount})
                                    </button>
                                    <button 
                                        onClick={() => handleVote(item.id, 'disagree')}
                                        className={`flex-1 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-1 transition-all ${myVote === 'disagree' ? 'bg-red-500 text-white shadow-md' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
                                    >
                                        <XCircle size={16} /> 반대 ({disagreeCount})
                                    </button>
                                </div>

                                <button 
                                    onClick={() => setExpandedVoteId(expandedVoteId === item.id ? null : item.id)}
                                    className="w-full flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-gray-600 py-1"
                                >
                                    <Users size={12} /> 투표 현황 {expandedVoteId === item.id ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                                </button>

                                {expandedVoteId === item.id && (
                                    <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-2 mt-1 border border-gray-100">
                                        <div>
                                            <span className="font-bold text-green-600 block mb-1">찬성 ({agreeCount}명)</span>
                                            <div className="flex flex-wrap gap-1">
                                                {agreeNames.length > 0 ? agreeNames.map((name, i) => (
                                                    <span key={i} className="bg-white px-1.5 py-0.5 rounded border border-gray-200">{name}</span>
                                                )) : <span className="text-gray-400">-</span>}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="font-bold text-red-600 block mb-1">반대 ({disagreeCount}명)</span>
                                            <div className="flex flex-wrap gap-1">
                                                {disagreeNames.length > 0 ? disagreeNames.map((name, i) => (
                                                    <span key={i} className="bg-white px-1.5 py-0.5 rounded border border-gray-200">{name}</span>
                                                )) : <span className="text-gray-400">-</span>}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="font-bold text-gray-500 block mb-1">미참여 ({missingStudents.length}명)</span>
                                            <div className="flex flex-wrap gap-1">
                                                {missingStudents.length > 0 ? missingStudents.map((s, i) => (
                                                    <span key={i} className="bg-white px-1.5 py-0.5 rounded border border-gray-200 text-gray-400">{s.name}</span>
                                                )) : <span className="text-gray-400">모두 투표 완료!</span>}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                {canFinalize && (
                                    <div className="flex justify-end mt-2 pt-2 border-t border-dashed border-gray-200">
                                        <button onClick={() => {
                                            const res = prompt('결정된 사항을 입력해주세요 (예: 찬성 다수로 가결):');
                                            if(res) handleMove(item.id, 'decided', res);
                                        }} className="text-xs bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-1 hover:bg-indigo-700 shadow-sm transition-all">
                                            결정 완료 <ArrowRight size={12}/>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 3. Decided: Results */}
                        {status === 'decided' && (
                            <div className="pt-2 border-t border-gray-50">
                                {item.result && (
                                    <div className="bg-green-50 text-green-800 text-sm p-3 rounded-lg mb-3 font-bold flex gap-2 border border-green-100">
                                        <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                                        <span>결정: {item.result}</span>
                                    </div>
                                )}
                                
                                <div className="bg-gray-50 rounded-lg p-2">
                                    <div className="flex items-center gap-2 mb-1 text-xs font-bold text-gray-500">
                                        <PieChart size={12} /> 투표 결과 (총 {totalVotes}표)
                                    </div>
                                    <div className="flex h-4 rounded-full overflow-hidden w-full bg-gray-200">
                                        {totalVotes > 0 && (
                                            <>
                                                <div style={{ width: `${(agreeCount/totalVotes)*100}%` }} className="bg-green-400 h-full"></div>
                                                <div style={{ width: `${(disagreeCount/totalVotes)*100}%` }} className="bg-red-400 h-full"></div>
                                            </>
                                        )}
                                    </div>
                                    <div className="flex justify-between text-xs mt-1 font-medium">
                                        <span className="text-green-600">찬성 {agreeCount}명</span>
                                        <span className="text-red-600">반대 {disagreeCount}명</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
            {items.length === 0 && (
                <div className="text-center py-10 text-gray-300 text-sm">
                    안건이 없습니다.
                </div>
            )}
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-indigo-50 flex flex-col font-sans">
      <header className="bg-white p-4 shadow-sm flex items-center justify-between sticky top-0 z-10">
         <div className="flex items-center gap-3">
             <button onClick={onBack} className="bg-gray-100 p-2 rounded-full text-gray-500 hover:bg-gray-200"><Home size={20}/></button>
             <h1 className="font-bold text-indigo-900 text-xl flex items-center gap-2"><MessageSquare /> 학급회의 게시판</h1>
         </div>
         <button 
            onClick={handleOpenCreate}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-md"
         >
             <Plus size={18} /> 안건 제안하기
         </button>
      </header>
      
      <main className="flex-1 p-4 md:p-8 overflow-x-auto">
         <div className="flex gap-4 md:gap-6 min-w-[960px]">
             <Column title="안건 제안함 💡" items={proposed} status="proposed" color="border-yellow-400" />
             <Column title="토의 중 💬" items={discussing} status="discussing" color="border-blue-400" />
             <Column title="결정된 사항 ✅" items={decided} status="decided" color="border-green-400" />
         </div>
      </main>

      {/* Create Modal */}
      {showCreate && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 animate-fade-in-up">
                  <h2 className="text-xl font-bold mb-4 text-gray-800">새 안건 제안하기</h2>
                  <form onSubmit={handleCreate} className="space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-gray-600 mb-1">제안자</label>
                          <input 
                            type="text" 
                            value={authorName} 
                            onChange={e => setAuthorName(e.target.value)} 
                            className="w-full border rounded-lg p-2" 
                            placeholder="이름을 입력하세요"
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-600 mb-1">안건 제목</label>
                          <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="w-full border rounded-lg p-2" placeholder="예: 체육시간에 피구 해요"/>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-600 mb-1">설명 (선택)</label>
                          <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} className="w-full border rounded-lg p-2 h-20 resize-none" placeholder="이유나 자세한 내용을 적어주세요."/>
                      </div>
                      <div className="flex gap-2 pt-2">
                          <button type="button" onClick={() => setShowCreate(false)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold">취소</button>
                          <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold">등록하기</button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};
