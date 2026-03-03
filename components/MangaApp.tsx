
import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Home, Plus, Image as ImageIcon, PenTool, Upload, MessageSquare, Check, X, Send, Layout, Trash2, Heart, User, AlertCircle, ArrowRight, Grid, FileText, Download, Eraser } from 'lucide-react';
import * as mangaService from '../services/mangaService';
import { MangaTask, MangaEpisode, MangaPanel, MangaLayout, Participant, MangaComment, SpeechBubble, SpeechBubbleShape } from '../types';

interface MangaAppProps {
  onBack: () => void;
  isTeacherMode: boolean;
  student: Participant | null;
  onLoginRequest: () => void;
  embedded?: boolean;
}

type ViewState = 'list' | 'create_task' | 'layout_select' | 'storyboard' | 'editor' | 'detail' | 'manage';

export const MangaApp: React.FC<MangaAppProps> = ({ onBack, isTeacherMode, student, onLoginRequest, embedded = false }) => {
  const [view, setView] = useState<ViewState>('list');
  const [tasks, setTasks] = useState<MangaTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<MangaTask | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<MangaEpisode | null>(null);
  const [episodes, setEpisodes] = useState<MangaEpisode[]>([]);
  
  // --- Teacher Create Task State ---
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskSerial, setNewTaskSerial] = useState(false);

  // --- Student Creation Flow State ---
  const [chosenLayout, setChosenLayout] = useState<MangaLayout>(4);
  const [editorPanels, setEditorPanels] = useState<MangaPanel[]>([]);
  const [currentPanelIdx, setCurrentPanelIdx] = useState(0);
  const [assistantHint, setAssistantHint] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const editorAreaRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<HTMLDivElement>(null);
  const [brushSize, setBrushSize] = useState(6);
  const [brushColor, setBrushColor] = useState('#2563EB');
  const [isEraser, setIsEraser] = useState(false);
  const [selectedBubbleId, setSelectedBubbleId] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; mode: 'move' | 'tail' | 'resize'; offsetX: number; offsetY: number } | null>(null);
  const [canvasScale, setCanvasScale] = useState(1);

  // --- Detail View State ---
  const [commentInput, setCommentInput] = useState('');

  // --- Initial Load ---
  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!dragRef.current || !editorAreaRef.current) return;
      const rect = editorAreaRef.current.getBoundingClientRect();
      const pos = getPointerPercent(e.clientX, e.clientY, rect);
      const { id, mode, offsetX, offsetY } = dragRef.current;
      const panel = editorPanels[currentPanelIdx];
      const bubble = panel?.speechBubbles?.find((item) => item.id === id);
      if (mode === 'move') {
        updateBubble(id, { x: clampPercent(pos.x - offsetX), y: clampPercent(pos.y - offsetY) });
      } else if (mode === 'tail') {
        updateBubble(id, { tailX: clampPercent(pos.x - offsetX), tailY: clampPercent(pos.y - offsetY) });
      } else if (mode === 'resize' && bubble) {
        const rawWidth = Math.abs(pos.x - bubble.x) * 2;
        const rawHeight = Math.abs(pos.y - bubble.y) * 2;
        const nextWidth = clampPercent(Math.max(12, Math.min(90, rawWidth)));
        const nextHeight = clampPercent(Math.max(8, Math.min(60, rawHeight)));
        updateBubble(id, { width: nextWidth, height: nextHeight });
      }
    };
    const handleUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [currentPanelIdx]);

  useEffect(() => {
    if (view !== 'editor') return;
    const currentPanel = editorPanels[currentPanelIdx];
    if (!currentPanel || currentPanel.type !== 'draw' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!currentPanel.imageUrl) return;
    const img = new Image();
    img.src = currentPanel.imageUrl;
    img.onload = () => ctx.drawImage(img, 0, 0);
  }, [view, currentPanelIdx, editorPanels]);

  const loadData = () => {
    setTasks(mangaService.getTasks());
    setEpisodes(mangaService.getEpisodes());
  };

  const PASTEL_COLORS = [
    '#E0F2FE',
    '#FCE7F3',
    '#EDE9FE',
    '#FEF3C7',
    '#DCFCE7',
    '#FFE4E6',
    '#E2E8F0',
  ];

  const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

  const getPointerPercent = (clientX: number, clientY: number, rect: DOMRect) => {
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return { x: clampPercent(x), y: clampPercent(y) };
  };

  const createDefaultBubble = (): SpeechBubble => ({
    id: `bubble-${Date.now()}`,
    text: '',
    shape: 'oval',
    x: 50,
    y: 70,
    width: 32,
    height: 16,
    tailX: 60,
    tailY: 85,
    color: PASTEL_COLORS[0],
    opacity: 0.85,
    borderColor: '#1F2937',
    borderWidth: 2,
  });

  const updateCurrentPanel = (updater: (panel: MangaPanel) => MangaPanel) => {
    setEditorPanels((prev) => {
      const next = [...prev];
      const target = next[currentPanelIdx];
      if (!target) return prev;
      next[currentPanelIdx] = updater(target);
      return next;
    });
  };

  const updateBubble = (id: string, updates: Partial<SpeechBubble>) => {
    updateCurrentPanel((panel) => ({
      ...panel,
      speechBubbles: (panel.speechBubbles || []).map((bubble) =>
        bubble.id === id
          ? {
              ...bubble,
              ...updates,
              x: clampPercent(updates.x ?? bubble.x),
              y: clampPercent(updates.y ?? bubble.y),
              tailX: clampPercent(updates.tailX ?? bubble.tailX),
              tailY: clampPercent(updates.tailY ?? bubble.tailY),
              width: clampPercent(updates.width ?? bubble.width),
              height: clampPercent(updates.height ?? bubble.height),
            }
          : bubble
      ),
    }));
  };

  const autoArrangeBubbles = (panel: MangaPanel): MangaPanel => {
    const bubbles = panel.speechBubbles || [];
    if (bubbles.length === 0) return panel;
    const gap = 100 / (bubbles.length + 1);
    const arranged = bubbles
      .slice()
      .sort((a, b) => a.y - b.y)
      .map((bubble, idx) => ({
        ...bubble,
        x: 50,
        y: clampPercent(gap * (idx + 1)),
      }));
    return { ...panel, speechBubbles: arranged };
  };

  const getGridForLayout = (layout: MangaLayout) => {
    if (layout === 4) return { rows: 2, cols: 2 };
    if (layout === 6) return { rows: 3, cols: 2 };
    return { rows: 4, cols: 2 };
  };

  const getBubbleShapeClass = (shape: SpeechBubbleShape) => {
    switch (shape) {
      case 'rect':
        return 'rounded-md';
      case 'round':
        return 'rounded-2xl';
      case 'cloud':
        return 'rounded-[40%] shadow-sm';
      case 'oval':
      default:
        return 'rounded-full';
    }
  };

  const getTailAngle = (bubble: SpeechBubble) => {
    const rad = Math.atan2(bubble.tailY - bubble.y, bubble.tailX - bubble.x);
    return (rad * 180) / Math.PI;
  };

  const handleBubblePointerDown = (e: React.PointerEvent, bubble: SpeechBubble) => {
    if (!editorAreaRef.current) return;
    const rect = editorAreaRef.current.getBoundingClientRect();
    const pos = getPointerPercent(e.clientX, e.clientY, rect);
    dragRef.current = {
      id: bubble.id,
      mode: 'move',
      offsetX: pos.x - bubble.x,
      offsetY: pos.y - bubble.y,
    };
    setSelectedBubbleId(bubble.id);
  };

  const handleTailPointerDown = (e: React.PointerEvent, bubble: SpeechBubble) => {
    e.stopPropagation();
    if (!editorAreaRef.current) return;
    const rect = editorAreaRef.current.getBoundingClientRect();
    const pos = getPointerPercent(e.clientX, e.clientY, rect);
    dragRef.current = {
      id: bubble.id,
      mode: 'tail',
      offsetX: pos.x - bubble.tailX,
      offsetY: pos.y - bubble.tailY,
    };
    setSelectedBubbleId(bubble.id);
  };

  const handleResizePointerDown = (e: React.PointerEvent, bubble: SpeechBubble) => {
    e.stopPropagation();
    if (!editorAreaRef.current) return;
    const rect = editorAreaRef.current.getBoundingClientRect();
    const pos = getPointerPercent(e.clientX, e.clientY, rect);
    dragRef.current = {
      id: bubble.id,
      mode: 'resize',
      offsetX: pos.x - bubble.x,
      offsetY: pos.y - bubble.y,
    };
    setSelectedBubbleId(bubble.id);
  };

  // --- Teacher Actions ---
  const handleCreateTask = () => {
    if (!newTaskTitle.trim()) return;
    mangaService.createTask(newTaskTitle, newTaskDesc, newTaskSerial);
    loadData();
    setView('list');
    setNewTaskTitle('');
    setNewTaskDesc('');
  };

  const handleDeleteTask = (id: string) => {
    if(confirm('과제와 모든 제출물이 삭제됩니다. 계속하시겠습니까?')) {
        mangaService.deleteTask(id);
        loadData();
    }
  }

  const handleApprove = (ep: MangaEpisode) => {
    if(confirm('이 작품을 승인하여 갤러리에 공개하시겠습니까?')) {
        mangaService.updateEpisodeStatus(ep.id, 'approved');
        loadData();
        if(selectedEpisode?.id === ep.id) setSelectedEpisode({...ep, status: 'approved'});
    }
  };

  // --- Student Flow Handlers ---
  
  const initCreation = (task: MangaTask) => {
      setSelectedTask(task);
      setView('layout_select');
  };

  const confirmLayout = (layout: MangaLayout) => {
      setChosenLayout(layout);
      // Initialize panels for storyboard
      const initialPanels: MangaPanel[] = Array(layout).fill(null).map((_, i) => ({
          index: i,
          type: 'draw',
          dialogue: '',
          imageUrl: '',
          storyboardText: '',
          speechBubbles: [],
      }));
      setEditorPanels(initialPanels);
      setView('storyboard');
  };

  const handleStoryboardChange = (idx: number, text: string) => {
      const newPanels = [...editorPanels];
      newPanels[idx] = { ...newPanels[idx], storyboardText: text };
      setEditorPanels(newPanels);
  };

  const finishStoryboard = () => {
      if (editorPanels.some(p => !p.storyboardText?.trim())) {
          if(!confirm('작성하지 않은 스토리보드 칸이 있습니다. 그래도 그리기로 넘어갈까요?')) return;
      }
      setCurrentPanelIdx(0);
      setView('editor'); // Force transition
  };

  const handleSubmitComic = () => {
    if (!selectedTask) return;
    
    const authorId = isTeacherMode ? 'teacher' : student?.id;
    const authorName = isTeacherMode ? '선생님' : student?.nickname;

    if (!authorId || !authorName) {
        alert('제출하려면 먼저 로그인해 주세요.');
        onLoginRequest();
        return;
    }

    const message = isTeacherMode 
        ? '예시 작품으로 등록하시겠습니까? (즉시 공개됩니다)' 
        : '선생님께 제출하시겠습니까? 제출 후에는 승인 전까지 수정할 수 없습니다.';

    if (!confirm(message)) return;

    const myEpisodes = episodes.filter(e => e.taskId === selectedTask.id && e.studentId === authorId);
    const nextNum = myEpisodes.length + 1;

    const arrangedPanels = editorPanels.map((panel) => autoArrangeBubbles(panel));
    setEditorPanels(arrangedPanels);

    mangaService.submitEpisode(
        selectedTask.id, 
        authorId, 
        authorName, 
        nextNum, 
        chosenLayout, 
        arrangedPanels,
        isTeacherMode // Auto-approve if teacher
    );
    
    loadData();
    setView('list');
    alert(isTeacherMode ? '예시 작품이 등록되었습니다!' : '제출되었습니다! 선생님의 확인을 기다려주세요.');
  };

  // --- Editor Tools ---

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onloadend = () => {
          updatePanel(currentPanelIdx, { type: 'photo', imageUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
      if(fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddBubble = () => {
    const bubble = createDefaultBubble();
    updateCurrentPanel((panel) => ({
      ...panel,
      speechBubbles: [...(panel.speechBubbles || []), bubble],
    }));
    setSelectedBubbleId(bubble.id);
  };

  const handleRemoveBubble = (id: string) => {
    updateCurrentPanel((panel) => ({
      ...panel,
      speechBubbles: (panel.speechBubbles || []).filter((bubble) => bubble.id !== id),
    }));
    if (selectedBubbleId === id) setSelectedBubbleId(null);
  };

  // Canvas Drawing Logic
  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.strokeStyle = brushColor;
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDraw = () => {
    if (!isDrawing || !canvasRef.current) return;
    setIsDrawing(false);
    const url = canvasRef.current.toDataURL();
    updatePanel(currentPanelIdx, { type: 'draw', imageUrl: url });
  };

  const clearCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      updatePanel(currentPanelIdx, { type: 'draw', imageUrl: '' });
  }

  const updatePanel = (idx: number, data: Partial<MangaPanel>) => {
    const newPanels = [...editorPanels];
    newPanels[idx] = { ...newPanels[idx], ...data };
    setEditorPanels(newPanels);
  };

  const askAssistant = async () => {
    const hint = await mangaService.getAssistantHint();
    setAssistantHint(hint);
  };

  // --- Gallery & Detail Handlers ---

  const handleOpenDetail = (ep: MangaEpisode) => {
      setSelectedEpisode(ep);
      setView('detail');
  };

  const handleAddComment = () => {
      if (!selectedEpisode || !commentInput.trim()) return;
      
      const author = isTeacherMode ? '선생님' : student?.nickname || '익명';
      const newComment = mangaService.addComment(selectedEpisode.id, author, commentInput);
      
      // Update local state to reflect immediately
      setSelectedEpisode({
          ...selectedEpisode,
          comments: [...selectedEpisode.comments, newComment]
      });
      setCommentInput('');
      loadData(); // Sync global state
  };

  const handleLike = (epId: string) => {
      mangaService.toggleLike(epId);
      loadData();
      if (selectedEpisode && selectedEpisode.id === epId) {
          setSelectedEpisode({ ...selectedEpisode, likes: selectedEpisode.likes + 1 });
      }
  };

  const handleDownloadPdf = async () => {
    if (!selectedEpisode || !pdfRef.current) return;
    const canvas = await html2canvas(pdfRef.current, { scale: 2, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
    doc.save(`${selectedEpisode.studentName || 'comic'}-episode-${selectedEpisode.episodeNumber}.pdf`);
  };

  // --- Views ---

  // 1. Task List & Gallery
  if (view === 'list') {
    return (
        <div className={`${embedded ? 'h-full' : 'min-h-screen'} bg-purple-50 flex flex-col font-sans`}>
            {!embedded && (
                <header className="bg-white p-4 shadow-sm flex justify-between items-center sticky top-0 z-10">
                    <div className="flex items-center gap-2">
                        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full text-gray-600"><Home size={20}/></button>
                        <h1 className="text-xl font-bold text-purple-900 font-hand">만화 그리기 🎨</h1>
                    </div>
                    {isTeacherMode && (
                        <div className="flex gap-2">
                            <button onClick={() => setView('create_task')} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1"><Plus size={16}/>과제 만들기</button>
                        </div>
                    )}
                </header>
            )}
            
            {/* Embedded Header Controls */}
            {embedded && isTeacherMode && (
                <div className="flex gap-2 p-4 justify-end bg-white/50">
                    <button onClick={() => setView('create_task')} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1"><Plus size={16}/>과제 만들기</button>
                </div>
            )}

            <main className="p-4 max-w-6xl mx-auto w-full space-y-8">
                {/* Active Tasks Section */}
                <section>
                    <h2 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2"><PenTool size={20}/> 진행 중인 과제</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {tasks.map(task => (
                            <div key={task.id} className="bg-white p-6 rounded-2xl shadow-md border-l-4 border-purple-500 hover:shadow-lg transition-all">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-xl text-gray-800">{task.title}</h3>
                                    {isTeacherMode && <button onClick={() => handleDeleteTask(task.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button>}
                                </div>
                                <p className="text-gray-600 mb-4 text-sm">{task.description}</p>
                                <button 
                                    onClick={() => initCreation(task)}
                                    className="w-full bg-purple-50 text-purple-600 py-3 rounded-xl font-bold hover:bg-purple-100 transition-colors"
                                >
                                    {isTeacherMode ? '예시 작품 만들기 ✏️' : '만화 그리기 ✏️'}
                                </button>
                            </div>
                        ))}
                        {tasks.length === 0 && <div className="text-gray-400 text-sm p-4">등록된 과제가 없습니다.</div>}
                    </div>
                </section>

                {/* Gallery Section */}
                <section>
                    <h2 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2"><Layout size={20}/> 우리반 만화 갤러리</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {/* Show all if teacher, only approved if student */}
                        {episodes.filter(e => isTeacherMode || e.status === 'approved' || (student && e.studentId === student.id)).map(ep => {
                            const task = tasks.find(t => t.id === ep.taskId);
                            const thumb = ep.panels[0].imageUrl || 'https://via.placeholder.com/150?text=No+Image';
                            const isPending = ep.status === 'pending';
                            
                            return (
                                <div key={ep.id} onClick={() => handleOpenDetail(ep)} className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group relative">
                                    <div className="aspect-square bg-gray-100 relative overflow-hidden">
                                        <img src={thumb} alt="thumbnail" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                        {isPending && (
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-sm">
                                                승인 대기중
                                            </div>
                                        )}
                                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 text-white text-xs">
                                            {ep.studentName}
                                        </div>
                                    </div>
                                    <div className="p-3">
                                        <h4 className="font-bold text-sm truncate">{task?.title}</h4>
                                        <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                                            <span>{ep.layout}컷 만화</span>
                                            <div className="flex items-center gap-1 text-pink-500">
                                                <Heart size={10} fill="currentColor"/> {ep.likes}
                                                <MessageSquare size={10} className="ml-1"/> {ep.comments.length}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                         {episodes.length === 0 && <div className="text-gray-400 text-sm col-span-full text-center py-10">아직 등록된 작품이 없습니다.</div>}
                    </div>
                </section>
            </main>
        </div>
    );
  }

  // 2. Create Task (Teacher)
  if (view === 'create_task') {
      return (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 absolute inset-0 z-50">
              <div className="bg-white w-full max-w-md p-6 rounded-2xl shadow-xl">
                  <h2 className="text-xl font-bold mb-6 text-gray-800">새 과제 만들기</h2>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">주제 (제목)</label>
                          <input type="text" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} className="w-full border rounded-lg p-3" placeholder="예: 환경 보호 만화"/>
                      </div>
                      <div>
                          <label className="block text-sm font-bold text-gray-700 mb-1">설명 (테마)</label>
                          <textarea value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} className="w-full border rounded-lg p-3" placeholder="학생들에게 줄 가이드를 적어주세요."/>
                      </div>
                      <div className="flex items-center gap-2">
                          <input type="checkbox" checked={newTaskSerial} onChange={e => setNewTaskSerial(e.target.checked)} id="serial" className="w-5 h-5 accent-purple-600"/>
                          <label htmlFor="serial" className="text-sm font-bold text-gray-700">연재 허용</label>
                      </div>
                      <div className="flex gap-2 pt-4">
                          <button onClick={() => setView('list')} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold">취소</button>
                          <button onClick={handleCreateTask} className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold">만들기</button>
                      </div>
                  </div>
              </div>
          </div>
      )
  }

  // 3. Layout Selection
  if (view === 'layout_select') {
      return (
          <div className="min-h-screen bg-purple-50 flex items-center justify-center p-4 absolute inset-0 z-50">
              <div className="bg-white max-w-2xl w-full rounded-3xl shadow-xl p-8 text-center animate-fade-in-up">
                  <h2 className="text-3xl font-hand font-bold text-purple-900 mb-2">몇 컷 만화를 그릴까요?</h2>
                  <p className="text-gray-500 mb-8">원하는 칸 수를 선택해주세요.</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      {[4, 6, 8].map((num) => (
                          <button 
                            key={num}
                            onClick={() => confirmLayout(num as MangaLayout)}
                            className="flex flex-col items-center gap-4 p-6 rounded-2xl border-2 border-purple-100 hover:border-purple-500 hover:bg-purple-50 transition-all group"
                          >
                              <div className="bg-white p-2 rounded shadow-sm group-hover:scale-110 transition-transform">
                                  <Grid size={48} className="text-purple-300 group-hover:text-purple-600" />
                              </div>
                              <span className="text-xl font-bold text-gray-700 group-hover:text-purple-700">{num}컷</span>
                          </button>
                      ))}
                  </div>
                  <button onClick={() => setView('list')} className="mt-8 text-gray-400 hover:text-gray-600 underline">돌아가기</button>
              </div>
          </div>
      )
  }

  // 4. Storyboard
  if (view === 'storyboard') {
      return (
          <div className="min-h-screen bg-yellow-50 flex flex-col font-sans absolute inset-0 z-50 overflow-hidden">
              <header className="bg-white p-4 shadow-sm flex justify-between items-center shrink-0">
                  <h1 className="text-xl font-bold text-yellow-800 font-hand flex items-center gap-2">
                      <FileText /> 스토리보드 기획
                  </h1>
                  <button onClick={finishStoryboard} className="bg-yellow-500 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-yellow-600 shadow-md">
                      그리기 시작 <ArrowRight size={18}/>
                  </button>
              </header>
              <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-4xl mx-auto w-full">
                  <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                      <h2 className="text-lg font-bold text-gray-800 mb-2">💡 어떤 이야기를 그릴까요?</h2>
                      <p className="text-sm text-gray-500">각 컷에 들어갈 내용을 글로 미리 정리해보세요. 그림 그릴 때 큰 도움이 됩니다!</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {editorPanels.map((panel, idx) => (
                          <div key={idx} className="bg-white p-4 rounded-xl border-2 border-yellow-100 shadow-sm">
                              <div className="text-xs font-bold text-yellow-600 mb-2">{idx + 1}번째 컷</div>
                              <textarea 
                                value={panel.storyboardText} 
                                onChange={e => handleStoryboardChange(idx, e.target.value)}
                                className="w-full h-24 border rounded-lg p-3 resize-none focus:ring-2 focus:ring-yellow-400 outline-none text-sm"
                                placeholder={`예: 주인공이 ${idx===0 ? '등장한다' : '놀란다'}...`}
                              />
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )
  }

  // 5. Editor
  if (view === 'editor' && selectedTask) {
      const currentPanel = editorPanels[currentPanelIdx];
      const displayPanelType = currentPanel?.type === 'ai' ? 'photo' : currentPanel?.type;
      const currentBubbles = currentPanel?.speechBubbles || [];
      const selectedBubble = currentBubbles.find((b) => b.id === selectedBubbleId) || null;

      return (
          <div className="min-h-screen bg-gray-100 flex flex-col font-sans h-screen overflow-hidden absolute inset-0 z-50">
              {/* Editor Header */}
              <header className="bg-white p-3 border-b flex justify-between items-center shrink-0">
                  <button onClick={() => setView('storyboard')} className="text-gray-500 flex items-center gap-1 text-sm"><ArrowRight size={16} className="rotate-180"/> 스토리보드</button>
                  <div className="text-center">
                      <h1 className="font-bold text-gray-800">{selectedTask.title}</h1>
                      <div className="text-xs text-gray-500">{currentPanelIdx + 1} / {chosenLayout}번째 컷 작업 중</div>
                  </div>
                  <button onClick={handleSubmitComic} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1">
                      <Send size={16}/> 제출
                  </button>
              </header>

              <div className="flex-1 flex overflow-hidden">
                  {/* Left: Panel Preview List */}
                  <div className="w-32 bg-gray-50 border-r overflow-y-auto p-2 space-y-3 hidden sm:block">
                      {editorPanels.map((p, i) => (
                          <div 
                            key={i} 
                            onClick={() => setCurrentPanelIdx(i)}
                            className={`aspect-square border-2 rounded-lg bg-white cursor-pointer relative group ${currentPanelIdx === i ? 'border-purple-500 ring-2 ring-purple-200' : 'border-gray-200'}`}
                          >
                              {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-cover rounded-md"/> : <span className="absolute inset-0 flex items-center justify-center text-gray-300 text-xs">{i+1}</span>}
                              {/* Dialogue Preview Badge */}
                              {(p.speechBubbles || []).length > 0 && <div className="absolute bottom-1 right-1 bg-purple-400 w-3 h-3 rounded-full border border-white"></div>}
                          </div>
                      ))}
                  </div>

                  {/* Center: Workspace */}
                  <div className="flex-1 bg-gray-200 p-4 flex flex-col items-center overflow-y-auto gap-4 pb-8">
                       {/* Storyboard Reference (Toggleable or Always Visible on top) */}
                       {currentPanel.storyboardText && (
                           <div className="bg-yellow-100 text-yellow-800 p-3 rounded-lg mb-4 text-sm w-full max-w-lg shadow-sm border border-yellow-200">
                               <span className="font-bold mr-2">📜 계획:</span>
                               {currentPanel.storyboardText}
                           </div>
                       )}

                       {/* Canvas Area */}
                       <div className="w-full max-w-[420px] sm:max-w-[520px] md:max-w-[640px] lg:max-w-[760px] sticky top-4 z-10">
                         <div
                           ref={editorAreaRef}
                           className="bg-white w-full aspect-square shadow-lg rounded-xl overflow-hidden relative border border-gray-300 flex flex-col"
                           style={{
                             transform: `scale(${canvasScale})`,
                             transformOrigin: 'center top',
                           }}
                         >
                            {/* Drawing Mode */}
                            {displayPanelType === 'draw' && (
                                <div className="relative flex-1 bg-white cursor-crosshair touch-none select-none" style={{ touchAction: 'none' }}>
                                    <canvas 
                                        ref={canvasRef}
                                        width={512}
                                        height={512}
                                        className="w-full h-full touch-none"
                                        style={{ touchAction: 'none' }}
                                        onMouseDown={startDraw}
                                        onMouseMove={draw}
                                        onMouseUp={stopDraw}
                                        onMouseLeave={stopDraw}
                                        onTouchStart={startDraw}
                                        onTouchMove={draw}
                                        onTouchEnd={stopDraw}
                                    />
                                    <button onClick={clearCanvas} className="absolute top-2 right-2 bg-white/80 p-2 rounded shadow text-xs">지우기</button>
                                </div>
                            )}

                            {/* AI / Photo Mode Preview */}
                            {(displayPanelType === 'photo' || currentPanel.type === 'ai') && (
                                <div className="flex-1 bg-gray-50 flex items-center justify-center relative">
                                    {currentPanel.imageUrl ? (
                                        <img src={currentPanel.imageUrl} className="w-full h-full object-contain" />
                                    ) : (
                                        <div className="text-gray-400 text-center p-4">
                                            사진을 업로드해주세요.
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {/* Speech Bubbles Overlay */}
                            <div className="absolute inset-0 pointer-events-none">
                              {(currentPanel.speechBubbles || []).map((bubble) => (
                                <div key={bubble.id} className="absolute inset-0 pointer-events-none">
                                  <div
                                    className={`absolute px-4 py-2 text-sm font-bold text-gray-700 pointer-events-auto cursor-move ${getBubbleShapeClass(bubble.shape)}`}
                                    style={{
                                      left: `${bubble.x}%`,
                                      top: `${bubble.y}%`,
                                      backgroundColor: bubble.color,
                                      opacity: bubble.opacity,
                                      transform: 'translate(-50%, -50%)',
                                      width: `${bubble.width}%`,
                                      height: `${bubble.height}%`,
                                      borderColor: bubble.borderColor,
                                      borderWidth: `${bubble.borderWidth}px`,
                                      borderStyle: 'solid',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                    onPointerDown={(e) => handleBubblePointerDown(e, bubble)}
                                  >
                                    {bubble.text || '말풍선'}
                                  </div>
                                  <svg
                                    className="absolute pointer-events-auto cursor-pointer"
                                    width="28"
                                    height="28"
                                    viewBox="0 0 100 100"
                                    style={{
                                      left: `${bubble.tailX}%`,
                                      top: `${bubble.tailY}%`,
                                      transform: `translate(-50%, -50%) rotate(${getTailAngle(bubble)}deg)`,
                                      opacity: bubble.opacity,
                                    }}
                                    onPointerDown={(e) => handleTailPointerDown(e, bubble)}
                                  >
                                    <polygon
                                      points="50,0 0,100 100,100"
                                      fill={bubble.color}
                                      stroke="transparent"
                                      strokeWidth={0}
                                    />
                                  </svg>
                                  <div
                                    className="absolute w-4 h-4 bg-white pointer-events-auto cursor-nwse-resize"
                                    style={{
                                      left: `${bubble.x + bubble.width / 2}%`,
                                      top: `${bubble.y + bubble.height / 2}%`,
                                      transform: 'translate(-50%, -50%)',
                                      borderColor: bubble.borderColor,
                                      borderWidth: `${bubble.borderWidth}px`,
                                      borderStyle: 'solid',
                                    }}
                                    onPointerDown={(e) => handleResizePointerDown(e, bubble)}
                                  />
                                </div>
                              ))}
                            </div>
                            
                         </div>
                       </div>

                       {/* Tools Panel */}
                       <div className="w-full max-w-[420px] sm:max-w-[520px] md:max-w-[640px] lg:max-w-[760px] mt-4 bg-white rounded-xl shadow-sm p-4 space-y-4">
                            <div className="text-xs font-bold text-gray-500">도구 설정</div>
                            {/* Mode Switcher */}
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                {[
                                    {id: 'draw', icon: PenTool, label: '그리기'},
                                    {id: 'photo', icon: Upload, label: '사진'}
                                ].map(m => (
                                    <button 
                                        key={m.id}
                                        onClick={() => updatePanel(currentPanelIdx, { type: m.id as any })}
                                        className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-1 transition-colors ${displayPanelType === m.id ? 'bg-white shadow text-purple-600' : 'text-gray-500'}`}
                                    >
                                        <m.icon size={14}/> {m.label}
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-bold text-gray-500">캔버스 확대/축소</div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setCanvasScale((prev) => Math.max(0.7, Number((prev - 0.1).toFixed(2))))}
                                  className="h-9 w-9 rounded-lg border border-gray-200 bg-white text-gray-600 font-bold"
                                >
                                  -
                                </button>
                                <div className="text-xs font-bold text-gray-600 w-12 text-center">{Math.round(canvasScale * 100)}%</div>
                                <button
                                  type="button"
                                  onClick={() => setCanvasScale((prev) => Math.min(1.5, Number((prev + 0.1).toFixed(2))))}
                                  className="h-9 w-9 rounded-lg border border-gray-200 bg-white text-gray-600 font-bold"
                                >
                                  +
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCanvasScale(1)}
                                  className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-gray-600 text-xs font-bold"
                                >
                                  초기화
                                </button>
                              </div>
                            </div>

                            {/* Draw Tools */}
                            {displayPanelType === 'draw' && (
                              <div className="space-y-3 animate-fade-in-up">
                                <div className="flex flex-col sm:flex-row gap-2">
                                        <button 
                                    type="button"
                                    onClick={() => setIsEraser(false)}
                                    className={`h-12 px-4 rounded-xl text-sm font-bold border flex items-center justify-center gap-2 ${!isEraser ? 'bg-white border-purple-300 text-purple-700 shadow-sm' : 'bg-gray-50 text-gray-500 border-gray-200'}`}
                                  >
                                    <PenTool size={16} /> 그리기
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setIsEraser(true)}
                                    className={`h-12 px-4 rounded-xl text-sm font-bold border flex items-center justify-center gap-2 ${isEraser ? 'bg-white border-purple-300 text-purple-700 shadow-sm' : 'bg-gray-50 text-gray-500 border-gray-200'}`}
                                  >
                                    <Eraser size={16} /> 지우기
                                        </button>
                                    </div>
                                <div>
                                  <label className="text-xs font-bold text-gray-500 mb-2 block">선 굵기</label>
                                  <input
                                    type="range"
                                    min={2}
                                    max={24}
                                    value={brushSize}
                                    onChange={(e) => setBrushSize(Number(e.target.value))}
                                    className="w-full"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-bold text-gray-500 mb-2 block">색상</label>
                                  <div className="flex gap-2 flex-wrap">
                                    {PASTEL_COLORS.map((color) => (
                                      <button
                                        key={color}
                                        type="button"
                                        onClick={() => {
                                          setBrushColor(color);
                                          setIsEraser(false);
                                        }}
                                        className={`w-8 h-8 rounded-full border-2 ${brushColor === color && !isEraser ? 'border-purple-500 ring-2 ring-purple-200' : 'border-gray-200'}`}
                                        style={{ backgroundColor: color }}
                                        aria-label="브러시 색상"
                                      />
                                    ))}
                                  </div>
                                    </div>
                                </div>
                            )}

                            {/* Photo Upload Tool */}
                            {displayPanelType === 'photo' && (
                                <div className="space-y-2 animate-fade-in-up">
                                    <input 
                                        type="file" 
                                        ref={fileInputRef}
                                        accept="image/*"
                                        onChange={handlePhotoUpload}
                                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                                    />
                                    <p className="text-xs text-gray-400">내 컴퓨터의 사진을 올릴 수 있어요.</p>
                                </div>
                            )}

                            {/* Speech Bubble Tools */}
                            <div className="space-y-3">
                              <div className="text-xs font-bold text-gray-500">말풍선 설정</div>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <button
                                  type="button"
                                  onClick={handleAddBubble}
                                  className="h-12 px-4 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 w-full sm:w-auto"
                                >
                                  말풍선 추가
                                </button>
                                <div className="text-xs text-gray-500 flex items-center">
                                  말풍선을 드래그해 위치를, 꼬리를 드래그해 방향을 조절하세요.
                                </div>
                              </div>
                              {currentBubbles.length === 0 && (
                                <div className="text-xs text-gray-400">추가된 말풍선이 없습니다.</div>
                              )}
                              {currentBubbles.length > 0 && (
                                <div className="flex gap-2 flex-wrap">
                                  {currentBubbles.map((bubble) => (
                                    <button
                                      key={bubble.id}
                                      type="button"
                                      onClick={() => setSelectedBubbleId(bubble.id)}
                                      className={`px-3 py-2 rounded-lg text-xs font-bold border ${selectedBubbleId === bubble.id ? 'border-purple-500 text-purple-700 bg-purple-50' : 'border-gray-200 text-gray-500 bg-white'}`}
                                    >
                                      말풍선 {currentBubbles.indexOf(bubble) + 1}
                                    </button>
                                  ))}
                                </div>
                              )}
                              {selectedBubble && (
                                <div className="space-y-3 border rounded-xl p-3 bg-gray-50">
                                  <div className="flex justify-between items-center">
                                    <div className="text-xs font-bold text-gray-600">말풍선 설정</div>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveBubble(selectedBubble.id)}
                                      className="text-xs text-red-500 underline"
                                    >
                                      삭제
                                    </button>
                                  </div>
                                <input 
                                    type="text" 
                                    value={selectedBubble.text}
                                    onChange={(e) => updateBubble(selectedBubble.id, { text: e.target.value })}
                                    className="w-full border rounded-lg px-3 py-2 text-sm"
                                    placeholder="말풍선 내용을 입력하세요"
                                  />
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-xs font-bold text-gray-500 mb-1 block">모양</label>
                                      <select
                                        value={selectedBubble.shape}
                                        onChange={(e) => updateBubble(selectedBubble.id, { shape: e.target.value as SpeechBubbleShape })}
                                        className="w-full border rounded-lg px-2 py-2 text-sm bg-white"
                                      >
                                        <option value="oval">타원</option>
                                        <option value="round">둥근 사각</option>
                                        <option value="rect">사각</option>
                                        <option value="cloud">구름</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-xs font-bold text-gray-500 mb-1 block">투명도</label>
                                      <input
                                        type="range"
                                        min={0.2}
                                        max={1}
                                        step={0.05}
                                        value={selectedBubble.opacity}
                                        onChange={(e) => updateBubble(selectedBubble.id, { opacity: Number(e.target.value) })}
                                        className="w-full"
                                      />
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-xs font-bold text-gray-500 mb-1 block">가로 크기</label>
                                      <input
                                        type="range"
                                        min={12}
                                        max={90}
                                        value={selectedBubble.width}
                                        onChange={(e) => updateBubble(selectedBubble.id, { width: Number(e.target.value) })}
                                        className="w-full"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs font-bold text-gray-500 mb-1 block">세로 크기</label>
                                      <input
                                        type="range"
                                        min={8}
                                        max={60}
                                        value={selectedBubble.height}
                                        onChange={(e) => updateBubble(selectedBubble.id, { height: Number(e.target.value) })}
                                        className="w-full"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-xs font-bold text-gray-500 mb-1 block">색상</label>
                                    <div className="flex gap-2 flex-wrap">
                                      {PASTEL_COLORS.map((color) => (
                                        <button
                                          key={color}
                                          type="button"
                                          onClick={() => updateBubble(selectedBubble.id, { color })}
                                          className={`w-8 h-8 rounded-full border-2 ${selectedBubble.color === color ? 'border-purple-500 ring-2 ring-purple-200' : 'border-gray-200'}`}
                                          style={{ backgroundColor: color }}
                                          aria-label="말풍선 색상"
                                        />
                                      ))}
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-xs font-bold text-gray-500 mb-1 block">테두리 색</label>
                                      <div className="flex gap-2 flex-wrap">
                                        {['#1F2937', '#2563EB', '#7C3AED', '#F97316', '#0EA5E9', '#16A34A'].map((color) => (
                                          <button
                                            key={color}
                                            type="button"
                                            onClick={() => updateBubble(selectedBubble.id, { borderColor: color })}
                                            className={`w-7 h-7 rounded-full border-2 ${selectedBubble.borderColor === color ? 'border-purple-500 ring-2 ring-purple-200' : 'border-gray-200'}`}
                                            style={{ backgroundColor: color }}
                                            aria-label="말풍선 테두리 색"
                                          />
                                        ))}
                                      </div>
                                    </div>
                                    <div>
                                      <label className="text-xs font-bold text-gray-500 mb-1 block">테두리 굵기</label>
                                      <input
                                        type="range"
                                        min={1}
                                        max={6}
                                        value={selectedBubble.borderWidth}
                                        onChange={(e) => updateBubble(selectedBubble.id, { borderWidth: Number(e.target.value) })}
                                        className="w-full"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Navigation */}
                            <div className="flex justify-between pt-2">
                                <button 
                                    disabled={currentPanelIdx === 0}
                                    onClick={() => setCurrentPanelIdx(p => p - 1)}
                                    className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-bold disabled:opacity-50"
                                >
                                    이전
                                </button>
                                <span className="flex items-center text-sm font-bold text-gray-500">
                                    {currentPanelIdx + 1} / {chosenLayout}
                                </span>
                                <button 
                                    disabled={currentPanelIdx === chosenLayout - 1}
                                    onClick={() => setCurrentPanelIdx(p => p + 1)}
                                    className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-bold disabled:opacity-50"
                                >
                                    다음
                                </button>
                            </div>
                       </div>
                  </div>
              </div>
          </div>
      )
  }

  // 6. Detail View (View + Comments)
  if (view === 'detail' && selectedEpisode) {
      const task = tasks.find(t => t.id === selectedEpisode.taskId);
      return (
          <div className="min-h-screen bg-gray-900 flex flex-col items-center p-4 overflow-y-auto absolute inset-0 z-50">
              <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[80vh]">
                  
                  {/* Left: Comic Strip */}
                  <div className="flex-1 bg-gray-100 p-6 overflow-y-auto max-h-[80vh] custom-scrollbar">
                      <div className="mb-6 flex justify-between items-center">
                          <div>
                              <h2 className="text-2xl font-bold text-gray-800">{task?.title}</h2>
                              <p className="text-gray-500">작가: {selectedEpisode.studentName}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={handleDownloadPdf} className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-purple-700">
                              <Download size={16} /> PDF 저장
                            </button>
                          <button onClick={() => setView('list')} className="p-2 bg-white rounded-full shadow hover:bg-gray-50 text-gray-600"><X size={20}/></button>
                          </div>
                      </div>

                      <div className={`grid gap-4 ${selectedEpisode.layout === 4 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3'}`}>
                          {selectedEpisode.panels.map((panel, i) => (
                              <div key={i} className="aspect-square bg-white rounded-lg shadow-sm border-2 border-gray-800 overflow-hidden relative">
                                  {panel.imageUrl && <img src={panel.imageUrl} className="w-full h-full object-contain" />}
                                  <div className="absolute top-2 left-2 bg-black/50 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">{i+1}</div>
                                  {(panel.speechBubbles || []).map((bubble) => (
                                    <div key={bubble.id} className="absolute inset-0 pointer-events-none">
                                      <div
                                        className={`absolute px-3 py-1 text-xs font-bold text-gray-700 border-2 border-gray-800 ${getBubbleShapeClass(bubble.shape)}`}
                                        style={{
                                          left: `${bubble.x}%`,
                                          top: `${bubble.y}%`,
                                          backgroundColor: bubble.color,
                                          opacity: bubble.opacity,
                                          transform: 'translate(-50%, -50%)',
                                          width: `${bubble.width}%`,
                                          height: `${bubble.height}%`,
                                          borderColor: bubble.borderColor,
                                          borderWidth: `${bubble.borderWidth}px`,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                        }}
                                      >
                                        {bubble.text || ''}
                                      </div>
                                      <svg
                                        className="absolute"
                                        width="20"
                                        height="20"
                                        viewBox="0 0 100 100"
                                        style={{
                                          left: `${bubble.tailX}%`,
                                          top: `${bubble.tailY}%`,
                                          transform: `translate(-50%, -50%) rotate(${getTailAngle(bubble)}deg)`,
                                          opacity: bubble.opacity,
                                        }}
                                      >
                                        <polygon
                                          points="50,0 0,100 100,100"
                                          fill={bubble.color}
                                          stroke="transparent"
                                          strokeWidth={0}
                                        />
                                      </svg>
                                    </div>
                                  ))}
                              </div>
                          ))}
                      </div>

                      <div className="absolute -left-[9999px] top-0">
                        <div
                          ref={pdfRef}
                          style={{
                            width: '794px',
                            height: '1123px',
                            backgroundColor: '#ffffff',
                            padding: '24px',
                            boxSizing: 'border-box',
                          }}
                        >
                          {(() => {
                            const { rows, cols } = getGridForLayout(selectedEpisode.layout);
                            return (
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                                  gridTemplateRows: `repeat(${rows}, 1fr)`,
                                  gap: '16px',
                                  width: '100%',
                                  height: '100%',
                                }}
                              >
                                {selectedEpisode.panels.map((panel, index) => (
                                  <div
                                    key={panel.index}
                                    style={{
                                      position: 'relative',
                                      border: '2px solid #1F2937',
                                      borderRadius: '12px',
                                      overflow: 'hidden',
                                      background: '#ffffff',
                                    }}
                                  >
                                    {panel.imageUrl && (
                                      <img
                                        src={panel.imageUrl}
                                        alt={`panel-${index}`}
                                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                      />
                                    )}
                                    {(panel.speechBubbles || []).map((bubble) => (
                                      <div key={bubble.id} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                                        <div
                                          style={{
                                            position: 'absolute',
                                            left: `${bubble.x}%`,
                                            top: `${bubble.y}%`,
                                            transform: 'translate(-50%, -50%)',
                                            width: `${bubble.width}%`,
                                            height: `${bubble.height}%`,
                                            backgroundColor: bubble.color,
                                            opacity: bubble.opacity,
                                            borderColor: bubble.borderColor,
                                            borderWidth: `${bubble.borderWidth}px`,
                                            borderStyle: 'solid',
                                            borderRadius: bubble.shape === 'rect' ? '8px' : bubble.shape === 'round' ? '20px' : bubble.shape === 'cloud' ? '40%' : '999px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '12px',
                                            fontWeight: 700,
                                            color: '#374151',
                                            padding: '6px',
                                            textAlign: 'center',
                                          }}
                                        >
                                          {bubble.text}
                                        </div>
                                        <svg
                                          width="10"
                                          height="10"
                                          viewBox="0 0 100 100"
                                          style={{
                                            position: 'absolute',
                                            left: `${bubble.tailX}%`,
                                            top: `${bubble.tailY}%`,
                                            transform: `translate(-50%, -50%) rotate(${getTailAngle(bubble)}deg)`,
                                            opacity: bubble.opacity,
                                          }}
                                        >
                                          <polygon
                                            points="50,0 0,100 100,100"
                                            fill={bubble.color}
                                            stroke="transparent"
                                            strokeWidth={0}
                                          />
                                        </svg>
                              </div>
                          ))}
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      
                      {/* Teacher Approval Button */}
                      {isTeacherMode && selectedEpisode.status === 'pending' && (
                          <div className="mt-8 text-center bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                              <p className="mb-2 font-bold text-yellow-800">승인 대기 중인 작품입니다.</p>
                              <button onClick={() => handleApprove(selectedEpisode)} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700">
                                  공개 승인하기
                              </button>
                          </div>
                      )}
                  </div>

                  {/* Right: Comments */}
                  <div className="w-full md:w-80 bg-white border-l border-gray-200 flex flex-col">
                      <div className="p-4 border-b border-gray-100">
                          <div className="flex items-center gap-2 mb-2">
                              <Heart 
                                className={`cursor-pointer transition-colors ${selectedEpisode.likes > 0 ? 'fill-pink-500 text-pink-500' : 'text-gray-400'}`}
                                onClick={() => handleLike(selectedEpisode.id)} 
                              />
                              <span className="font-bold text-gray-700">{selectedEpisode.likes}명이 좋아해요</span>
                          </div>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-4 space-y-4">
                          <h3 className="font-bold text-gray-800 flex items-center gap-2"><MessageSquare size={16}/> 댓글 {selectedEpisode.comments.length}</h3>
                          {selectedEpisode.comments.map(comment => (
                              <div key={comment.id} className="bg-gray-50 p-3 rounded-xl text-sm">
                                  <span className="font-bold text-purple-700 block mb-1">{comment.author}</span>
                                  <span className="text-gray-700">{comment.content}</span>
                              </div>
                          ))}
                          {selectedEpisode.comments.length === 0 && <p className="text-gray-400 text-center py-10 text-sm">첫 번째 댓글을 남겨보세요!</p>}
                      </div>

                      <div className="p-4 border-t border-gray-100">
                          <div className="flex gap-2">
                              <input 
                                type="text" 
                                value={commentInput}
                                onChange={e => setCommentInput(e.target.value)}
                                className="flex-1 bg-gray-100 border-none rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                                placeholder="멋진 말을 남겨주세요..."
                                onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                              />
                              <button onClick={handleAddComment} disabled={!commentInput.trim()} className="bg-purple-600 text-white p-2 rounded-full hover:bg-purple-700 disabled:bg-gray-300">
                                  <Send size={16} />
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )
  }

  return <div>Loading...</div>;
};
