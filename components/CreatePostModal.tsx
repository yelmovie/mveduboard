
import React, { useState, useRef, useEffect } from 'react';
import { LayoutType, PostColor } from '../types';
import { X, Image as ImageIcon, Calendar, Youtube, Upload, Palette, Calculator } from 'lucide-react';
import { resizeAndCompressImage, resizeAndCompressImageForAlbum } from '../src/lib/image/resizeCompress';
import { uploadImageWithQuota, uploadImageWithoutQuota, uploadFileWithoutQuota } from '../src/lib/supabase/storage';
import { supabase } from '../src/lib/supabase/client';
import { DAILY_IMAGE_LIMIT, MAX_ALBUM_IMAGES } from '../src/constants/limits';
import { logBetaEvent } from '../src/lib/supabase/events';
import { getErrorMessage } from '../src/utils/errors';
import { checkAndIncrementLocalQuota } from '../src/lib/image/localQuota';
import { generateUUID } from '../src/utils/uuid';
import { getCurrentUserProfile } from '../src/lib/supabase/auth';
import { getWritingTopics, createWritingTopic, getWritingCategories, WritingTopic } from '../src/lib/supabase/writingTopics';
import {
  MIN_WRITING_CHARS,
  WRITING_RULES_LS_KEY,
  WRITING_RULES_TEXT,
  WRITING_RULES_TITLE,
  WRITING_ALL_CATEGORY,
  WRITING_TOPIC_LS_KEY,
  WRITING_FALLBACK_TOPICS,
  MIN_LEARNING_NOTE_CHARS,
  LEARNING_NOTE_RULES_LS_KEY,
  LEARNING_NOTE_RULES_TEXT,
  LEARNING_NOTE_RULES_TITLE,
  LEARNING_NOTE_HINT,
  LEARNING_NOTE_KEYWORDS,
  MIN_READING_LOG_CHARS,
  READING_LOG_RULES_LS_KEY,
  READING_LOG_RULES_TEXT,
  READING_LOG_RULES_TITLE,
  READING_LOG_HINT,
  READING_LOG_KEYWORDS,
} from '../src/constants/writing';

