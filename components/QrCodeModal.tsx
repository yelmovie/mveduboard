
import React, { useState } from 'react';
import { X, QrCode, Download, Link as LinkIcon } from 'lucide-react';

interface QrCodeModalProps {
  onClose: () => void;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({ onClose }) => {
  const [url, setUrl] = useState('');
  const [qrUrl, setQrUrl] = useState('');

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    // Basic validation to prepend https:// if missing
    let finalUrl = url.trim();
    if (!/^https?:\/\//i.test(finalUrl)) {
        finalUrl = 'https://' + finalUrl;
    }
    
    const encoded = encodeURIComponent(finalUrl);
    setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encoded}`);
  };

  const handleDownload = async () => {
      if (!qrUrl) return;
      try {
          const response = await fetch(qrUrl);
          const blob = await response.blob();
          const downloadUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = 'qrcode.png';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      } catch (e) {
          console.error(e);
          alert('다운로드 중 오류가 발생했습니다. 이미지를 우클릭하여 저장해주세요.');
      }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
        <div className="p-5 bg-indigo-600 text-white flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2">
                <QrCode /> QR코드 생성기
            </h2>
            <button onClick={onClose} className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition-colors">
                <X size={20} />
            </button>
        </div>
        
        <div className="p-6 space-y-6">
            <div className="bg-indigo-50 p-4 rounded-xl text-sm text-indigo-800">
                💡 웹사이트 주소를 입력하면 학생들이 스캔할 수 있는 QR코드를 만들어줍니다.
            </div>

            <form onSubmit={handleGenerate} className="space-y-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">이동할 사이트 주소 (URL)</label>
                    <div className="relative">
                        <LinkIcon className="absolute left-3 top-3.5 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="예: www.google.com"
                            className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                    </div>
                </div>
                <button type="submit" disabled={!url.trim()} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 disabled:bg-gray-300 transition-colors shadow-md">
                    QR코드 생성하기
                </button>
            </form>

            {qrUrl && (
                <div className="flex flex-col items-center gap-4 pt-6 border-t border-gray-100">
                    <div className="bg-white p-4 border-4 border-gray-100 rounded-2xl shadow-inner">
                        <img src={qrUrl} alt="QR Code" className="w-48 h-48 object-contain" />
                    </div>
                    <button 
                        onClick={handleDownload}
                        className="flex items-center gap-2 text-indigo-600 font-bold hover:bg-indigo-50 px-6 py-3 rounded-xl transition-colors border-2 border-indigo-100"
                    >
                        <Download size={18} /> 이미지 다운로드
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
