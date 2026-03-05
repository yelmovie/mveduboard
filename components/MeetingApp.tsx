
import React, { useState, useEffect, useRef } from 'react';
import { Home, MessageSquare, ThumbsUp, Plus, Trash2, ArrowRight, CheckCircle2, XCircle, PieChart, Users, ChevronDown, ChevronUp, PenLine, Eye, Send, MessageCircle } from 'lucide-react';
import * as meetingService from '../services/meetingService';
import * as studentService from '../services/studentService';
import { Agenda, AgendaComment, AgendaStatus, Participant, ClassStudent } from '../types';

interface MeetingAppProps {
  onBack: () => void;
  isTeacherMode: boolean;
  student: Participant | null;
  onLoginRequest: () => void;
}

// --- Proposed Section with Vote + Comments ---
const ProposedSection: React.FC<{
  item: Agenda;
  roster: ClassStudent[];
  isTeacherMode: boolean;
  currentUserId: string | null;
  rosterStudent: ClassStudent | null | undefined;
  myVote: string | null;
  agreeCount: number;
  disagreeCount: number;
  onVote: (id: string, type: 'agree' | 'disagree') => void;
  onMove: (id: string, status: AgendaStatus, result?: string) => void;
  onLoginRequest: () => void;
  loadData: () => void;
}> = ({
  item, roster, isTeacherMode, currentUserId, rosterStudent,
  myVote, agreeCount, disagreeCount,
  onVote, onMove, onLoginRequest, loadData,
}) => {
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const comments = item.comments || [];

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    if (!currentUserId) {
      onLoginRequest();
      return;
    }
    const name = isTeacherMode ? '선생님' : (rosterStudent?.name || '익명');
    meetingService.addComment(item.id, currentUserId, name, commentText.trim());
    setCommentText('');
    loadData();
  };

  const handleDeleteComment = (commentId: string) => {
    if (!confirm('댓글을 삭제하시겠습니까?')) return;
    meetingService.deleteComment(item.id, commentId);
    loadData();
  };

  const totalVotes = agreeCount + disagreeCount;

  return (
    <div className="pt-2 border-t border-gray-50 space-y-3">
      {/* Vote Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => onVote(item.id, 'agree')}
          className={`flex-1 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-1 transition-all ${myVote === 'agree' ? 'bg-green-500 text-white shadow-md' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
        >
          <CheckCircle2 size={16} /> 찬성 ({agreeCount})
        </button>
        <button
          onClick={() => onVote(item.id, 'disagree')}
          className={`flex-1 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-1 transition-all ${myVote === 'disagree' ? 'bg-red-500 text-white shadow-md' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
        >
          <XCircle size={16} /> 반대 ({disagreeCount})
        </button>
      </div>

      {/* Vote Bar */}
      {totalVotes > 0 && (
        <div className="flex h-2 rounded-full overflow-hidden w-full bg-gray-100">
          <div style={{ width: `${(agreeCount / totalVotes) * 100}%` }} className="bg-green-400 h-full transition-all" />
          <div style={{ width: `${(disagreeCount / totalVotes) * 100}%` }} className="bg-red-400 h-full transition-all" />
        </div>
      )}

      {/* Comments Toggle + Teacher Action */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
        >
          <MessageCircle size={14} />
          댓글 {comments.length > 0 && <span className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-bold">{comments.length}</span>}
          {showComments ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        {isTeacherMode && (
          <button
            onClick={() => onMove(item.id, 'discussing')}
            className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold flex items-center gap-1 hover:bg-blue-200 transition-colors"
          >
            토의 시작 <ArrowRight size={12} />
          </button>
        )}
      </div>

      {/* Comments Area */}
      {showComments && (
        <div className="space-y-2">
          {comments.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {comments.map(c => (
                <div key={c.id} className="bg-gray-50 rounded-lg px-3 py-2 text-xs border border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-gray-700">{c.authorName}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-300 text-[10px]">
                        {new Date(c.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {(isTeacherMode || c.authorId === currentUserId) && (
                        <button
                          onClick={() => handleDeleteComment(c.id)}
                          className="text-gray-300 hover:text-red-400 ml-1"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-gray-600 whitespace-pre-wrap">{c.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-xs text-gray-300 py-2">아직 댓글이 없습니다.</div>
          )}

          {/* Comment Input */}
          <div className="flex gap-1.5">
            <input
              type="text"
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddComment(); }}
              className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-yellow-300 focus:border-yellow-300"
              placeholder="의견을 남겨주세요..."
            />
            <button
              onClick={handleAddComment}
              disabled={!commentText.trim()}
              className="bg-yellow-500 text-white p-2 rounded-lg hover:bg-yellow-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Discussing Section with Secretary + Notes ---
const DiscussingSection: React.FC<{
  item: Agenda;
  roster: ClassStudent[];
  isTeacherMode: boolean;
  currentUserId: string | null;
  rosterStudent: ClassStudent | null | undefined;
  myVote: string | null;
  agreeCount: number;
  disagreeCount: number;
  agreeNames: string[];
  disagreeNames: string[];
  missingStudents: ClassStudent[];
  totalVotes: number;
  expandedVoteId: string | null;
  setExpandedVoteId: (id: string | null) => void;
  canFinalize: boolean;
  onVote: (id: string, type: 'agree' | 'disagree') => void;
  onMove: (id: string, status: AgendaStatus, result?: string) => void;
  onLoginRequest: () => void;
  loadData: () => void;
}> = ({
  item, roster, isTeacherMode, currentUserId, rosterStudent,
  myVote, agreeCount, disagreeCount, agreeNames, disagreeNames,
  missingStudents, totalVotes, expandedVoteId, setExpandedVoteId,
  canFinalize, onVote, onMove, onLoginRequest, loadData,
}) => {
  const [localNotes, setLocalNotes] = useState(item.notes || '');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSecretary = !!(
    (currentUserId && item.secretaryId === currentUserId) ||
    (isTeacherMode && item.secretaryId === 'teacher')
  );

  useEffect(() => {
    if (!isSecretary) {
      setLocalNotes(item.notes || '');
    }
  }, [item.notes, isSecretary]);

  const handleNotesChange = (value: string) => {
    setLocalNotes(value);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      meetingService.updateNotes(item.id, value);
      loadData();
    }, 300);
  };

  const handleSetSecretary = (studentId: string) => {
    const s = roster.find(r => r.id === studentId);
    if (s) {
      meetingService.setSecretary(item.id, s.id, s.name);
      loadData();
    }
  };

  const handleSetTeacherSecretary = () => {
    meetingService.setSecretary(item.id, 'teacher', '선생님');
    loadData();
  };

  return (
    <div className="pt-2 border-t border-gray-50 space-y-3">
      {/* Secretary Assignment (Teacher only) */}
      {isTeacherMode && (
        <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-blue-700 flex items-center gap-1">
              <PenLine size={14} /> 서기 지정
            </span>
            {item.secretaryName && (
              <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                현재: {item.secretaryName}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <select
              value=""
              onChange={(e) => {
                if (e.target.value === '__teacher__') handleSetTeacherSecretary();
                else if (e.target.value) handleSetSecretary(e.target.value);
              }}
              className="flex-1 text-sm border border-blue-200 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-blue-400"
            >
              <option value="">학생 선택...</option>
              <option value="__teacher__">선생님 (직접 작성)</option>
              {roster.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Notes Area */}
      {item.secretaryId ? (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-600 flex items-center gap-1">
              {isSecretary ? <><PenLine size={13} className="text-blue-500" /> 서기 기록 (작성 중)</> : <><Eye size={13} className="text-gray-400" /> 서기 기록 (읽기 전용)</>}
            </span>
            <span className="text-xs text-gray-400">서기: {item.secretaryName}</span>
          </div>
          {isSecretary ? (
            <textarea
              value={localNotes}
              onChange={e => handleNotesChange(e.target.value)}
              className="w-full p-3 text-sm text-gray-800 resize-none focus:outline-none min-h-[120px] leading-relaxed"
              placeholder="토의 내용을 정리해주세요...&#10;&#10;예:&#10;- 김철수: 체육시간에 피구를 하자고 제안&#10;- 이영희: 줄넘기가 더 좋겠다고 반대 의견"
            />
          ) : (
            <div className="p-3 text-sm text-gray-700 whitespace-pre-wrap min-h-[80px] leading-relaxed">
              {item.notes ? item.notes : <span className="text-gray-300">서기가 아직 기록을 시작하지 않았습니다.</span>}
            </div>
          )}
        </div>
      ) : (
        !isTeacherMode && (
          <div className="bg-gray-50 rounded-xl p-3 text-center text-xs text-gray-400 border border-dashed border-gray-200">
            선생님이 서기를 지정하면 토의 기록이 여기에 나타납니다.
          </div>
        )
      )}

      {/* Vote Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => onVote(item.id, 'agree')}
          className={`flex-1 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-1 transition-all ${myVote === 'agree' ? 'bg-green-500 text-white shadow-md' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
        >
          <CheckCircle2 size={16} /> 찬성 ({agreeCount})
        </button>
        <button
          onClick={() => onVote(item.id, 'disagree')}
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
        <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-2 border border-gray-100">
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
        <div className="flex justify-end pt-2 border-t border-dashed border-gray-200">
          <button onClick={() => {
            const res = prompt('결정된 사항을 입력해주세요 (예: 찬성 다수로 가결):');
            if (res) onMove(item.id, 'decided', res);
          }} className="text-xs bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-1 hover:bg-indigo-700 shadow-sm transition-all">
            결정 완료 <ArrowRight size={12}/>
          </button>
        </div>
      )}
    </div>
  );
};

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
    const init = async () => {
      try { await studentService.fetchRosterFromDb(); } catch {}
      try { await meetingService.loadMeetingDataAsync(); } catch {}
      setRoster(studentService.getRoster());
    };
    init();
    loadData();
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
                        
                        {/* 1. Proposed: Vote + Comments */}
                        {status === 'proposed' && (
                            <ProposedSection
                                item={item}
                                roster={roster}
                                isTeacherMode={isTeacherMode}
                                currentUserId={currentUserId}
                                rosterStudent={rosterStudent}
                                myVote={myVote}
                                agreeCount={agreeCount}
                                disagreeCount={disagreeCount}
                                onVote={handleVote}
                                onMove={handleMove}
                                onLoginRequest={onLoginRequest}
                                loadData={loadData}
                            />
                        )}

                        {/* 2. Discussing: Secretary Notes + Vote */}
                        {status === 'discussing' && (
                            <DiscussingSection
                                item={item}
                                roster={roster}
                                isTeacherMode={isTeacherMode}
                                currentUserId={currentUserId}
                                rosterStudent={rosterStudent}
                                myVote={myVote}
                                agreeCount={agreeCount}
                                disagreeCount={disagreeCount}
                                agreeNames={agreeNames}
                                disagreeNames={disagreeNames}
                                missingStudents={missingStudents}
                                totalVotes={totalVotes}
                                expandedVoteId={expandedVoteId}
                                setExpandedVoteId={setExpandedVoteId}
                                canFinalize={canFinalize}
                                onVote={handleVote}
                                onMove={handleMove}
                                onLoginRequest={onLoginRequest}
                                loadData={loadData}
                            />
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
