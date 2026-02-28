
import React, { useState, useEffect, useRef } from 'react';
import { Home, Upload, Calendar, Check, FileText, AlertCircle, Trash2, Utensils, Download, Maximize2, X } from 'lucide-react';
import * as lunchService from '../services/lunchService';
import { LunchData } from '../types';

interface LunchAppProps {
  onBack: () => void;
  isTeacherMode: boolean;
  embedded?: boolean;
}

export const LunchApp: React.FC<LunchAppProps> = ({ onBack, isTeacherMode, embedded = false }) => {
  const [lunchData, setLunchData] = useState<LunchData | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Teacher Mode State
  const [isProcessing, setIsProcessing] = useState(false);
  const [showUploadSuccess, setShowUploadSuccess] = useState(false); // Success feedback state
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const data = lunchService.getLunchData();
    setLunchData(data);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('이미지 파일(JPG, PNG 등)만 업로드 가능합니다.');
        return;
    }

    setIsProcessing(true);
    try {
        // Just upload, no analysis
        const newData = await lunchService.uploadLunchSchedule(file);
        
        setLunchData(newData);
        
        // Success Feedback
        setShowUploadSuccess(true);
        setTimeout(() => setShowUploadSuccess(false), 3000);
    } catch (err: any) {
        console.error(err);
        alert(err.message || '업로드 중 오류가 발생했습니다.');
        // If failed, reload old data to be safe
        loadData();
    } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = () => {
      if(confirm('등록된 식단표를 삭제하시겠습니까?')) {
          lunchService.clearLunchData();
          setLunchData(null);
      }
  };

  // --- Render ---

  // 1. Loading State
  if (isProcessing) {
      return (
          <div className="min-h-full flex flex-col items-center justify-center p-4">
              <div className="bg-white p-8 rounded-2xl shadow-xl text-center space-y-4 max-w-sm w-full">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
                  <h2 className="text-xl font-bold text-gray-800">식단표 등록 중...</h2>
                  <p className="text-gray-500 text-sm">잠시만 기다려주세요</p>
              </div>
          </div>
      )
  }

  // 2. Main View
  return (
    <div className={`flex flex-col font-sans ${embedded ? 'h-full bg-white' : 'min-h-screen bg-orange-50'}`}>
        {!embedded && (
            <header className="bg-white p-6 shadow-sm flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="bg-gray-100 p-3 rounded-full text-gray-500 hover:bg-gray-200"><Home size={28}/></button>
                    <h1 className="font-bold text-gray-800 text-3xl flex items-center gap-3">
                        <Utensils size={32} className="text-orange-500" /> 이번달 급식
                    </h1>
                </div>
                {isTeacherMode && (
                    <div className="flex gap-3 items-center">
                        <span className="text-sm text-orange-600 font-bold hidden md:inline mr-3">※ 이미지 파일(PNG, JPG) 권장</span>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileUpload} 
                            className="hidden" 
                            accept="image/*"
                        />
                        {showUploadSuccess ? (
                            <button 
                                className="bg-green-600 text-white px-6 py-3 rounded-xl text-lg font-bold flex items-center gap-2 shadow-md cursor-default animate-pulse"
                            >
                                <Check size={20} /> 업로드 완료
                            </button>
                        ) : (
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="bg-orange-600 text-white px-6 py-3 rounded-xl text-lg font-bold flex items-center gap-2 hover:bg-orange-700 shadow-md"
                            >
                                <Upload size={20} /> 식단표 등록
                            </button>
                        )}
                        {lunchData && (
                            <button 
                                onClick={handleDelete}
                                className="bg-red-50 text-red-500 px-4 py-3 rounded-xl text-lg font-bold border border-red-100 hover:bg-red-100"
                            >
                                <Trash2 size={24} />
                            </button>
                        )}
                    </div>
                )}
            </header>
        )}

        {/* Embedded Controls for Teacher */}
        {embedded && isTeacherMode && (
            <div className="flex justify-end gap-3 p-4 border-b bg-gray-50 items-center flex-wrap">
                <span className="text-sm text-orange-600 font-bold mr-2">※ 이미지 파일(PNG, JPG) 권장</span>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    className="hidden" 
                    accept="image/*"
                />
                {showUploadSuccess ? (
                    <button 
                        className="bg-green-600 text-white px-4 py-2 rounded-lg text-base font-bold flex items-center gap-2 shadow-md cursor-default animate-pulse"
                    >
                        <Check size={18} /> 업로드 완료
                    </button>
                ) : (
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-orange-600 text-white px-4 py-2 rounded-lg text-base font-bold flex items-center gap-2 hover:bg-orange-700 shadow-sm"
                    >
                        <Upload size={18} /> 식단표 등록
                    </button>
                )}
                {lunchData && (
                    <button 
                        onClick={handleDelete}
                        className="bg-red-50 text-red-500 px-4 py-2 rounded-lg text-base font-bold border border-red-100 hover:bg-red-100"
                    >
                        <Trash2 size={18} />
                    </button>
                )}
            </div>
        )}

        <main className={`flex-1 p-6 md:p-10 max-w-6xl mx-auto w-full flex flex-col items-center ${embedded ? 'overflow-y-auto' : ''}`}>
            {!lunchData ? (
                <div className="text-center py-32 text-gray-400">
                    <Calendar size={80} className="mx-auto mb-6 opacity-30" />
                    <p className="text-2xl font-bold">등록된 식단표가 없습니다.</p>
                    {isTeacherMode && <p className="text-lg mt-2">이미지 파일을 업로드해주세요.</p>}
                </div>
            ) : (
                <div className="w-full max-w-4xl space-y-6">
                    {/* Header */}
                    <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-3 text-orange-800">
                            <FileText size={24} />
                            <span className="font-bold text-lg">이번 달 식단표</span>
                        </div>
                        <div className="flex gap-2">
                            <a 
                                href={lunchData.imageUrl} 
                                download="lunch_schedule.jpg"
                                className="bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-gray-50 transition-colors"
                            >
                                <Download size={18} /> 다운로드
                            </a>
                            <button 
                                onClick={() => setIsFullscreen(true)}
                                className="bg-orange-100 text-orange-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-orange-200 transition-colors"
                            >
                                <Maximize2 size={18} /> 크게 보기
                            </button>
                        </div>
                    </div>

                    {/* Image Display */}
                    <div className="bg-white rounded-3xl shadow-xl overflow-hidden border-2 border-orange-100">
                        {lunchData.imageUrl ? (
                            <img 
                                src={lunchData.imageUrl} 
                                alt="식단표" 
                                className="w-full h-auto object-contain"
                            />
                        ) : (
                            <div className="p-20 text-center text-gray-400">
                                <AlertCircle size={48} className="mx-auto mb-4 opacity-30" />
                                <p>이미지를 불러올 수 없습니다.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </main>

        {/* Fullscreen Modal */}
        {isFullscreen && lunchData?.imageUrl && (
            <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setIsFullscreen(false)}>
                <div className="relative w-full h-full flex items-center justify-center">
                    <button 
                        onClick={() => setIsFullscreen(false)}
                        className="absolute top-4 right-4 bg-white/10 p-2 rounded-full text-white hover:bg-white/20 transition-colors"
                    >
                        <X size={32} />
                    </button>
                    <img 
                        src={lunchData.imageUrl} 
                        alt="식단표 확대" 
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            </div>
        )}
    </div>
  );
};