interface CreatePostModalProps {
  layout: LayoutType;
  onClose: () => void;
  onSubmit: (data: { title: string; body: string; event_date?: string, attachment_url?: string, attachment_urls?: string[], attachment_type?: 'image' | 'video' | 'file', color: PostColor, math_page_range?: string }) => void;
  boardId?: string; // To differentiate Math board
  isTeacherMode?: boolean;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({ layout, onClose, onSubmit, boardId, isTeacherMode }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [color, setColor] = useState<PostColor>('white');
  const [pageRange, setPageRange] = useState(''); // Math specific
  const [topicMode, setTopicMode] = useState<'random' | 'pick'>('random');
  const [topics, setTopics] = useState<WritingTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<WritingTopic | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(WRITING_ALL_CATEGORY);
  const [categories, setCategories] = useState<string[]>([]);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [topicLoadError, setTopicLoadError] = useState<string | null>(null);
  const [showLearningRules, setShowLearningRules] = useState(false);
  const [learningNoteWarning, setLearningNoteWarning] = useState<string | null>(null);
  const [showReadingRules, setShowReadingRules] = useState(false);
  const [readingLogWarning, setReadingLogWarning] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'image' | 'video' | 'file'>('image');
  const [imageUrl, setImageUrl] = useState('');
  const [imageStoragePath, setImageStoragePath] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageStoragePaths, setImageStoragePaths] = useState<string[]>([]);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileStoragePath, setFileStoragePath] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadNotice, setUploadNotice] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const isWritingBoard = boardId === 'writing';
  const isMathBoard = boardId === 'math';
  const isNoticeBoard = boardId === 'notice_board';
  const isAlbumBoard = boardId === 'album';
  const isLearningBoard = boardId === 'learning';
  const isReadingBoard = boardId === 'reading';
  const isAlbumUploadBlocked = isAlbumBoard && !isTeacherMode;
  const bodyLength = body.length;
  const isWritingTooShort = isWritingBoard && bodyLength < MIN_WRITING_CHARS;
  const isLearningTooShort = isLearningBoard && bodyLength < MIN_LEARNING_NOTE_CHARS;
  const isReadingTooShort = isReadingBoard && bodyLength < MIN_READING_LOG_CHARS;
  const filteredTopics =
    selectedCategory === WRITING_ALL_CATEGORY
      ? topics
      : topics.filter((t) => t.category === selectedCategory);

  useEffect(() => {
    if (!isWritingBoard) return;
    const dismissed = localStorage.getItem(WRITING_RULES_LS_KEY) === '1';
    if (!dismissed) {
      setShowRules(true);
    }
  }, [isWritingBoard]);

  useEffect(() => {
    if (!isLearningBoard) return;
    const dismissed = localStorage.getItem(LEARNING_NOTE_RULES_LS_KEY) === '1';
    if (!dismissed) {
      setShowLearningRules(true);
    }
  }, [isLearningBoard]);

  useEffect(() => {
    if (!isReadingBoard) return;
    const dismissed = localStorage.getItem(READING_LOG_RULES_LS_KEY) === '1';
    if (!dismissed) {
      setShowReadingRules(true);
    }
  }, [isReadingBoard]);

  useEffect(() => {
    if (!isWritingBoard) return;
    const run = async () => {
      const [topicsResult, categoriesResult] = await Promise.all([
        getWritingTopics(),
        getWritingCategories(),
      ]);
      const nextTopics = topicsResult.topics.length > 0 ? topicsResult.topics : WRITING_FALLBACK_TOPICS;
      const nextCategories =
        categoriesResult.categories.length > 0
          ? categoriesResult.categories
          : Array.from(new Set(nextTopics.map((t) => t.category)));
      setTopics(nextTopics);
      setTopicLoadError(topicsResult.errorCode || categoriesResult.errorCode || null);
      setCategories(nextCategories);
      if (nextTopics.length > 0 && !selectedTopic) {
        setSelectedTopic(nextTopics[0]);
      }
    };
    run();
  }, [isWritingBoard]);

  useEffect(() => {
    if (!isWritingBoard) return;
    if (filteredTopics.length === 0) return;
    if (!selectedTopic || !filteredTopics.find((t) => t.id === selectedTopic.id)) {
      setSelectedTopic(filteredTopics[0]);
    }
  }, [isWritingBoard, selectedCategory, topics]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAlbumUploadBlocked) {
      alert('우리반 사진첩은 선생님만 올릴 수 있어요.');
      return;
    }
    if (isWritingBoard && bodyLength < MIN_WRITING_CHARS) {
      alert(`내용은 띄어쓰기 포함 ${MIN_WRITING_CHARS}자 이상 써야 해요.`);
      return;
    }
    if (isLearningBoard && bodyLength < MIN_LEARNING_NOTE_CHARS) {
      alert('배움노트는 최소 250자 이상 작성해야 저장할 수 있어요.');
      return;
    }
    if (isReadingBoard && bodyLength < MIN_READING_LOG_CHARS) {
      alert(`독서록은 최소 ${MIN_READING_LOG_CHARS}자 이상 작성해야 저장할 수 있어요.`);
      return;
    }
    
    let finalUrl = undefined;
    let finalUrls: string[] | undefined = undefined;
    let finalType: 'image' | 'video' | 'file' | undefined = undefined;

    if (activeTab === 'image') {
        if (isAlbumBoard && imageUrls.length > 0) {
          finalUrls = imageUrls.map((url, idx) => {
            const storagePath = imageStoragePaths[idx];
            return storagePath ? `storage:${storagePath}` : url;
          });
          finalUrl = finalUrls[0];
          finalType = 'image';
        } else if (imageUrl) {
          finalUrl = imageStoragePath ? `storage:${imageStoragePath}` : imageUrl;
          finalType = 'image';
        }
    } else if (activeTab === 'video' && youtubeUrl) {
        finalUrl = youtubeUrl;
        finalType = 'video';
    } else if (activeTab === 'file' && fileStoragePath) {
        finalUrl = `storage:${fileStoragePath}`;
        finalType = 'file';
    }

    onSubmit({
      title,
      body,
      event_date: eventDate || undefined,
      attachment_url: finalUrl,
      attachment_urls: finalUrls,
      attachment_type: finalType,
      color,
      math_page_range: boardId === 'math' ? pageRange : undefined
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploadNotice('');
    setIsUploading(true);
    setImageStoragePath(null);

    const run = async () => {
        try {
            const resized = await resizeAndCompressImage(file);

            if (!supabase) {
                const localQuota = checkAndIncrementLocalQuota();
                if (!localQuota.allowed) {
                    setUploadError(`오늘은 이미지 ${DAILY_IMAGE_LIMIT}장까지 업로드할 수 있어요. 내일 다시 업로드할 수 있어요 🙂`);
                    await logBetaEvent('upload_blocked_daily_limit');
                    return;
                }
                setImageUrl(resized.previewUrl);
                setUploadNotice('현재는 로컬 저장 모드입니다. 이미지가 내 브라우저에만 저장됩니다.');
                return;
            }

            const { data: userData } = await supabase.auth.getUser();
            const userId = userData.user?.id;
            if (!userId) {
                const localQuota = checkAndIncrementLocalQuota();
                if (!localQuota.allowed) {
                    setUploadError(`오늘은 이미지 ${DAILY_IMAGE_LIMIT}장까지 업로드할 수 있어요. 내일 다시 업로드할 수 있어요 🙂`);
                    await logBetaEvent('upload_blocked_daily_limit');
                    return;
                }
                setImageUrl(resized.previewUrl);
                setUploadNotice('로그인하지 않아 로컬에만 저장됩니다.');
                return;
            }

            setImageUrl(resized.previewUrl);

            const safeName = `${generateUUID()}.jpg`;
            const profile = await getCurrentUserProfile();
            const isTeacher = profile?.role === 'teacher';
            const storageSchoolId = profile?.school_id || boardId || 'board';
            const storageClassId = profile?.class_id || boardId || 'board';
            const uploadResult = isTeacher
                ? await uploadImageWithoutQuota({
                    blob: resized.blob,
                    filename: safeName,
                    schoolId: storageSchoolId,
                    classId: storageClassId,
                    postId: generateUUID(),
                  })
                : await uploadImageWithQuota({
                    blob: resized.blob,
                    filename: safeName,
                    schoolId: storageSchoolId,
                    classId: storageClassId,
                    postId: generateUUID(),
                    userId,
                  });

            if (uploadResult.status === 'quota_blocked') {
                setUploadError(`오늘은 이미지 ${DAILY_IMAGE_LIMIT}장까지 업로드할 수 있어요. 내일 다시 업로드할 수 있어요 🙂`);
                await logBetaEvent('upload_blocked_daily_limit');
                setImageUrl('');
                return;
            }

            if (uploadResult.status === 'upload_failed') {
                const errMsg = (uploadResult as any).error?.message || '알 수 없는 오류';
                console.error('[upload] failed:', errMsg);
                setUploadError(`이미지 업로드 실패: ${errMsg}`);
                return;
            }

            if (uploadResult.status === 'not_configured') {
                setUploadNotice('업로드가 준비되지 않아 로컬에만 저장됩니다.');
                return;
            }

            if (uploadResult.status !== 'uploaded') {
                setUploadNotice('업로드가 준비되지 않아 로컬에만 저장됩니다.');
                return;
            }

            setImageStoragePath(uploadResult.path);
            await logBetaEvent('upload_success');
        } catch (err) {
            setUploadError(getErrorMessage(err, '이미지 처리에 실패했습니다.'));
        } finally {
            setIsUploading(false);
        }
    };
    run();
  };

  const handleMultiImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadError('');
    setUploadNotice('');

    const remaining = MAX_ALBUM_IMAGES - imageUrls.length;
    if (remaining <= 0) {
      setUploadError(`사진은 최대 ${MAX_ALBUM_IMAGES}장까지 올릴 수 있어요.`);
      return;
    }

    const targetFiles = files.slice(0, remaining);
    setIsUploading(true);

    const resizeForAlbum = isAlbumBoard ? resizeAndCompressImageForAlbum : resizeAndCompressImage;
    const BATCH_SIZE = 5;

    const run = async () => {
      const nextUrls: string[] = [];
      const nextPaths: string[] = [];
      let uploadErrorMessage = '';

      if (!supabase) {
        for (const file of targetFiles) {
          try {
            const resized = await resizeForAlbum(file);
            const localQuota = checkAndIncrementLocalQuota();
            if (!localQuota.allowed) {
              setUploadError(`오늘은 이미지 ${DAILY_IMAGE_LIMIT}장까지 업로드할 수 있어요. 내일 다시 업로드할 수 있어요 🙂`);
              hasQuotaError = true;
              break;
            }
            nextUrls.push(resized.previewUrl);
            nextPaths.push('');
          } catch (err) {
            setUploadError(getErrorMessage(err, '이미지 처리에 실패했습니다.'));
          }
        }
        setUploadNotice('현재는 로컬 저장 모드입니다. 이미지가 내 브라우저에만 저장됩니다.');
        if (nextUrls.length > 0) {
          setImageUrls((prev) => [...prev, ...nextUrls]);
          setImageStoragePaths((prev) => [...prev, ...nextPaths]);
        }
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? '';
      const profile = await getCurrentUserProfile();
      const isTeacher = profile?.role === 'teacher';
      const storageSchoolId = profile?.school_id || boardId || 'board';
      const storageClassId = profile?.class_id || boardId || 'board';

      if (!userId) {
        for (const file of targetFiles) {
          const resized = await resizeForAlbum(file);
          const localQuota = checkAndIncrementLocalQuota();
          if (!localQuota.allowed) break;
          nextUrls.push(resized.previewUrl);
          nextPaths.push('');
        }
        setUploadNotice('로그인하지 않아 로컬에만 저장됩니다.');
        if (nextUrls.length > 0) {
          setImageUrls((prev) => [...prev, ...nextUrls]);
          setImageStoragePaths((prev) => [...prev, ...nextPaths]);
        }
        return;
      }

      const processOne = async (file: File): Promise<{ url: string; path: string } | null> => {
        try {
          const resized = await resizeForAlbum(file);
          const localQuota = checkAndIncrementLocalQuota();
          if (!localQuota.allowed) return null;
          const safeName = `${generateUUID()}.jpg`;
          const uploadResult = isTeacher
            ? await uploadImageWithoutQuota({
                blob: resized.blob,
                filename: safeName,
                schoolId: storageSchoolId,
                classId: storageClassId,
                postId: generateUUID(),
              })
            : await uploadImageWithQuota({
                blob: resized.blob,
                filename: safeName,
                schoolId: storageSchoolId,
                classId: storageClassId,
                postId: generateUUID(),
                userId,
              });

          if (uploadResult.status === 'quota_blocked') return null;
          if (uploadResult.status === 'upload_failed') {
            const errMsg = (uploadResult as any).error?.message || '알 수 없는 오류';
            throw new Error(errMsg);
          }
          if (uploadResult.status !== 'uploaded') return { url: resized.previewUrl, path: '' };
          await logBetaEvent('upload_success');
          return { url: resized.previewUrl, path: uploadResult.path };
        } catch (err) {
          const msg = getErrorMessage(err, '이미지 처리에 실패했습니다.');
          if (!uploadErrorMessage) uploadErrorMessage = msg;
          console.error('[upload] multi failed:', err);
          return null;
        }
      };

      for (let i = 0; i < targetFiles.length; i += BATCH_SIZE) {
        const batch = targetFiles.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(processOne));
        for (const r of results) {
          if (r) {
            nextUrls.push(r.url);
            nextPaths.push(r.path);
          }
        }
      }

      if (uploadErrorMessage && nextUrls.length === 0) {
        setUploadError(uploadErrorMessage);
      } else if (uploadErrorMessage && nextUrls.length > 0) {
        setUploadError(`일부 업로드 실패: ${uploadErrorMessage}`);
      }
      if (nextUrls.length > 0) {
        setImageUrls((prev) => [...prev, ...nextUrls]);
        setImageStoragePaths((prev) => [...prev, ...nextPaths]);
      }
    };

    run().finally(() => {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    });
  };

  useEffect(() => {
    if (!isLearningBoard) return;
    if (!body.trim()) {
      setLearningNoteWarning(null);
      return;
    }
    const hasKeyword = LEARNING_NOTE_KEYWORDS.some((k) => body.includes(k));
    setLearningNoteWarning(hasKeyword ? null : LEARNING_NOTE_HINT);
  }, [isLearningBoard, body]);

  useEffect(() => {
    if (!isReadingBoard) return;
    if (!body.trim()) {
      setReadingLogWarning(null);
      return;
    }
    const matches = READING_LOG_KEYWORDS.filter((k) => body.includes(k)).length;
    setReadingLogWarning(matches >= 2 ? null : READING_LOG_HINT);
  }, [isReadingBoard, body]);

  const handleAttachmentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploadNotice('');
    setIsUploading(true);
    setFileStoragePath(null);
    setFileName(file.name);

    const run = async () => {
      try {
        if (!supabase) {
          setUploadError('파일 업로드는 로그인 상태에서만 가능합니다.');
          return;
        }
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) {
          setUploadError('로그인이 필요합니다.');
          return;
        }

        const safeName = `${generateUUID()}_${file.name}`;
        const profile = await getCurrentUserProfile();
        const storageSchoolId = profile?.school_id || boardId || 'board';
        const storageClassId = profile?.class_id || boardId || 'board';
        const uploadResult = await uploadFileWithoutQuota({
          blob: file,
          filename: safeName,
          contentType: file.type || 'application/octet-stream',
          schoolId: storageSchoolId,
          classId: storageClassId,
          postId: generateUUID(),
        });

        if (uploadResult.status !== 'uploaded') {
          setUploadError('파일 업로드에 실패했습니다.');
          return;
        }

        setFileStoragePath(uploadResult.path);
      } catch (err) {
        setUploadError(getErrorMessage(err, '파일 업로드에 실패했습니다.'));
      } finally {
        setIsUploading(false);
      }
    };
    run();
  };

  // Helper to check valid youtube ID for preview (simple check)
  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }
  
  const youtubeId = getYoutubeId(youtubeUrl);

  const COLORS: { id: PostColor; bg: string; border: string }[] = [
    { id: 'white', bg: 'bg-white', border: 'border-gray-200' },
    { id: 'red', bg: 'bg-red-50', border: 'border-red-200' },
    { id: 'orange', bg: 'bg-orange-50', border: 'border-orange-200' },
    { id: 'yellow', bg: 'bg-yellow-50', border: 'border-yellow-200' },
    { id: 'green', bg: 'bg-green-50', border: 'border-green-200' },
    { id: 'blue', bg: 'bg-blue-50', border: 'border-blue-200' },
    { id: 'purple', bg: 'bg-purple-50', border: 'border-purple-200' },
    { id: 'pink', bg: 'bg-pink-50', border: 'border-pink-200' },
  ];

  const applyTopic = (topic: WritingTopic) => {
    setSelectedTopic(topic);
    if (!title.trim()) {
      setTitle(topic.topic);
    }
    localStorage.setItem(WRITING_TOPIC_LS_KEY, topic.topic);
  };

  const pickRandomTopic = () => {
    const pool = filteredTopics.length > 0 ? filteredTopics : topics.length > 0 ? topics : WRITING_FALLBACK_TOPICS;
    if (pool.length === 0) return;
    let next = pool[Math.floor(Math.random() * pool.length)];
    if (selectedTopic && pool.length > 1) {
      let guard = 0;
      while (next.id === selectedTopic.id && guard < 10) {
        next = pool[Math.floor(Math.random() * pool.length)];
        guard += 1;
      }
    }
    setSelectedTopic(next);
  };

  const handleCreateTopic = async () => {
    if (!newTopicTitle.trim()) return;
    if (selectedCategory === WRITING_ALL_CATEGORY) {
      alert('카테고리를 먼저 선택해주세요.');
      return;
    }
    const created = await createWritingTopic(selectedCategory, newTopicTitle.trim());
    if (created) {
      const next = [...topics, created];
      setTopics(next);
      setSelectedTopic(created);
      setNewTopicTitle('');
    } else {
      alert('주제 추가에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className={`rounded-2xl w-full max-w-md shadow-2xl animate-fade-in-up flex flex-col max-h-[90vh] transition-colors ${COLORS.find(c => c.id === color)?.bg || 'bg-white'}`}>
        <div className="p-4 border-b flex justify-between items-center bg-white/50 rounded-t-2xl shrink-0">
          <h2 className="font-hand text-xl text-gray-800 font-bold flex items-center gap-2">
              {isMathBoard && <Calculator size={20}/>}
              {isMathBoard ? '오답노트 작성' : '새 게시물 만들기'}
          </h2>
          {isWritingBoard && (
            <button
              type="button"
              onClick={() => setShowRules(true)}
              className="text-sm font-bold text-indigo-600 hover:text-indigo-700"
            >
              규칙 보기
            </button>
          )}
          {isLearningBoard && (
            <button
              type="button"
              onClick={() => setShowLearningRules(true)}
              className="text-sm font-bold text-indigo-600 hover:text-indigo-700"
            >
              규칙 보기
            </button>
          )}
          {isReadingBoard && (
            <button
              type="button"
              onClick={() => setShowReadingRules(true)}
              className="text-sm font-bold text-indigo-600 hover:text-indigo-700"
            >
              규칙 보기
            </button>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">배경색</label>
            <div className="flex gap-2 overflow-x-auto pb-2">
                {COLORS.map((c) => (
                    <button
                        key={c.id}
                        type="button"
                        onClick={() => setColor(c.id)}
                        className={`w-8 h-8 rounded-full border-2 ${c.bg} ${c.border} ${color === c.id ? 'ring-2 ring-indigo-500 scale-110' : ''}`}
                        title={c.id}
                    />
                ))}
            </div>
          </div>

          {isWritingBoard && (
            <div className="bg-white/70 rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTopicMode('random');
                    pickRandomTopic();
                  }}
                  className={`px-3 py-2 rounded-full text-sm font-bold border ${topicMode === 'random' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'}`}
                >
                  랜덤 뽑기
                </button>
                <button
                  type="button"
                  onClick={() => setTopicMode('pick')}
                  className={`px-3 py-2 rounded-full text-sm font-bold border ${topicMode === 'pick' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'}`}
                >
                  직접 고르기
                </button>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="ml-auto px-3 py-2 rounded-full text-sm font-bold border border-gray-200 bg-white text-gray-600"
                >
                  {[WRITING_ALL_CATEGORY, ...categories].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {topicLoadError === 'PGRST205' && (
                <div className="text-sm text-red-500 font-bold">
                  주제 테이블이 없습니다. Supabase에서 `011_writing_topics.sql`과 `012_writing_topics_seed.sql`을 실행해주세요.
                </div>
              )}
              {!topicLoadError && filteredTopics.length === 0 && (
                <div className="text-sm text-gray-500">등록된 주제가 없습니다. 선생님이 주제를 추가해주세요.</div>
              )}

              {topicMode === 'random' && filteredTopics.length > 0 && (
                <div className="space-y-2">
                  <div className="bg-indigo-50 text-indigo-800 font-bold rounded-lg px-4 py-3">
                    {selectedTopic ? selectedTopic.topic : ''}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={pickRandomTopic}
                      className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-bold text-gray-700 bg-white hover:bg-gray-50"
                    >
                      다시 뽑기
                    </button>
                    <button
                      type="button"
                      onClick={() => selectedTopic && applyTopic(selectedTopic)}
                      className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700"
                    >
                      선택 적용
                    </button>
                  </div>
                </div>
              )}

              {topicMode === 'pick' && filteredTopics.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {filteredTopics.map((topic) => (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => applyTopic(topic)}
                      className={`w-full text-left px-3 py-2 rounded-lg border text-sm font-medium ${
                        selectedTopic?.id === topic.id
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {topic.topic}
                    </button>
                  ))}
                </div>
              )}

              {isTeacherMode && (
                <div className="border-t border-gray-200 pt-3 space-y-2">
                  <div className="text-sm font-bold text-gray-700">내가 만드는 글쓰기 주제</div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTopicTitle}
                      onChange={(e) => setNewTopicTitle(e.target.value)}
                      placeholder="새 주제를 입력하세요"
                      className="flex-1 border-gray-300 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white/80"
                    />
                    <button
                      type="button"
                      onClick={handleCreateTopic}
                      disabled={!newTopicTitle.trim()}
                      className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      추가
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
            <input
              required
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border-gray-300 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white/80"
              placeholder={isMathBoard ? "단원명 (예: 3단원 나눗셈)" : "제목을 입력하세요"}
            />
          </div>

          {isMathBoard && (
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">숙제 범위 (페이지)</label>
                  <input
                    required
                    type="text"
                    value={pageRange}
                    onChange={(e) => setPageRange(e.target.value)}
                    className="w-full border-gray-300 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white/80"
                    placeholder="예: P.10 ~ 11"
                  />
              </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
            <textarea
              required
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full border-gray-300 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none bg-white/80"
              placeholder={isMathBoard ? "어떤 점을 실수했는지 적어보세요." : "무슨 이야기를 하고 싶나요?"}
            />
            {isWritingBoard && (
              <div className="mt-2 text-sm flex items-center justify-between">
                <span className={isWritingTooShort ? 'text-red-500 font-bold' : 'text-gray-500'}>
                  {bodyLength}/{MIN_WRITING_CHARS}
                </span>
                {isWritingTooShort && (
                  <span className="text-red-500 font-bold">내용은 띄어쓰기 포함 {MIN_WRITING_CHARS}자 이상 써야 해요.</span>
                )}
              </div>
            )}
            {isLearningBoard && (
              <div className="mt-2 text-sm space-y-1">
                <div className="text-gray-500">
                  {MIN_LEARNING_NOTE_CHARS > 0 ? `${bodyLength}/${MIN_LEARNING_NOTE_CHARS}` : `${bodyLength}자`}
                </div>
                {learningNoteWarning && (
                  <div className="text-[#92400E]">{learningNoteWarning}</div>
                )}
              </div>
            )}
            {isReadingBoard && (
              <div className="mt-2 text-sm space-y-1">
                <div className={isReadingTooShort ? 'text-red-500 font-bold' : 'text-gray-500'}>
                  {bodyLength}/{MIN_READING_LOG_CHARS}
                </div>
                {isReadingTooShort && (
                  <div className="text-red-500 font-bold">독서록은 최소 {MIN_READING_LOG_CHARS}자 이상 작성해야 저장할 수 있어요.</div>
                )}
                {readingLogWarning && !isReadingTooShort && (
                  <div className="text-[#92400E]">{readingLogWarning}</div>
                )}
              </div>
            )}
          </div>

          {layout === 'timeline' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                날짜 <span className="text-red-500 text-xs">(타임라인 필수)</span>
              </label>
              <input
                required
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full border-gray-300 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white/80"
              />
            </div>
          )}

          {/* Media Tabs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
                {isMathBoard ? "오답 사진 첨부 (필수)" : "첨부 파일"}
            </label>
            <div className="flex gap-2 mb-3">
                <button
                    type="button"
                    onClick={() => setActiveTab('image')}
                    className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors ${activeTab === 'image' ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                    <ImageIcon size={18} /> 사진
                </button>
                {!isNoticeBoard && (
                  <button
                      type="button"
                      onClick={() => setActiveTab('video')}
                      className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors ${activeTab === 'video' ? 'bg-red-100 text-red-700 ring-2 ring-red-500' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                      <Youtube size={18} /> 유튜브
                  </button>
                )}
                {isNoticeBoard && (
                  <button
                      type="button"
                      onClick={() => setActiveTab('file')}
                      className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors ${activeTab === 'file' ? 'bg-green-100 text-green-700 ring-2 ring-green-500' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                      <Upload size={18} /> 파일
                  </button>
                )}
            </div>

            {/* Image Tab Content */}
            {activeTab === 'image' && (
                <div className="space-y-2">
                    <input 
                        type="file" 
                        accept="image/*" 
                        multiple={isAlbumBoard}
                        ref={fileInputRef}
                        onChange={isAlbumBoard ? handleMultiImageChange : handleFileChange}
                        className="hidden" 
                    />
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50/50 transition-colors h-32 bg-white/50"
                    >
                        {isAlbumBoard ? (
                            <span className="text-sm text-gray-500">
                                클릭해서 사진 여러 장 올리기 (최대 {MAX_ALBUM_IMAGES}장, 자동 축소·압축)
                            </span>
                        ) : imageUrl ? (
                            <img src={imageUrl} alt="preview" className="h-full object-contain" />
                        ) : (
                            <>
                                <Upload size={24} className="text-gray-400 mb-2" />
                                <span className="text-sm text-gray-500">
                                    {isMathBoard ? "틀린 문제를 찍어서 올려주세요" : "클릭해서 내 컴퓨터 사진 올리기"}
                                </span>
                            </>
                        )}
                    </div>
                    {isAlbumBoard && imageUrls.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto py-2">
                            {imageUrls.map((url, idx) => (
                                <div key={`${url}-${idx}`} className="relative w-28 h-20 shrink-0 rounded-lg overflow-hidden border">
                                    <img src={url} alt="preview" className="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => {
                                          setImageUrls((prev) => prev.filter((_, i) => i !== idx));
                                          setImageStoragePaths((prev) => prev.filter((_, i) => i !== idx));
                                        }}
                                        className="absolute top-1 right-1 bg-white/90 text-gray-600 text-xs px-1.5 py-0.5 rounded"
                                    >
                                        삭제
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    {!isAlbumBoard && imageUrl && (
                        <button type="button" onClick={() => { setImageUrl(''); setImageStoragePath(null); if(fileInputRef.current) fileInputRef.current.value = ''; }} className="text-xs text-red-500 underline">
                            사진 삭제
                        </button>
                    )}
                    {isUploading && <p className="text-xs text-gray-500">이미지 처리/업로드 중...</p>}
                    {uploadNotice && <p className="text-xs text-amber-600">{uploadNotice}</p>}
                    {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
                </div>
            )}

            {/* Video Tab Content */}
            {activeTab === 'video' && !isNoticeBoard && (
                <div className="space-y-2">
                    <input 
                        type="text" 
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        placeholder="https://youtu.be/..."
                        className="w-full border-gray-300 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none bg-white/80"
                    />
                    {youtubeId ? (
                         <div className="relative pt-[56.25%] w-full bg-black rounded-lg overflow-hidden">
                            <iframe 
                                className="absolute top-0 left-0 w-full h-full"
                                src={`https://www.youtube.com/embed/${youtubeId}`} 
                                title="YouTube video player" 
                                frameBorder="0" 
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                allowFullScreen
                            ></iframe>
                        </div>
                    ) : youtubeUrl && (
                        <p className="text-xs text-red-500">올바른 유튜브 주소를 입력해주세요.</p>
                    )}
                </div>
            )}

            {activeTab === 'file' && isNoticeBoard && (
                <div className="space-y-2">
                    <input
                        type="file"
                        ref={attachmentInputRef}
                        onChange={handleAttachmentFileChange}
                        className="hidden"
                    />
                    <div
                        onClick={() => attachmentInputRef.current?.click()}
                        className="border-2 border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50/50 transition-colors h-32 bg-white/50"
                    >
                        {fileName ? (
                            <div className="text-sm text-gray-700 font-bold text-center break-all">
                                {fileName}
                            </div>
                        ) : (
                            <>
                                <Upload size={24} className="text-gray-400 mb-2" />
                                <span className="text-sm text-gray-500">클릭해서 파일 올리기</span>
                            </>
                        )}
                    </div>
                    {fileName && (
                        <button
                            type="button"
                            onClick={() => {
                              setFileName('');
                              setFileStoragePath(null);
                              if (attachmentInputRef.current) attachmentInputRef.current.value = '';
                            }}
                            className="text-xs text-red-500 underline"
                        >
                            첨부 제거
                        </button>
                    )}
                </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isUploading || isWritingTooShort || isLearningTooShort || isReadingTooShort || isAlbumUploadBlocked}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg mt-4 shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isUploading ? '업로드 중...' : (isMathBoard ? '오답노트 제출' : '게시물 올리기')}
          </button>
        </form>
      </div>

      {showRules && isWritingBoard && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-3">{WRITING_RULES_TITLE}</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{WRITING_RULES_TEXT}</p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem(WRITING_RULES_LS_KEY, '1');
                  setShowRules(false);
                }}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50"
              >
                다시 보지 않기
              </button>
              <button
                type="button"
                onClick={() => setShowRules(false)}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {showLearningRules && isLearningBoard && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-3">{LEARNING_NOTE_RULES_TITLE}</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{LEARNING_NOTE_RULES_TEXT}</p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem(LEARNING_NOTE_RULES_LS_KEY, '1');
                  setShowLearningRules(false);
                }}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50"
              >
                오늘은 그만 보기
              </button>
              <button
                type="button"
                onClick={() => setShowLearningRules(false)}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {showReadingRules && isReadingBoard && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-3">{READING_LOG_RULES_TITLE}</h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{READING_LOG_RULES_TEXT}</p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem(READING_LOG_RULES_LS_KEY, '1');
                  setShowReadingRules(false);
                }}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50"
              >
                오늘은 그만 보기
              </button>
              <button
                type="button"
                onClick={() => setShowReadingRules(false)}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
