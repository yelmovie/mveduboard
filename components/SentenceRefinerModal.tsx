
import React, { useState } from 'react';
import { X, Wand2, Copy, Check, MessageSquareQuote, User, Users, GraduationCap } from 'lucide-react';
import { generateText, getOpenAIApiKey } from '../services/openaiClient';

interface SentenceRefinerModalProps {
  onClose: () => void;
}

export const SentenceRefinerModal: React.FC<SentenceRefinerModalProps> = ({ onClose }) => {
  const [inputText, setInputText] = useState('');
  const [target, setTarget] = useState('학부모'); // Default target
  const [refinedText, setRefinedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);

  const targets = [
      { id: '학부모', label: '학부모님 (정중하게)', icon: User },
      { id: '학생', label: '학생 (다정하게)', icon: Users },
      { id: '동료', label: '동료 교사 (격식있게)', icon: GraduationCap },
  ];

  const handleRefine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const apiKey = getOpenAIApiKey();
    if (!apiKey) {
        alert('OpenAI API Key가 필요합니다. .env.local에 VITE_OPENAI_API_KEY를 설정해주세요.');
        return;
    }

    setIsProcessing(true);
    setRefinedText(''); // Clear previous result
    
    try {
        const prompt = `
            역할: 당신은 친절하고 전문적인 초등학교 교사입니다.
            요청: 아래 입력된 텍스트를 '${target}'에게 보내기에 적절한 자연스럽고 공손한 한국어 문장으로 다듬어주세요.
            
            규칙:
            1. 맞춤법과 띄어쓰기를 완벽하게 교정하세요.
            2. 단어만 나열되어 있다면 완전한 문장으로 만드세요.
            3. 문맥을 파악하여 내용을 보충하되, 원래 의도를 왜곡하지 마세요.
            4. 대상이 '${target}'임을 고려하여 어조(Tone & Manner)를 조정하세요.
               - 학부모: 정중하고 예의 바르게 (해요체 또는 하십시오체 적절히 혼용)
               - 학생: 다정하고 이해하기 쉽게 (해요체)
               - 동료 교사: 정중하고 명료하게
            
            입력 텍스트: "${inputText}"
            
            출력: 다듬어진 문장만 출력하세요. 부연 설명은 하지 마세요.
        `;

        const text = await generateText(prompt, { maxTokens: 512 }, "당신은 한국어 교정 전문가입니다.");
        setRefinedText(text.trim() || "변환에 실패했습니다.");
    } catch (e) {
        console.error(e);
        alert("문장을 다듬는 중 오류가 발생했습니다.");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleCopy = () => {
      navigator.clipboard.writeText(refinedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
        <div className="p-5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex justify-between items-center shrink-0">
            <h2 className="text-xl font-bold flex items-center gap-2">
                <Wand2 className="text-yellow-300" /> AI 문장 다듬기
            </h2>
            <button onClick={onClose} className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition-colors">
                <X size={20} />
            </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar">
            <div className="bg-indigo-50 p-4 rounded-xl text-sm text-indigo-800 mb-6 leading-relaxed">
                💡 <strong>알림장, 가정통신문, 문자 메시지</strong>를 보낼 때 사용하세요.<br/>
                대충 적은 내용도 대상에 맞춰 예쁘게 고쳐드립니다.
            </div>

            <form onSubmit={handleRefine} className="space-y-6">
                {/* Target Selection */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">듣는 대상</label>
                    <div className="grid grid-cols-3 gap-2">
                        {targets.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setTarget(t.id)}
                                className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl border-2 transition-all ${target === t.id ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-100 bg-white text-gray-500 hover:bg-gray-50'}`}
                            >
                                <t.icon size={20} />
                                <span className="text-xs font-bold">{t.label.split(' ')[0]}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Input Area */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">원래 내용 (단어, 메모 등)</label>
                    <textarea 
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="예: 내일 현장체험 도시락 준비, 늦지 않게 등교, 비올수도 우산"
                        className="w-full h-32 p-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-violet-500 transition-colors resize-none text-gray-700 placeholder-gray-400"
                    />
                </div>

                <button 
                    type="submit" 
                    disabled={!inputText.trim() || isProcessing} 
                    className="w-full bg-violet-600 text-white font-bold py-3.5 rounded-xl hover:bg-violet-700 disabled:bg-gray-300 transition-all shadow-md flex items-center justify-center gap-2"
                >
                    {isProcessing ? (
                        <>
                            <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                            다듬는 중...
                        </>
                    ) : (
                        <>
                            <Wand2 size={18} /> 예쁘게 다듬기
                        </>
                    )}
                </button>
            </form>

            {/* Result Area */}
            {refinedText && (
                <div className="mt-8 animate-fade-in-up">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-bold text-violet-700 flex items-center gap-2">
                            <MessageSquareQuote size={16} /> 다듬어진 문장
                        </label>
                        <button 
                            onClick={handleCopy}
                            className={`text-xs px-3 py-1.5 rounded-full flex items-center gap-1 font-bold transition-all ${copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            {copied ? <Check size={14} /> : <Copy size={14} />}
                            {copied ? '복사됨' : '복사하기'}
                        </button>
                    </div>
                    <div className="bg-violet-50 border border-violet-100 rounded-2xl p-5 text-gray-800 leading-relaxed relative">
                        {refinedText}
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
