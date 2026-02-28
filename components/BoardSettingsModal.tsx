import React, { useState } from 'react';
import { Board } from '../types';
import { X, Image, Type } from 'lucide-react';

interface BoardSettingsModalProps {
  board: Board;
  onClose: () => void;
  onSave: (updatedBoard: Board) => void;
}

export const BoardSettingsModal: React.FC<BoardSettingsModalProps> = ({ board, onClose, onSave }) => {
  const [title, setTitle] = useState(board.title);
  const [description, setDescription] = useState(board.description);
  const [background, setBackground] = useState(board.background || 'slate');

  const handleSave = () => {
    onSave({
      ...board,
      title,
      description,
      background
    });
    onClose();
  };

  const BACKGROUNDS = [
      { id: 'slate', name: '기본 (회색)', class: 'bg-slate-100' },
      { id: 'cork', name: '코르크', class: 'bg-[#e3cda4]' },
      { id: 'sky', name: '푸른 하늘', class: 'bg-sky-100' },
      { id: 'paper', name: '한지', class: 'bg-[#fdfbf7]' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-fade-in-up">
        <div className="p-4 border-b flex justify-between items-center">
            <h2 className="font-bold text-lg text-gray-800">게시판 설정</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
        </div>
        
        <div className="p-6 space-y-6">
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                    <Type size={16} /> 게시판 제목
                </label>
                <input 
                    type="text" 
                    value={title} 
                    onChange={e => setTitle(e.target.value)}
                    className="w-full border rounded-lg p-2"
                />
            </div>

            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">설명</label>
                <textarea 
                    value={description} 
                    onChange={e => setDescription(e.target.value)}
                    className="w-full border rounded-lg p-2 resize-none h-20"
                />
            </div>

            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                    <Image size={16} /> 배경 테마
                </label>
                <div className="grid grid-cols-2 gap-2">
                    {BACKGROUNDS.map(bg => (
                        <button
                            key={bg.id}
                            onClick={() => setBackground(bg.id)}
                            className={`p-3 rounded-lg border-2 text-sm font-medium transition-all flex items-center gap-2 ${background === bg.id ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200'}`}
                        >
                            <div className={`w-6 h-6 rounded-full border ${bg.class}`}></div>
                            {bg.name}
                        </button>
                    ))}
                </div>
            </div>

            <button 
                onClick={handleSave}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700"
            >
                저장하기
            </button>
        </div>
      </div>
    </div>
  );
};