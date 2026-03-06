import React, { useState, useEffect, useRef } from 'react';
import { X, Download, Loader2, FileText } from 'lucide-react';
import { collectStudentReportData } from '../src/lib/report/reportService';
import { ReportPeriod, ReportSectionId, StudentReportViewData } from '../src/lib/report/types';
import { StudentReportPdfView } from './StudentReportPdfView';
import { seedStudentReportData } from '../src/lib/report/seed';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import * as studentService from '../services/studentService';

interface ReportSection {
  id: ReportSectionId;
  name: string;
  description: string;
  enabled: boolean;
}

interface StudentReportModalProps {
  onClose: () => void;
}

export const StudentReportModal: React.FC<StudentReportModalProps> = ({ onClose }) => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedPeriod] = useState<ReportPeriod>('year');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reportData, setReportData] = useState<StudentReportViewData | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [seedLoading, setSeedLoading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const [sections, setSections] = useState<ReportSection[]>([
    { id: 'boardPosts', name: '게시판 활동', description: '학생이 작성한 게시물 통계', enabled: true },
    { id: 'learningNotes', name: '배움 노트', description: '배움 노트 작성 내역', enabled: true },
    { id: 'todoRecords', name: '할일 체크', description: '과제 완료율 및 기록', enabled: true },
    { id: 'points', name: '포인트 활동', description: '포인트 획득/차감 내역', enabled: true },
    { id: 'messages', name: '쪽지 활동', description: '선생님과의 쪽지 통계', enabled: true },
    { id: 'writing', name: '주제글쓰기', description: '주제글쓰기 작성 기록', enabled: true },
    { id: 'math', name: '오답노트', description: '수학 오답노트 기록', enabled: true },
    { id: 'omr', name: 'OMR', description: 'OMR 제출 및 정답률', enabled: true },
    { id: 'reading', name: '독서록', description: '독서록 작성 기록', enabled: true },
    { id: 'schedule', name: '스케줄', description: '일정/플래너 기록', enabled: true },
  ]);

  useEffect(() => {
    let isMounted = true;
    const loadRoster = async () => {
      try {
        await studentService.preloadClassId();
      } catch {}
      const roster = await studentService.fetchRosterFromDb();
      if (!isMounted) return;
      setStudents(roster);
      if (roster.length > 0 && !selectedStudentId) {
        setSelectedStudentId(roster[0].id);
      }
    };
    loadRoster();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLoadReport = async () => {
    if (!selectedStudentId) {
      alert('학생을 선택해주세요.');
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const data = await collectStudentReportData(selectedStudentId, selectedYear, selectedPeriod);
      setReportData(data);
    } catch (error: any) {
      const message = error?.message || '리포트 데이터를 불러올 수 없습니다.';
      setLoadError(message);
      alert(`리포트 데이터 로드 실패: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!reportData) {
      alert('먼저 리포트 데이터를 불러오세요.');
      return;
    }

    const enabledSections = sections.filter(s => s.enabled);
    if (enabledSections.length === 0) {
      alert('최소 하나의 섹션을 선택해주세요.');
      return;
    }

    if (!reportRef.current) {
      alert('리포트 화면을 준비 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    setGenerating(true);
    try {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      const imgData = canvas.toDataURL('image/png');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let position = 0;
      let heightLeft = imgHeight;

      doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        doc.addPage();
        doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const today = new Date();
      const yyyymmdd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(
        today.getDate()
      ).padStart(2, '0')}`;
      const filename = `report-${selectedYear}-${selectedStudentId}-${yyyymmdd}.pdf`;
      doc.save(filename);
    } catch (error: any) {
      alert(`PDF 생성 실패: ${error?.message || 'PDF 생성에 실패했습니다.'}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleSeed = async () => {
    if (!import.meta.env.DEV) return;
    setSeedLoading(true);
    try {
      await seedStudentReportData(students);
      alert('샘플 데이터가 생성되었습니다. 리포트를 다시 불러오세요.');
    } catch (error: any) {
      alert(`샘플 데이터 생성 실패: ${error?.message || '실패했습니다.'}`);
    } finally {
      setSeedLoading(false);
    }
  };

  const toggleSection = (id: string) => {
    setSections(sections.map(s => 
      s.id === id ? { ...s, enabled: !s.enabled } : s
    ));
  };

  const enabledSectionIds = new Set(sections.filter((s) => s.enabled).map((s) => s.id));

  const availableYears = [];
  const currentYear = new Date().getFullYear();
  for (let year = currentYear; year >= currentYear - 3; year--) {
    availableYears.push(year);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border-b-8 border-indigo-100">
        <div className="p-4 border-b flex justify-between items-center bg-indigo-50">
          <h2 className="font-hand text-xl text-indigo-900 font-bold flex items-center gap-2">
            <FileText size={20} />
            학생 활동 리포트
          </h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 transition-colors bg-white p-1 rounded-full shadow-sm"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-100px)]">
          {/* 년도 및 학생 선택 */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                학년도 선택
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}학년도</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                기간 선택
              </label>
              <div className="w-full p-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-700">
                학년도 전체
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                학생 선택
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none"
              >
                {students.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.number}. {student.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleLoadReport}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  데이터 불러오는 중...
                </>
              ) : (
                '리포트 데이터 불러오기'
              )}
            </button>

            {import.meta.env.DEV && (
              <button
                type="button"
                onClick={handleSeed}
                disabled={seedLoading || students.length === 0}
                className="w-full bg-gray-100 text-gray-700 font-bold py-2 rounded-xl border border-gray-200 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {seedLoading ? '샘플 데이터 생성 중...' : 'DEV: 학생 1~3 샘플 데이터 생성'}
              </button>
            )}
          </div>

          {/* 섹션 선택 */}
          {reportData && (
            <div className="space-y-3">
              <h3 className="font-bold text-lg text-gray-800">포함할 섹션 선택</h3>
              <div className="space-y-2">
                {sections.map(section => (
                  <label
                    key={section.id}
                    className="flex items-start gap-3 p-3 border-2 border-gray-200 rounded-xl hover:border-indigo-300 cursor-pointer transition-all"
                  >
                    <input
                      type="checkbox"
                      checked={section.enabled}
                      onChange={() => toggleSection(section.id)}
                      className="mt-1 w-5 h-5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1">
                      <div className="font-bold text-gray-800">{section.name}</div>
                      <div className="text-sm text-gray-500">{section.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 리포트 요약 정보 */}
          {reportData && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <h3 className="font-bold text-lg text-gray-800">리포트 요약</h3>
              <div className="text-sm space-y-1">
                {reportData.narratives.summary.slice(0, 3).map((line, idx) => (
                  <div key={`summary-${idx}`}>{line}</div>
                ))}
              </div>
            </div>
          )}

          {/* 다운로드 버튼 */}
          {reportData && (
            <button
              onClick={handleDownloadPDF}
              disabled={generating || sections.filter(s => s.enabled).length === 0}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
            >
              {generating ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  PDF 생성 중...
                </>
              ) : (
                <>
                  <Download size={20} />
                  PDF로 다운로드
                </>
              )}
            </button>
          )}

          {loadError && (
            <div className="text-sm text-red-600 font-bold bg-red-50 border border-red-200 rounded-lg p-3">
              {loadError}
            </div>
          )}
        </div>
      </div>

      {reportData && (
        <div ref={reportRef} className="fixed -left-[10000px] top-0">
          <StudentReportPdfView
            data={reportData}
            sections={sections}
            enabledSectionIds={enabledSectionIds}
          />
        </div>
      )}
    </div>
  );
};
