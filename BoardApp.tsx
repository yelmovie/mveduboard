import React, { useState, useEffect, useCallback } from 'react';
import { UserRole, Board, Post, Participant, PostColor, LayoutType } from './types';
import * as api from './services/boardService';
import { PostCard } from './components/PostCard';
import { CreatePostModal } from './components/CreatePostModal';
import { BoardSettingsModal } from './components/BoardSettingsModal';
import { Plus, Users, Layout as LayoutIcon, LogOut, ShieldCheck, BarChart3, Home, Eye, Settings } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface BoardAppProps {
    boardId?: string; // Optional prop to identify which board to load
    onBack: () => void;
    isTeacherMode: boolean;
    student: Participant | null;
    onLoginRequest: () => void;
    embedded?: boolean; // If true, hides the main header
    allowStudentPost?: boolean;
}

export const BoardApp: React.FC<BoardAppProps> = ({
  boardId = 'board',
  onBack,
  isTeacherMode,
  student,
  onLoginRequest,
  embedded = false,
  allowStudentPost = true,
}) => {
  const [role, setRole] = useState<UserRole>('viewer'); 
  const [board, setBoard] = useState<Board | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  
  // UI State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [statsData, setStatsData] = useState<any[]>([]);

  // Load initial data and determine role
  useEffect(() => {
    const init = async () => {
      // Pass the specific boardId to get distinct data
      const b = await api.getBoard(boardId);
      setBoard(b);
      loadPosts(); // Load posts for the current boardId
    };
    init();
  }, [boardId]); // Only reload board config when ID changes

  // Update role whenever auth props change
  useEffect(() => {
      if (isTeacherMode) {
          setRole('teacher');
      } else if (student) {
          setRole('student');
      } else {
          setRole('viewer');
      }
  }, [isTeacherMode, student]);

  // Defined as useCallback to avoid stale closures if passed down, or just for clarity
  const loadPosts = useCallback(async () => {
    const p = await api.getPosts(boardId); 
    setPosts(p);
  }, [boardId]);

  const loadStats = async () => {
      const data = await api.getBoardStats(boardId);
      setStatsData(data);
  }

  // --- Handlers ---

  const handleCreatePost = async (data: { title: string; body: string; event_date?: string, attachment_url?: string, attachment_urls?: string[], attachment_type?: 'image' | 'video' | 'file', color: PostColor, math_page_range?: string }) => {
    if (!board) return;
    
    // Safety check: if role is viewer, shouldn't be here
    if (role === 'viewer') {
        onLoginRequest();
        return;
    }
    if (role === 'student' && !allowStudentPost) {
        alert('이 게시판은 선생님만 작성할 수 있어요.');
        return;
    }

    // Explicitly check student ID for student role
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
    loadPosts(); // Reload posts to show the new one
    
    if(role === 'student') {
        alert('게시물이 등록되었습니다! 선생님 승인 후 공개됩니다.');
    }
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

  const handleDeletePost = async (postId: string) => {
    await api.deletePost(postId, boardId);
    loadPosts();
  };

  const handleEditPost = async (postId: string, updates: { title: string; body: string }) => {
    await api.editPost(postId, boardId, updates);
    loadPosts();
  };

  const handleUpdateBoard = async (updatedBoard: Board) => {
      await api.updateBoardSettings(updatedBoard, boardId);
      setBoard(updatedBoard);
  };

  // --- Render Helpers ---

  const getBackgroundClass = (bg?: string) => {
      switch(bg) {
          case 'cork': return 'bg-[#e3cda4]';
          case 'sky': return 'bg-sky-100';
          case 'paper': return 'bg-[#fdfbf7]';
          default: return 'bg-slate-100';
      }
  };

  // Sort posts logic
  const sortedPosts = [...posts].sort((a, b) => {
    if (board?.layout === 'timeline') {
      const dateA = a.event_date || a.created_at;
      const dateB = b.event_date || b.created_at;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // --- View: Board ---
  return (
    <div className={`min-h-full flex flex-col font-sans transition-colors duration-500 ${getBackgroundClass(board?.background)}`}>
      {/* Header - Hidden if embedded */}
      {!embedded && (
        <header className="bg-white/90 backdrop-blur-sm shadow-sm border-b sticky top-0 z-40">
            <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <button 
                    onClick={onBack}
                    className="flex items-center gap-1 p-2 bg-gray-50 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg mr-1 transition-colors font-bold text-sm" 
                    title="초기화면으로"
                >
                    <Home size={20} />
                    <span className="hidden sm:inline">처음으로</span>
                </button>
                <div className="h-6 w-px bg-gray-200 mx-1"></div>
                <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                    {role === 'teacher' ? <ShieldCheck size={24} /> : role === 'student' ? <Users size={24} /> : <Eye size={24} />}
                </div>
                <div>
                    <h1 className="font-bold text-gray-800 text-lg sm:text-xl truncate max-w-[200px] sm:max-w-md">
                        {board?.title}
                    </h1>
                    {role === 'student' && <span className="text-xs text-indigo-500 font-medium">내 별명: {student?.nickname}</span>}
                    {role === 'viewer' && <span className="text-xs text-gray-400 font-medium">둘러보기 모드</span>}
                </div>
            </div>

            <div className="flex items-center gap-2">
                {role === 'teacher' && (
                <>
                    <button 
                        onClick={() => setShowSettingsModal(true)}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg hidden sm:block" title="게시판 설정">
                        <Settings size={20} />
                    </button>
                    <button 
                        onClick={() => { loadStats(); setShowStats(!showStats); }}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg hidden sm:block" title="통계">
                        <BarChart3 size={20} />
                    </button>
                    <button 
                        onClick={handleToggleLayout}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors">
                        <LayoutIcon size={16} />
                        <span className="hidden sm:inline">{board?.layout === 'table' ? '타임라인으로 보기' : '카드로 보기'}</span>
                    </button>
                    <div className="h-6 w-px bg-gray-200 mx-1"></div>
                </>
                )}
                
                <button onClick={onBack} className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 rounded-lg" title="나가기">
                <LogOut size={20} />
                </button>
            </div>
            </div>
        </header>
      )}

      {/* Embedded Header Controls (Simplified) if embedded */}
      {embedded && role === 'teacher' && (
          <div className="px-4 py-2 bg-white/50 border-b flex justify-end gap-2">
               <button 
                    onClick={() => setShowSettingsModal(true)}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" title="게시판 설정">
                    <Settings size={18} />
                </button>
                <button 
                    onClick={handleToggleLayout}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" title="레이아웃 변경">
                    <LayoutIcon size={18} />
                </button>
          </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto max-w-6xl mx-auto w-full relative">
        
        {/* Description Banner */}
        <div className="bg-white/90 backdrop-blur border border-white/50 text-gray-800 rounded-2xl p-6 mb-8 shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <p className="text-indigo-500 text-sm font-semibold uppercase tracking-wider mb-1">Board Info</p>
                <p className="text-lg opacity-95 leading-relaxed font-bold">{board?.description}</p>
            </div>
            
            {/* 
                Write Button: 
                - Allowed for Teacher
                - Allowed for Students/Viewers UNLESS it is the 'schoolplan' board 
            */}
            {(role === 'teacher' || (boardId !== 'schoolplan' && allowStudentPost)) && (
                <button 
                    onClick={() => {
                        if (role === 'viewer') {
                            onLoginRequest();
                        } else if (role === 'student' && !allowStudentPost) {
                            alert('이 게시판은 선생님만 작성할 수 있어요.');
                        } else {
                            setShowCreateModal(true);
                        }
                    }}
                    className="shrink-0 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-transform hover:scale-105 active:scale-95 flex items-center gap-2">
                    <Plus size={20} />
                    {role === 'viewer' ? '로그인하고 글쓰기' : '게시물 쓰기'}
                </button>
            )}
        </div>

        {/* Stats Section (Teacher Only) */}
        {showStats && role === 'teacher' && (
            <div className="bg-white p-6 rounded-2xl shadow-md mb-8 animate-fade-in-down">
                <h3 className="font-bold text-gray-700 mb-4">게시물 현황</h3>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={statsData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {statsData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 text-sm text-gray-600">
                    {statsData.map(d => (
                        <div key={d.name} className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-full" style={{backgroundColor: d.fill}}></div>
                            {d.name}: {d.value}
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Layout: Timeline */}
        {board?.layout === 'timeline' ? (
           <div className="relative container mx-auto px-4 py-8">
             <div className="absolute left-4 sm:left-1/2 w-0.5 bg-gray-400/30 h-full -ml-0.5"></div>
             {sortedPosts.map((post, index) => {
                 // Viewer logic: Can see approved posts
                 // Student logic: Can see approved posts + own pending posts (checked by ID)
                 // Note: author_participant_id check ensures only the creator sees their pending post
                 const isOwnPost = student && post.author_participant_id === student.id;
                 const canView = role === 'teacher' || post.status === 'approved' || (role === 'student' && isOwnPost);
                 
                 if (!canView) return null;

                 return (
                    <div key={post.id} className={`relative mb-8 flex flex-col sm:flex-row items-center ${index % 2 === 0 ? 'sm:flex-row-reverse' : ''}`}>
                         {/* Dot on line */}
                         <div className="absolute left-4 sm:left-1/2 -ml-2 w-4 h-4 rounded-full border-4 border-white bg-indigo-500 z-10 shadow-sm"></div>
                         
                         {/* Spacer for other side */}
                         <div className="hidden sm:block sm:w-1/2"></div>
                         
                         {/* Content Card */}
                         <div className={`w-full pl-12 sm:pl-0 sm:w-1/2 ${index % 2 === 0 ? 'sm:pr-8' : 'sm:pl-8'}`}>
                             <PostCard 
                                post={post} 
                                role={role} 
                                currentUser={student} 
                                onStatusChange={handleStatusChange}
                                onRefresh={loadPosts}
                                onDeletePost={handleDeletePost}
                                onEditPost={handleEditPost}
                                boardId={boardId}
                             />
                         </div>
                    </div>
                 );
             })}
           </div>
        ) : (
        /* Layout: Table (Grid) */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
                    onDeletePost={handleDeletePost}
                    onEditPost={handleEditPost}
                    boardId={boardId}
                  />
                );
            })}
          </div>
        )}

        {/* Empty State */}
        {posts.length === 0 && (
            <div className="text-center py-20 text-gray-500/50">
                <p className="text-xl font-hand mb-2">아직 게시물이 없어요 🍂</p>
                <p>첫 번째 주인공이 되어보세요!</p>
            </div>
        )}
      </main>

      {/* Modals */}
      {showCreateModal && board && (
        <CreatePostModal 
          layout={board.layout} 
          onClose={() => setShowCreateModal(false)} 
          onSubmit={handleCreatePost} 
          boardId={boardId}
          isTeacherMode={isTeacherMode}
        />
      )}

      {showSettingsModal && board && (
          <BoardSettingsModal
            board={board}
            onClose={() => setShowSettingsModal(false)}
            onSave={handleUpdateBoard}
          />
      )}
    </div>
  );
};