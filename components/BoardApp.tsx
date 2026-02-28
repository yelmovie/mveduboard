
import React, { useState, useEffect, useCallback } from 'react';
import { UserRole, Board, Post, Participant, PostColor, LayoutType } from './types';
import * as api from './services/boardService';
import { PostCard } from './components/PostCard';
import { CreatePostModal } from './components/CreatePostModal';
import { BoardSettingsModal } from './components/BoardSettingsModal';
import { Plus, Users, Layout as LayoutIcon, LogOut, ShieldCheck, BarChart3, Home, Eye, Settings } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface BoardAppProps {
    boardId?: string;
    onBack: () => void;
    isTeacherMode: boolean;
    student: Participant | null;
    onLoginRequest: () => void;
    embedded?: boolean;
}

export const BoardApp: React.FC<BoardAppProps> = ({ boardId = 'board', onBack, isTeacherMode, student, onLoginRequest, embedded = false }) => {
  const [role, setRole] = useState<UserRole>('viewer'); 
  const [board, setBoard] = useState<Board | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [statsData, setStatsData] = useState<any[]>([]);
  const isAlbumBoard = boardId === 'album';
  const canUploadAlbum = isAlbumBoard && role === 'teacher';
  const canCreatePost = role === 'teacher' || (!isAlbumBoard && role !== 'viewer');

  useEffect(() => {
    const init = async () => {
      const b = await api.getBoard(boardId);
      setBoard(b);
      loadPosts();
    };
    init();
  }, [boardId]);

  useEffect(() => {
      if (isTeacherMode) {
          setRole('teacher');
      } else if (student) {
          setRole('student');
      } else {
          setRole('viewer');
      }
  }, [isTeacherMode, student]);

  useEffect(() => {
    if (isAlbumBoard && role !== 'teacher' && showCreateModal) {
      setShowCreateModal(false);
    }
  }, [isAlbumBoard, role, showCreateModal]);

  const loadPosts = useCallback(async () => {
    const p = await api.getPosts(boardId); 
    setPosts(p);
  }, [boardId]);

  const loadStats = async () => {
      const data = await api.getBoardStats(boardId);
      setStatsData(data);
  }

  const handleCreatePost = async (data: { title: string; body: string; event_date?: string, attachment_url?: string, attachment_urls?: string[], attachment_type?: 'image' | 'video', color: PostColor, math_page_range?: string }) => {
    if (!board) return;
    if (isAlbumBoard && role !== 'teacher') {
        alert('우리반 사진첩은 선생님만 올릴 수 있어요.');
        return;
    }
    if (role === 'viewer') {
        onLoginRequest();
        return;
    }
    const authorId = role === 'teacher' ? undefined : student?.id;
    if (role !== 'teacher' && !authorId) {
        alert("학생 정보를 찾을 수 없습니다. 다시 로그인해주세요.");
        return;
    }
    const authorName = role === 'teacher' ? '선생님' : (student?.nickname || '익명');

    await api.createPost({
        board_id: boardId,
        author_name: authorName,
        author_participant_id: authorId,
        title: data.title,
        body: data.body,
        event_date: data.event_date,
        attachment_url: data.attachment_url,
        attachment_urls: data.attachment_urls,
        attachment_type: data.attachment_type,
        color: data.color,
        math_page_range: data.math_page_range, 
    }, role === 'teacher');

    setShowCreateModal(false);
    loadPosts();
    if(role === 'student') alert('게시물이 등록되었습니다! 선생님 승인 후 공개됩니다.');
  };

  const handleStatusChange = async (postId: string, status: 'approved' | 'rejected') => {
    await api.updatePostStatus(postId, status, boardId);
    loadPosts();
  };

  const handleToggleLayout = async () => {
    if (!board || role !== 'teacher') return;
    const newLayout: LayoutType = board.layout === 'table' ? 'timeline' : 'table';
    const updated: Board = { ...board, layout: newLayout };
    await api.updateBoardSettings(updated, boardId);
    setBoard(updated);
  };

  const handleUpdateBoard = async (updatedBoard: Board) => {
      await api.updateBoardSettings(updatedBoard, boardId);
      setBoard(updatedBoard);
  };

  const getBackgroundClass = (bg?: string) => {
      switch(bg) {
          case 'cork': return 'bg-[#e3cda4]'; // Keep special textures
          case 'sky': return 'bg-[#E0F2FE]';
          case 'paper': return 'bg-[#fdfbf7]';
          default: return 'bg-[#FEF9E7]'; // Default Cream Brand Color
      }
  };

  const sortedPosts = [...posts].sort((a, b) => {
    if (board?.layout === 'timeline') {
      const dateA = a.event_date || a.created_at;
      const dateB = b.event_date || b.created_at;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div
      className={`${embedded ? 'h-full' : 'min-h-screen'} flex flex-col font-sans transition-colors duration-500 ${getBackgroundClass(
        board?.background
      )}`}
    >
      {!embedded && (
        <header className="bg-white/90 backdrop-blur-sm shadow-sm border-b border-[#FCD34D] sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <button 
                    onClick={onBack}
                    className="flex items-center gap-2 px-4 py-2 bg-[#FEF9E7] text-[#78350F] hover:bg-[#FCD34D] hover:text-white rounded-2xl transition-colors font-bold text-lg border border-[#FDE68A]" 
                    title="초기화면으로"
                >
                    <Home size={24} />
                    <span className="hidden sm:inline">처음으로</span>
                </button>
                <div className="h-8 w-px bg-[#FCD34D] mx-1 hidden sm:block"></div>
                <div className="bg-[#7DD3FC]/20 p-2.5 rounded-2xl text-[#0EA5E9] hidden sm:block">
                    {role === 'teacher' ? <ShieldCheck size={28} /> : role === 'student' ? <Users size={28} /> : <Eye size={28} />}
                </div>
                <div>
                    <h1 className="font-hand font-bold text-[#78350F] text-2xl sm:text-3xl truncate max-w-[300px] sm:max-w-2xl">
                        {board?.title}
                    </h1>
                    {role === 'student' && <span className="text-sm text-[#0EA5E9] font-bold">내 별명: {student?.nickname}</span>}
                    {role === 'viewer' && <span className="text-sm text-gray-400 font-bold">둘러보기 모드</span>}
                </div>
            </div>

            <div className="flex items-center gap-3">
                {role === 'teacher' && (
                <>
                    <button 
                        onClick={() => setShowSettingsModal(true)}
                        className="p-3 text-[#78350F] hover:bg-[#FEF9E7] rounded-xl hidden md:block" title="게시판 설정">
                        <Settings size={24} />
                    </button>
                    <button 
                        onClick={() => { loadStats(); setShowStats(!showStats); }}
                        className="p-3 text-[#78350F] hover:bg-[#FEF9E7] rounded-xl hidden md:block" title="통계">
                        <BarChart3 size={24} />
                    </button>
                    <button 
                        onClick={handleToggleLayout}
                        className="flex items-center gap-2 px-4 py-2 bg-[#7DD3FC] hover:bg-[#38BDF8] rounded-xl text-base font-bold text-white transition-colors shadow-sm">
                        <LayoutIcon size={20} />
                        <span className="hidden lg:inline">{board?.layout === 'table' ? '타임라인' : '카드형'}</span>
                    </button>
                    <div className="h-8 w-px bg-gray-200 mx-1 hidden md:block"></div>
                </>
                )}
                
                <button onClick={onBack} className="p-3 text-[#FDA4AF] hover:bg-[#FFE4E6] hover:text-[#F43F5E] rounded-xl" title="나가기">
                <LogOut size={24} />
                </button>
            </div>
            </div>
        </header>
      )}

      {embedded && role === 'teacher' && (
          <div className="px-6 py-3 bg-white/50 border-b border-[#FDE68A] flex justify-end gap-3">
               <button onClick={() => setShowSettingsModal(true)} className="p-2 text-[#78350F] hover:bg-[#FEF9E7] rounded-xl"><Settings size={20} /></button>
               <button onClick={handleToggleLayout} className="p-2 text-[#78350F] hover:bg-[#FEF9E7] rounded-xl"><LayoutIcon size={20} /></button>
          </div>
      )}

      <main className="flex-1 p-6 sm:p-10 overflow-y-auto max-w-7xl mx-auto w-full relative">
        <div className="bg-white/90 backdrop-blur border-2 border-[#FCD34D] text-[#78350F] rounded-[2rem] p-8 mb-10 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
                <p className="text-[#F59E0B] text-base font-bold uppercase tracking-wider mb-2 flex items-center gap-2"><Settings size={14}/> 게시판 소개</p>
                <p className="text-xl md:text-2xl opacity-95 leading-relaxed font-bold font-hand">{board?.description}</p>
            </div>
            
            {(canCreatePost || (role === 'teacher' || boardId !== 'schoolplan')) && !isAlbumBoard && !(embedded && role === 'student') ? (
                <button 
                    onClick={() => {
                        if (role === 'viewer') { onLoginRequest(); } else { setShowCreateModal(true); }
                    }}
                    className="shrink-0 bg-[#FCD34D] text-[#78350F] px-8 py-4 rounded-2xl font-bold shadow-md hover:bg-[#F59E0B] transition-transform hover:scale-105 active:scale-95 flex items-center gap-3 text-xl border-2 border-white">
                    <Plus size={28} />
                    {role === 'viewer' ? '로그인하고 글쓰기' : (boardId === 'math' ? '오답노트 작성' : '글쓰기')}
                </button>
            ) : canUploadAlbum ? (
                <button 
                    onClick={() => setShowCreateModal(true)}
                    className="shrink-0 bg-[#FCD34D] text-[#78350F] px-8 py-4 rounded-2xl font-bold shadow-md hover:bg-[#F59E0B] transition-transform hover:scale-105 active:scale-95 flex items-center gap-3 text-xl border-2 border-white">
                    <Plus size={28} />
                    사진 올리기
                </button>
            ) : null}
        </div>

        {showStats && role === 'teacher' && (
            <div className="bg-white p-8 rounded-3xl shadow-md mb-10 animate-fade-in-down border-2 border-[#7DD3FC]">
                <h3 className="font-bold text-[#78350F] mb-6 text-xl">게시물 현황</h3>
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={statsData} cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={5} dataKey="value">
                                {statsData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.fill} />))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-6 text-base font-bold text-gray-600">
                    {statsData.map(d => (
                        <div key={d.name} className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full" style={{backgroundColor: d.fill}}></div>
                            {d.name}: {d.value}
                        </div>
                    ))}
                </div>
            </div>
        )}

        {board?.layout === 'timeline' ? (
           <div className="relative container mx-auto px-4 py-8">
             <div className="absolute left-6 md:left-1/2 w-1 bg-[#FCD34D] h-full -ml-0.5"></div>
             {sortedPosts.map((post, index) => {
                 const isOwnPost = student && post.author_participant_id === student.id;
                 const canView = role === 'teacher' || post.status === 'approved' || (role === 'student' && isOwnPost);
                 if (!canView) return null;
                 return (
                    <div key={post.id} className={`relative mb-12 flex flex-col md:flex-row items-center ${index % 2 === 0 ? 'md:flex-row-reverse' : ''}`}>
                         <div className="absolute left-6 md:left-1/2 -ml-3 w-6 h-6 rounded-full border-4 border-white bg-[#FCD34D] z-10 shadow-sm"></div>
                         <div className="hidden md:block md:w-1/2"></div>
                         <div className={`w-full pl-16 md:pl-0 md:w-1/2 ${index % 2 === 0 ? 'md:pr-12' : 'md:pl-12'}`}>
                             <PostCard 
                                post={post} 
                                role={role} 
                                currentUser={student} 
                                onStatusChange={handleStatusChange} 
                                onRefresh={loadPosts} 
                                boardId={boardId}
                             />
                         </div>
                    </div>
                 );
             })}
           </div>
        ) : (
          <div className={`grid gap-8 ${boardId === 'math' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
            {sortedPosts.map(post => {
                const isOwnPost = student && post.author_participant_id === student.id;
                 const canView = role === 'teacher' || post.status === 'approved' || (role === 'student' && isOwnPost);
                 if (!canView) return null;
                return (
                  <PostCard 
                    key={post.id} 
                    post={post} 
                    role={role} 
                    currentUser={student} 
                    onStatusChange={handleStatusChange} 
                    onRefresh={loadPosts} 
                    boardId={boardId}
                  />
                );
            })}
          </div>
        )}

        {posts.length === 0 && (
            <div className="text-center py-32 text-[#78350F]/40">
                <p className="text-3xl font-hand mb-4">아직 게시물이 없어요 🍂</p>
                <p className="text-xl font-bold">첫 번째 주인공이 되어보세요!</p>
            </div>
        )}
      </main>

      {showCreateModal && board && (!isAlbumBoard || canUploadAlbum) && (
        <CreatePostModal 
            layout={board.layout} 
            onClose={() => setShowCreateModal(false)} 
            onSubmit={handleCreatePost} 
            boardId={boardId} 
            isTeacherMode={isTeacherMode}
        />
      )}
      {showSettingsModal && board && (
          <BoardSettingsModal board={board} onClose={() => setShowSettingsModal(false)} onSave={handleUpdateBoard} />
      )}
    </div>
  );
};
