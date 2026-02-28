
import React, { useState, useEffect } from 'react';
import { Post, Comment, UserRole, Participant } from '../types';
import { MessageSquare, Heart, Clock, CheckCircle, XCircle, SmilePlus, CheckSquare, Square, Calculator, Send } from 'lucide-react';
import * as api from '../services/boardService';
import { createSignedUrl } from '../src/lib/supabase/storage';

interface PostCardProps {
  post: Post;
  role: UserRole;
  currentUser: Participant | null;
  onStatusChange: (postId: string, status: 'approved' | 'rejected') => void;
  onRefresh?: () => void;
  boardId?: string;
}

export const PostCard: React.FC<PostCardProps> = ({ post, role, currentUser, onStatusChange, onRefresh, boardId }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [likes, setLikes] = useState(post.likes);
  const [sticker, setSticker] = useState(post.sticker);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [isChecked, setIsChecked] = useState(post.is_corrected || false);
  const [resolvedAttachmentUrl, setResolvedAttachmentUrl] = useState<string | null>(post.attachment_url || null);
  const [resolvedAttachmentUrls, setResolvedAttachmentUrls] = useState<string[]>([]);

  useEffect(() => {
    if (showComments) {
      api.getComments(post.id).then((data) => setComments(data));
    }
  }, [showComments, post.id]);

  useEffect(() => {
    setSticker(post.sticker);
  }, [post.sticker]);

  useEffect(() => {
    const resolve = async () => {
      const rawUrls =
        post.attachment_urls && post.attachment_urls.length > 0
          ? post.attachment_urls
          : post.attachment_url
            ? [post.attachment_url]
            : [];
      if (rawUrls.length === 0) {
        setResolvedAttachmentUrl(null);
        setResolvedAttachmentUrls([]);
        return;
      }
      const signedUrls = await Promise.all(
        rawUrls.map(async (url) => {
          if (!url.startsWith('storage:')) return url;
          const storagePath = url.replace('storage:', '');
          return createSignedUrl(storagePath, 60);
        })
      );
      setResolvedAttachmentUrls(signedUrls);
      setResolvedAttachmentUrl(signedUrls[0] || null);
    };
    resolve();
  }, [post.attachment_url, post.attachment_urls]);

  useEffect(() => {
      setIsChecked(post.is_corrected || false);
  }, [post.is_corrected]);

  const handleLike = async () => {
    await api.toggleLike(post.id);
    setLikes(prev => prev + 1);
  };

  const handleAddSticker = async (emoji: string) => {
    await api.addSticker(post.id, emoji);
    setSticker(emoji);
    setShowStickerPicker(false);
    if(onRefresh) onRefresh();
  };

  const handleCorrectionCheck = async () => {
      // Only author or teacher can check
      const isAuthor = currentUser && post.author_participant_id === currentUser.id;
      if (role !== 'teacher' && !isAuthor) return;

      if(boardId) {
          await api.toggleMathCorrection(post.id, boardId);
          setIsChecked(!isChecked);
          if(onRefresh) onRefresh();
      }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    const author = role === 'teacher' ? '선생님' : (currentUser?.nickname || '익명');
    try {
      const added = await api.addComment(post.id, author, newComment);
      setComments([...comments, added]);
      setNewComment('');
    } catch (err) {
      alert(err instanceof Error ? err.message : '댓글 등록에 실패했습니다.');
    }
  };

  const isPending = post.status === 'pending';
  const isRejected = post.status === 'rejected';

  // For students, hide pending posts unless they are the author
  if (role === 'student' && post.status !== 'approved' && post.author_participant_id !== currentUser?.id) {
    return null;
  }

  const getYoutubeEmbedUrl = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
  };

  const getColorClass = (color?: string) => {
    switch(color) {
        case 'red': return 'bg-[#FFE4E6]'; 
        case 'orange': return 'bg-[#FFEDD5]'; 
        case 'yellow': return 'bg-[#FEF3C7]'; 
        case 'green': return 'bg-[#D1FAE5]'; 
        case 'blue': return 'bg-[#E0F2FE]'; 
        case 'purple': return 'bg-[#EDE9FE]'; 
        case 'pink': return 'bg-[#FCE7F3]'; 
        default: return 'bg-white';
    }
  };

  const STICKERS = ['💯', '🌟', '👑', '🐣', '🍎', '👍', '❤️'];

  // --- Specialized Math Error Note View ---
  if (boardId === 'math') {
      const isAuthor = currentUser && post.author_participant_id === currentUser.id;
      return (
          <div className={`rounded-xl shadow-sm border-2 overflow-hidden bg-white mb-2 transition-all ${isChecked ? 'border-green-300 ring-2 ring-green-100' : 'border-gray-200'} relative`}>
              {/* Header / Info Row */}
              <div className="flex flex-col sm:flex-row border-b border-gray-100">
                  {/* Left: Date & Name */}
                  <div className="p-4 sm:w-40 bg-gray-50 flex flex-row sm:flex-col justify-between items-center sm:items-start border-b sm:border-b-0 sm:border-r border-gray-100">
                      <div>
                          <div className="text-xs font-bold text-gray-400">{new Date(post.created_at).toLocaleDateString()}</div>
                          <div className="font-bold text-gray-800 text-lg">{post.author_name}</div>
                      </div>
                      <div className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded-full mt-1">
                          {post.math_page_range || '범위 없음'}
                      </div>
                  </div>

                  {/* Right: Check & Content */}
                  <div className="flex-1 p-4 flex flex-col justify-between">
                      <div className="flex justify-between items-start mb-3">
                          <h3 className="font-bold text-lg text-gray-800">{post.title}</h3>
                          {/* Check Button */}
                          <button 
                            onClick={handleCorrectionCheck}
                            disabled={!isAuthor && role !== 'teacher'}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 font-bold transition-all ${isChecked ? 'bg-green-500 text-white border-green-600' : 'bg-white text-gray-400 border-gray-300 hover:border-gray-400'}`}
                          >
                              {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                              {isChecked ? '수정 완료' : '틀린문제 고치기'}
                          </button>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-4">
                          <div className="flex-1 text-gray-600 whitespace-pre-wrap text-sm leading-relaxed">
                              {post.body}
                          </div>
                          {resolvedAttachmentUrl && (
                              <div className="w-24 h-24 shrink-0 bg-gray-100 rounded-lg overflow-hidden border cursor-pointer hover:opacity-90" onClick={() => window.open(resolvedAttachmentUrl, '_blank')}>
                                  <img src={resolvedAttachmentUrl} alt="오답" className="w-full h-full object-cover" />
                              </div>
                          )}
                      </div>
                  </div>
              </div>

              {/* Bottom: Teacher Memo (Comments) */}
              <div className="bg-yellow-50/50 p-3 border-t border-yellow-100">
                  <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-yellow-700 flex items-center gap-1"><MessageSquare size={12}/> 선생님 메모</span>
                      <button onClick={() => setShowComments(!showComments)} className="text-xs text-gray-400 underline">
                          {showComments ? '접기' : `메모 ${comments.length}개`}
                      </button>
                  </div>
                  
                  {showComments && (
                      <div className="space-y-2 animate-fade-in-up">
                          {comments.map(c => (
                              <div key={c.id} className="text-sm bg-white p-2 rounded border border-yellow-200">
                                  <span className="font-bold text-gray-700 mr-2">{c.author_name}:</span>
                                  <span className="text-gray-600">{c.body_filtered}</span>
                              </div>
                          ))}
                          <form onSubmit={handleSubmitComment} className="flex gap-2 mt-2">
                              <input 
                                className="flex-1 border rounded px-2 py-1 text-sm" 
                                placeholder="메모 남기기..."
                                value={newComment}
                                onChange={e => setNewComment(e.target.value)}
                              />
                              <button type="submit" className="bg-yellow-500 text-white px-3 py-1 rounded text-xs font-bold">등록</button>
                          </form>
                      </div>
                  )}
              </div>
              
              {sticker && (
                <div className="absolute top-2 right-2 opacity-50 pointer-events-none transform rotate-12 text-6xl">
                    {sticker}
                </div>
              )}
          </div>
      )
  }

  // --- Standard Post View ---
  return (
    <div className={`rounded-[2rem] shadow-sm overflow-hidden border-2 transition-all hover:shadow-xl relative hover:-translate-y-1
      ${isPending ? 'border-[#FCD34D] bg-[#FFFBEB] ring-4 ring-[#FDE68A]' : 'border-transparent'}
      ${isRejected ? 'border-red-400 opacity-60' : ''}
      ${!isPending ? getColorClass(post.color) : ''}
    `}>
      {sticker && (
        <div className="absolute -top-2 -right-2 text-7xl z-20 filter drop-shadow-md transform rotate-12">
            {sticker}
        </div>
      )}

      {/* Attachment Logic ... (Same as before) */}
      {post.attachment_type === 'video' && post.attachment_url ? (
        <div className="relative pt-[56.25%] w-full bg-black overflow-hidden group">
            <iframe 
                className="absolute top-0 left-0 w-full h-full"
                src={getYoutubeEmbedUrl(post.attachment_url) || ''} 
                title="YouTube video" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
            ></iframe>
             {isPending && (
                <div className="absolute top-4 right-4 bg-[#FCD34D] text-[#78350F] text-sm font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 z-10 pointer-events-none border-2 border-white">
                  <Clock size={18} /> 승인 대기중
                </div>
              )}
        </div>
      ) : resolvedAttachmentUrls.length > 0 && post.attachment_type === 'image' ? (
        <div className="bg-gray-50/80 border-t border-[#FDE68A]">
          <div className="flex gap-3 overflow-x-auto p-4">
            {resolvedAttachmentUrls.map((url, idx) => (
              <div key={`${url}-${idx}`} className="relative w-56 h-40 shrink-0 rounded-2xl overflow-hidden border bg-white">
                <img src={url} alt="attachment" className="w-full h-full object-cover" />
                <a
                  href={url}
                  download
                  className="absolute bottom-2 right-2 bg-white/90 text-[#78350F] text-xs font-bold px-3 py-1.5 rounded-full shadow hover:bg-white transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  다운로드
                </a>
              </div>
            ))}
          </div>
          {isPending && (
            <div className="px-4 pb-4">
              <div className="inline-flex items-center gap-2 bg-[#FCD34D] text-[#78350F] text-sm font-bold px-4 py-2 rounded-full shadow-lg border-2 border-white">
                <Clock size={18} /> 승인 대기중
              </div>
            </div>
          )}
        </div>
      ) : resolvedAttachmentUrl && post.attachment_type === 'file' ? (
        <div className="w-full bg-white/80 border border-gray-200 p-4 flex items-center justify-between">
          <span className="text-sm font-bold text-[#78350F]">첨부 파일</span>
          <a
            href={resolvedAttachmentUrl}
            download
            className="bg-white/90 text-[#78350F] text-sm font-bold px-3 py-2 rounded-full shadow hover:bg-white transition-colors"
          >
            다운로드
          </a>
        </div>
      ) : null}

      {!resolvedAttachmentUrl && isPending && (
         <div className="bg-[#FFFBEB] p-4 text-center text-[#78350F] text-lg font-bold flex items-center justify-center gap-3">
            <Clock size={24} /> 선생님이 확인하고 있어요
         </div>
      )}

      <div className="p-6 relative">
        <h3 className="font-hand font-bold text-2xl text-[#78350F] mb-2 leading-tight">{post.title}</h3>
        <div className="text-sm text-[#92400E] mb-4 flex justify-between items-center opacity-80">
          <span className="font-bold text-[#0EA5E9] text-base">{post.author_name}</span>
          <span>{new Date(post.created_at).toLocaleDateString()}</span>
        </div>
        <p className="text-[#78350F] text-lg whitespace-pre-wrap mb-6 leading-relaxed">{post.body}</p>
        
        {post.event_date && (
            <div className="mb-6 inline-block bg-[#E0F2FE] text-[#0369A1] px-4 py-2 rounded-xl text-sm font-bold border border-[#BAE6FD]">
                📅 {post.event_date}
            </div>
        )}

        {role === 'teacher' && (
            <div className="flex flex-col gap-3 mb-6">
                {isPending && (
                    <div className="flex gap-3 p-3 bg-white/50 rounded-2xl border border-[#FDE68A]">
                        <button onClick={() => onStatusChange(post.id, 'approved')} className="flex-1 bg-[#6EE7B7] hover:bg-[#34D399] text-white py-3 px-4 rounded-xl text-lg font-bold flex items-center justify-center gap-2 shadow-sm">
                            <CheckCircle size={20} /> 승인
                        </button>
                        <button onClick={() => onStatusChange(post.id, 'rejected')} className="flex-1 bg-[#FDA4AF] hover:bg-[#F43F5E] text-white py-3 px-4 rounded-xl text-lg font-bold flex items-center justify-center gap-2 shadow-sm">
                            <XCircle size={20} /> 반려
                        </button>
                    </div>
                )}
                
                <div className="relative">
                    <button onClick={() => setShowStickerPicker(!showStickerPicker)} className="text-sm font-bold flex items-center gap-2 text-[#78350F] hover:text-[#F59E0B] bg-white px-4 py-2 rounded-full border-2 border-[#FDE68A] self-start w-fit hover:bg-[#FEF9E7] transition-colors">
                        <SmilePlus size={20} /> 스티커 붙이기
                    </button>
                    {showStickerPicker && (
                        <div className="absolute bottom-full left-0 mb-3 bg-white rounded-2xl shadow-xl p-3 flex gap-3 border z-20 animate-fade-in-up">
                            {STICKERS.map(s => (
                                <button key={s} onClick={() => handleAddSticker(s)} className="text-4xl hover:scale-125 transition-transform p-1">{s}</button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}

        <div className="flex items-center justify-between border-t-2 border-[#78350F]/10 pt-4 mt-2">
          <button onClick={handleLike} className="flex items-center gap-2 text-[#92400E] hover:text-[#FDA4AF] transition-colors text-lg font-bold group">
            <Heart size={24} className={`group-hover:scale-110 transition-transform ${likes > post.likes ? "fill-[#FDA4AF] text-[#FDA4AF]" : ""}`} />
            <span>{likes}</span>
          </button>
          
          <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-2 text-[#92400E] hover:text-[#7DD3FC] transition-colors text-lg font-bold group">
            <MessageSquare size={24} className="group-hover:scale-110 transition-transform" />
            <span>댓글</span>
          </button>
        </div>

        {showComments && (
          <div className="mt-6 pt-4 bg-[#FFFBEB]/50 -mx-6 px-6 pb-4 border-t border-[#FDE68A]">
            <div className="space-y-4 mb-4 max-h-60 overflow-y-auto custom-scrollbar pr-2">
              {comments.map(comment => (
                <div key={comment.id} className="flex gap-3 items-start animate-fade-in-up group">
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-sm border-2 overflow-hidden
                      ${comment.author_name === '선생님' 
                        ? 'bg-[#FCD34D] border-white text-[#78350F]' 
                        : 'bg-white border-gray-100 text-gray-500'}
                  `}>
                      {comment.author_name === '선생님' ? 'T' : comment.author_name.slice(0,1)}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-[#78350F] text-xs">{comment.author_name}</span>
                          <span className="text-[10px] text-[#92400E]/40">{new Date(comment.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="bg-white px-3 py-2 rounded-2xl rounded-tl-none shadow-sm border border-[#FDE68A] text-[#92400E] text-sm leading-snug relative">
                          {comment.body_filtered}
                      </div>
                  </div>
                </div>
              ))}
              {comments.length === 0 && <p className="text-center text-[#92400E]/50 text-sm py-4">아직 댓글이 없어요. 첫 번째 댓글을 남겨보세요!</p>}
            </div>
            
            {post.status === 'approved' && (
              <form onSubmit={handleSubmitComment} className="flex gap-2 items-center">
                <div className="flex-1 relative">
                    <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="예쁜 말을 써주세요..."
                    className="w-full border-2 border-[#FDE68A] rounded-xl pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#FCD34D] bg-white"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <SmilePlus size={18} className="text-gray-400 hover:text-yellow-500 cursor-pointer" />
                    </div>
                </div>
                <button 
                    type="submit" 
                    disabled={!newComment.trim()}
                    className="bg-[#7DD3FC] hover:bg-[#38BDF8] disabled:bg-gray-300 text-white p-2.5 rounded-xl transition-colors shadow-sm"
                >
                  <Send size={18} />
                </button>
              </form>
            )}
            <p className="mt-2 text-[11px] text-[#92400E]/60">
              개인정보(전화번호/주소/계정)와 비속어는 금지예요. 서로 존중하는 댓글을 남겨주세요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
