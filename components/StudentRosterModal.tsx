import React, { useEffect, useRef, useState } from 'react';
import { X, UserPlus, Save, Trash2, RotateCcw, Users, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { supabase } from '../src/lib/supabase/client';
import * as studentService from '../services/studentService';
import { ClassStudent } from '../types';
import { getCurrentUserProfile } from '../src/lib/supabase/auth';
import { generateUUID } from '../src/utils/uuid';
import {
  parseCsvText,
  parseXlsxToRows,
  validateRosterRows,
  downloadSampleCsv,
  PREVIEW_MAX,
  ROSTER_CSV_HEADERS,
  ROSTER_CSV_SAMPLE_ROWS,
  ROSTER_CSV_FILENAME,
  type UploadRosterRow,
} from '../utils/rosterUpload';

interface StudentRosterModalProps {
  onClose: () => void;
}

export const StudentRosterModal: React.FC<StudentRosterModalProps> = ({ onClose }) => {
  type TempStudent = { id: string; name: string; number?: number; gender?: 'male' | 'female'; birthDate?: string; previousGradeClass?: string; remarks?: string; siblings?: string };
  const MAX_STUDENTS = 30;
  const [draftStudents, setDraftStudents] = useState<TempStudent[]>([]);
  const [inputName, setInputName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<UploadRosterRow[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadStudents = async () => {
      setLoading(true);
      try {
        const loaded = await studentService.fetchRosterFromDb();
        setDraftStudents(loaded);
      } catch (e) {
        console.error('[StudentRosterModal] load error', e);
        setDraftStudents(studentService.getRoster());
      } finally {
        setLoading(false);
      }
    };
    loadStudents();
  }, []);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (draftStudents.length >= MAX_STUDENTS) {
      alert(`학급 명부는 최대 ${MAX_STUDENTS}명까지 등록할 수 있습니다.`);
      return;
    }
    const name = inputName.trim();
    if (!name) return;
    const usedNumbers = new Set(draftStudents.map((s) => s.number).filter(Boolean) as number[]);
    const nextNumber = Array.from({ length: MAX_STUDENTS }, (_, i) => i + 1).find(
      (num) => !usedNumbers.has(num)
    );
    if (!nextNumber) {
      alert(`학급 명부는 최대 ${MAX_STUDENTS}명까지 등록할 수 있습니다.`);
      return;
    }
    setDraftStudents((prev) => [...prev, { id: generateUUID(), name, number: nextNumber }]);
    setInputName('');
  };

  const handleDelete = (id: string) => {
    if (!confirm('정말 삭제하시겠습니까? 관련 데이터(점수, 역할 등)가 영향을 받을 수 있습니다.')) return;
    setDraftStudents(prev => prev.filter(s => s.id !== id));
  };

  const handleUpdate = (id: string, field: 'name' | 'number' | 'gender' | 'birthDate' | 'previousGradeClass' | 'remarks' | 'siblings', value: string) => {
      const newStudents = draftStudents.map(s => {
          if (s.id === id) {
              if (field === 'number') {
                const next = Math.min(Math.max(parseInt(value) || 0, 1), MAX_STUDENTS);
                return { ...s, number: next };
              }
              if (field === 'gender') {
                return { ...s, gender: value === 'male' || value === 'female' ? value : undefined };
              }
              if (field === 'birthDate') return { ...s, birthDate: value || undefined };
              if (field === 'previousGradeClass') return { ...s, previousGradeClass: value || undefined };
              if (field === 'remarks') return { ...s, remarks: value || undefined };
              if (field === 'siblings') return { ...s, siblings: value || undefined };
              return { ...s, name: value };
          }
          return s;
      });
      setDraftStudents(newStudents);
  };

  const handleSave = async () => {
      if (saving) return;
      if (draftStudents.length === 0) {
        alert('저장할 학생이 없습니다.');
        return;
      }
      if (draftStudents.length > MAX_STUDENTS) {
        alert(`학급 명부는 최대 ${MAX_STUDENTS}명까지 저장할 수 있습니다.`);
        return;
      }
      const numbers = draftStudents.map((s) => s.number).filter(Boolean) as number[];
      if (numbers.some((n) => n < 1 || n > MAX_STUDENTS)) {
        alert(`학생 번호는 1~${MAX_STUDENTS}번까지만 가능합니다.`);
        return;
      }
      const dup = numbers.find((n, idx) => numbers.indexOf(n) !== idx);
      if (dup) {
        alert(`학생 번호가 중복되었습니다. ${dup}번을 확인해주세요.`);
        return;
      }
      const normalized = studentService.normalizeRoster(draftStudents);
      setDraftStudents(normalized);
      const profile = await getCurrentUserProfile();
      const classId = profile?.class_id;
      if (!classId) {
        alert('학급 정보를 찾을 수 없습니다. 다시 로그인해주세요.');
        return;
      }
      setSaving(true);
      try {
        await studentService.saveRosterToDb(normalized, classId);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : '알 수 없는 오류';
        console.error('[StudentRosterModal] save error', error);
        alert(`저장에 실패했습니다.\n${msg}`);
        setSaving(false);
        return;
      }
      const roster: ClassStudent[] = normalized.map((s, idx) => ({
        id: s.id,
        name: s.name,
        number: s.number ?? idx + 1,
        gender: s.gender,
        birthDate: s.birthDate,
        previousGradeClass: s.previousGradeClass,
        remarks: s.remarks,
        siblings: s.siblings,
      }));
      studentService.saveRoster(roster);
      setSaving(false);
      alert(`학급 명부가 저장되었습니다. (성공 ${roster.length}건) 모든 앱에 반영됩니다.`);
      onClose();
  };

  const handleReset = () => {
      if(confirm('기본 예시 명단으로 초기화하시겠습니까?')) {
          setDraftStudents([]);
      }
  };

  const handleDownloadPdf = () => {
    if (draftStudents.length === 0) {
      alert('다운로드할 학생이 없습니다.');
      return;
    }
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const margin = 15;
    let y = margin;
    doc.setFontSize(16);
    doc.text('학급 명부', margin, y);
    y += 10;
    doc.setFontSize(12);
    draftStudents.forEach((s, idx) => {
      if (y > 270) {
        doc.addPage();
        y = margin;
      }
      const genderLabel = s.gender === 'male' ? '남' : s.gender === 'female' ? '여' : '';
      const numberLabel = s.number ?? idx + 1;
      doc.text(`${numberLabel}. ${s.name} ${genderLabel}`, margin, y);
      y += 7;
    });
    doc.save('class_roster.pdf');
  };

  /** 클릭 시 클라이언트에서 CSV 생성 후 다운로드 (네트워크/Storage 없음). 회귀: 이 버튼 클릭 시 class_roster_template.csv가 내려와야 함. */
  const handleSampleDownload = () => {
    try {
      downloadSampleCsv(ROSTER_CSV_HEADERS, ROSTER_CSV_SAMPLE_ROWS, ROSTER_CSV_FILENAME);
    } catch {
      try {
        downloadSampleCsv(
          ['number', 'name', 'gender', 'note'],
          [{ number: '1', name: '예시', gender: '남', note: '' }],
          ROSTER_CSV_FILENAME
        );
      } catch {
        alert('샘플 파일 다운로드에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    }
  };

  const decodeCsvBuffer = (buf: ArrayBuffer): string => {
    const utf8 = new TextDecoder('utf-8').decode(buf);
    if (!utf8.includes('\uFFFD')) return utf8;
    try { return new TextDecoder('euc-kr').decode(buf); } catch { /* fallback */ }
    return utf8;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const content = reader.result as ArrayBuffer;
        let rows: string[][];
        if (ext === 'csv' || file.name.endsWith('.csv')) {
          rows = parseCsvText(decodeCsvBuffer(content));
        } else if (ext === 'xlsx' || ext === 'xls') {
          rows = parseXlsxToRows(content);
        } else {
          alert('CSV 또는 엑셀(.xlsx, .xls) 파일만 업로드할 수 있습니다.');
          return;
        }
        if (rows.length < 2) {
          alert('헤더와 데이터 행이 있어야 합니다. 샘플을 참고해 주세요.');
          return;
        }
        const validated = validateRosterRows(rows);
        setUploadPreview(validated);
      } catch (err) {
        console.error('[StudentRosterModal] upload parse error', err);
        alert('파일을 읽는 중 오류가 났습니다. 형식을 확인해 주세요.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleMergeUpload = () => {
    if (!uploadPreview) return;
    const valid = uploadPreview.filter((r) => !r.error);
    if (valid.length === 0) {
      alert('반영할 유효한 행이 없습니다. 오류를 수정한 뒤 다시 업로드해 주세요.');
      return;
    }
    const byNumber = new Map(draftStudents.map((s) => [s.number ?? 0, s]));
    valid.forEach((r) => {
      const existing = byNumber.get(r.number);
      if (existing) {
        byNumber.set(r.number, { ...existing, name: r.name, gender: r.gender ?? undefined });
      } else {
        byNumber.set(r.number, { id: generateUUID(), name: r.name, number: r.number, gender: r.gender ?? undefined });
      }
    });
    const merged = Array.from(byNumber.values())
      .filter((s) => s.number != null && s.number >= 1 && s.number <= MAX_STUDENTS)
      .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
    if (merged.length > MAX_STUDENTS) {
      alert(`최대 ${MAX_STUDENTS}명까지입니다. 처음 ${MAX_STUDENTS}명만 반영됩니다.`);
      setDraftStudents(merged.slice(0, MAX_STUDENTS));
    } else {
      setDraftStudents(merged);
    }
    setUploadPreview(null);
  };

  const handleDownloadErrorReport = () => {
    if (!uploadPreview) return;
    const errors = uploadPreview.filter((r) => r.error);
    if (errors.length === 0) return;
    const header = '행,번호,이름,오류 사유\n';
    const body = errors
      .map((r) => `${r.rowIndex},${r.number},"${(r.name || '').replace(/"/g, '""')}",${r.error ?? ''}`)
      .join('\n');
    const blob = new Blob(['\uFEFF' + header + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'roster_upload_errors.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-6 bg-indigo-600 text-white flex justify-between items-center shrink-0">
            <h2 className="text-2xl font-bold flex items-center gap-3">
                <Users /> 학급 명부 관리
            </h2>
            <button onClick={onClose} className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition-colors">
                <X size={24} />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-100 border-b border-gray-200">
                        <tr>
                            <th className="py-3 px-4 text-left text-sm font-bold text-gray-600 w-24">번호</th>
                            <th className="py-3 px-4 text-left text-sm font-bold text-gray-600">이름</th>
                            <th className="py-3 px-4 text-left text-sm font-bold text-gray-600 w-24">성별</th>
                            <th className="py-3 px-4 text-left text-sm font-bold text-gray-600 w-28">생년월일</th>
                            <th className="py-3 px-4 text-left text-sm font-bold text-gray-600 w-24">이전학년반</th>
                            <th className="py-3 px-4 text-left text-sm font-bold text-gray-600 w-24">형제자매</th>
                            <th className="py-3 px-4 text-left text-sm font-bold text-gray-600 w-28">비고</th>
                            <th className="py-3 px-4 text-center text-sm font-bold text-gray-600 w-20">삭제</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading && (
                            <tr>
                                <td colSpan={8} className="py-6 text-center text-gray-400">불러오는 중...</td>
                            </tr>
                        )}
                        {draftStudents.map((student) => (
                            <tr key={student.id} className="group hover:bg-indigo-50/50 transition-colors">
                                <td className="p-3">
                                    <input 
                                        type="number" 
                                        value={student.number ?? ''}
                                        onChange={(e) => handleUpdate(student.id, 'number', e.target.value)}
                                        className="w-full border rounded px-2 py-1 text-center font-mono font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </td>
                                <td className="p-3">
                                    <input 
                                        type="text" 
                                        value={student.name}
                                        onChange={(e) => handleUpdate(student.id, 'name', e.target.value)}
                                        className="w-full border rounded px-2 py-1 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-gray-800"
                                    />
                                </td>
                                <td className="p-3">
                                    <select
                                        value={student.gender ?? ''}
                                        onChange={(e) => handleUpdate(student.id, 'gender', e.target.value)}
                                        className="w-full border rounded px-2 py-1 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-gray-700"
                                    >
                                        <option value="">선택</option>
                                        <option value="male">남</option>
                                        <option value="female">여</option>
                                    </select>
                                </td>
                                <td className="p-3">
                                    <input 
                                        type="text" 
                                        value={student.birthDate ?? ''}
                                        onChange={(e) => handleUpdate(student.id, 'birthDate', e.target.value)}
                                        placeholder="예: 2015.03.02"
                                        className="w-full border rounded px-2 py-1 focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-gray-800"
                                    />
                                </td>
                                <td className="p-3">
                                    <input 
                                        type="text" 
                                        value={student.previousGradeClass ?? ''}
                                        onChange={(e) => handleUpdate(student.id, 'previousGradeClass', e.target.value)}
                                        placeholder="예: 2학년 3반"
                                        className="w-full border rounded px-2 py-1 focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-gray-800"
                                    />
                                </td>
                                <td className="p-3">
                                    <input 
                                        type="text" 
                                        value={student.siblings ?? ''}
                                        onChange={(e) => handleUpdate(student.id, 'siblings', e.target.value)}
                                        placeholder="형제자매"
                                        className="w-full border rounded px-2 py-1 focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-gray-800"
                                    />
                                </td>
                                <td className="p-3">
                                    <input 
                                        type="text" 
                                        value={student.remarks ?? ''}
                                        onChange={(e) => handleUpdate(student.id, 'remarks', e.target.value)}
                                        placeholder="비고"
                                        className="w-full border rounded px-2 py-1 focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-gray-800"
                                    />
                                </td>
                                <td className="p-3 text-center">
                                    <button 
                                        onClick={() => handleDelete(student.id)}
                                        className="text-gray-300 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {!loading && draftStudents.length === 0 && (
                            <tr>
                                <td colSpan={8} className="py-8 text-center text-gray-400">등록된 학생이 없습니다.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        <div className="p-6 bg-white border-t border-gray-200 shrink-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2 py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600 font-medium">일괄 등록:</span>
              <button type="button" onClick={handleSampleDownload} className="px-4 py-2.5 rounded-xl border-2 border-indigo-200 bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100 flex items-center gap-2 transition-colors">
                <FileSpreadsheet size={18} /> 샘플 다운로드
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2.5 rounded-xl border-2 border-indigo-200 bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100 flex items-center gap-2 transition-colors">
                <Upload size={18} /> 엑셀/CSV 업로드
              </button>
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
              <span className="text-xs text-gray-500">샘플을 받아 엑셀에 입력한 뒤 업로드하세요.</span>
            </div>

            <form onSubmit={handleAdd} className="flex gap-2">
                <input 
                    type="text" 
                    value={inputName}
                    onChange={e => setInputName(e.target.value)}
                    placeholder="새로운 학생 이름 입력"
                    className="flex-1 border-2 border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <button type="submit" disabled={!inputName.trim() || draftStudents.length >= MAX_STUDENTS} className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 rounded-xl font-bold flex items-center gap-2 disabled:bg-gray-300 transition-colors">
                    <UserPlus size={20} /> 추가
                </button>
            </form>

            {uploadPreview !== null && (
              <div className="mb-4 p-4 bg-gray-100 rounded-xl border border-gray-200">
                <h3 className="text-sm font-bold text-gray-700 mb-2">업로드 미리보기 (최대 {PREVIEW_MAX}행)</h3>
                <div className="overflow-x-auto max-h-48 overflow-y-auto border border-gray-200 rounded-lg bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="py-2 px-3 text-left font-bold text-gray-600">행</th>
                        <th className="py-2 px-3 text-left font-bold text-gray-600">번호</th>
                        <th className="py-2 px-3 text-left font-bold text-gray-600">이름</th>
                        <th className="py-2 px-3 text-left font-bold text-gray-600">성별</th>
                        <th className="py-2 px-3 text-left font-bold text-gray-600">오류</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploadPreview.slice(0, PREVIEW_MAX).map((r) => (
                        <tr key={r.rowIndex} className={r.error ? 'bg-red-50' : ''}>
                          <td className="py-1 px-3">{r.rowIndex}</td>
                          <td className="py-1 px-3">{r.number}</td>
                          <td className="py-1 px-3">{r.name}</td>
                          <td className="py-1 px-3">{r.gender === 'male' ? '남' : r.gender === 'female' ? '여' : ''}</td>
                          <td className="py-1 px-3 text-red-600 text-xs">{r.error ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleMergeUpload}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center gap-1"
                  >
                    <Upload size={16} /> 명단에 반영
                  </button>
                  {uploadPreview.some((r) => r.error) && (
                    <button
                      type="button"
                      onClick={handleDownloadErrorReport}
                      className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 text-sm font-bold hover:bg-gray-50 flex items-center gap-1"
                    >
                      <Download size={16} /> 실패 내역 다운로드
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setUploadPreview(null)}
                    className="px-4 py-2 rounded-xl border border-gray-300 text-gray-500 text-sm hover:bg-gray-50"
                  >
                    미리보기 닫기
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-2">
                <button onClick={handleReset} className="text-gray-400 hover:text-red-500 text-sm flex items-center gap-1 font-medium">
                    <RotateCcw size={14} /> 명단 초기화
                </button>
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={handleSampleDownload} className="px-4 py-3 rounded-xl border-2 border-indigo-200 bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100 flex items-center gap-2">
                        <FileSpreadsheet size={18} /> 샘플 다운로드
                    </button>
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-3 rounded-xl border-2 border-indigo-200 bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100 flex items-center gap-2">
                        <Upload size={18} /> 엑셀/CSV 업로드
                    </button>
                    <button onClick={handleDownloadPdf} className="px-6 py-3 rounded-xl border border-gray-300 font-bold text-gray-600 hover:bg-gray-50 flex items-center gap-2">
                        <Download size={18} /> PDF 다운로드
                    </button>
                    <button onClick={onClose} className="px-6 py-3 rounded-xl border border-gray-300 font-bold text-gray-600 hover:bg-gray-50">
                        취소
                    </button>
                    <button onClick={handleSave} disabled={saving} className="px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed">
                        <Save size={20} /> {saving ? '저장 중...' : '저장 및 적용'}
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
