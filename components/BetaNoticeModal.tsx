import React from 'react';
import { BETA_MONTHS, DAILY_IMAGE_LIMIT, IMAGE_RETENTION_DAYS } from '../src/constants/limits';

interface BetaNoticeModalProps {
  onClose: () => void;
}

export const BetaNoticeModal: React.FC<BetaNoticeModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border-2 border-[#FCD34D]">
        <div className="p-5 border-b border-[#FDE68A]">
          <h2 className="font-hand text-xl font-bold text-[#78350F]">🧪 베타 운영 안내</h2>
        </div>
        <div className="p-6 text-sm text-[#78350F] leading-relaxed">
          <p>
            현재 {BETA_MONTHS}개월간 베타 운영 중이며 모든 기능을 무료로 이용할 수 있어요.
            모든 학급이 안정적으로 사용할 수 있도록 이미지는 하루 최대 {DAILY_IMAGE_LIMIT}장까지 업로드할 수 있고,
            업로드 기록은 매일 자동 초기화됩니다.
            게시판 이미지는 학생과 교사만 볼 수 있으며, 이미지는 {IMAGE_RETENTION_DAYS}일 후 자동 삭제됩니다.
          </p>
        </div>
        <div className="p-5 pt-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-12 bg-[#FCD34D] text-[#78350F] rounded-2xl font-bold shadow-md hover:bg-[#F59E0B] transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};
