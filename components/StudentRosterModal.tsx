
import React, { useEffect, useState } from 'react';
import { X, UserPlus, Save, Trash2, RotateCcw, Users, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { supabase } from '../src/lib/supabase/client';
import * as studentService from '../services/studentService';
import { ClassStudent } from '../types';
import { getCurrentUserProfile, getSession } from '../src/lib/supabase/auth';
import { generateUUID } from '../src/utils/uuid';

interface StudentRosterModalProps {
  onClose: () => void;
}

export const StudentRosterModal: React.FC<StudentRosterModalProps> = ({ onClose }) => {
  type TempStudent = { id: string; name: string; number?: number; gender?: 'male' | 'female'; executiveRole?: 'president' | 'vice' };
  const MAX_STUDENTS = 30;
  const [draftStudents, setDraftStudents] = useState<TempStudent[]>([]);
  const [inputName, setInputName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStudents = async () => {
      setLoading(true);
      try {
        if (!supabase) {
          setDraftStudents(studentService.getRoster());
          return;
        }
        const session = await getSession();
        const userId = session?.user?.id;
        const profile = await getCurrentUserProfile();
        const classId = profile?.class_id;
        if (!userId || !classId) {
          setDraftStudents(studentService.getRoster());
          return;
        }
        const { data, error } = await supabase
          .from('students')
          .select('id, name, student_no, gender')
          .eq('class_id', classId)
          .eq('created_by', userId)
          .order('student_no', { ascending: true });
        if (error) {
          console.error('[StudentRosterModal] load error', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
          });
          setDraftStudents(studentService.getRoster());
          return;
        }
        const mapped = (data || []).map((s) => ({
          id: s.id,
          name: s.name,
          number: s.student_no ?? undefined,
          gender: s.gender === 'male' || s.gender === 'female' ? s.gender : undefined,
          executiveRole: undefined,
        }));
        setDraftStudents(studentService.normalizeRoster(mapped));
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

  const handleUpdate = (id: string, field: 'name' | 'number' | 'gender' | 'executiveRole', value: string) => {
      const newStudents = draftStudents.map(s => {
          if (s.id === id) {
              if (field === 'number') {
                const next = Math.min(Math.max(parseInt(value) || 0, 1), MAX_STUDENTS);
                return { ...s, number: next };
              }
              if (field === 'gender') {
                return { ...s, gender: value === 'male' || value === 'female' ? value : undefined };
              }
              if (field === 'executiveRole') {
                return { ...s, executiveRole: value === 'president' || value === 'vice' ? value : undefined };
              }
              return { ...s, name: value };
          }
          return s;
      });
      if (field === 'executiveRole' && (value === 'president' || value === 'vice')) {
        const updated = newStudents.map((s) =>
          s.id !== id && s.executiveRole === value ? { ...s, executiveRole: undefined } : s
        );
        setDraftStudents(updated);
        return;
      }
      setDraftStudents(newStudents);
  };

  const handleSave = async () => {
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
      const presidentCount = normalized.filter((s) => s.executiveRole === 'president').length;
      const viceCount = normalized.filter((s) => s.executiveRole === 'vice').length;
      if (presidentCount > 1 || viceCount > 1) {
        alert('회장/부회장은 각각 1명만 지정할 수 있습니다.');
        return;
      }
      setDraftStudents(normalized);
      const profile = await getCurrentUserProfile();
      const classId = profile?.class_id;
      if (!classId) {
        alert('학급 정보를 찾을 수 없습니다. 다시 로그인해주세요.');
        return;
      }
      try {
        const payload = normalized.map((s, idx) => ({
          class_id: classId,
          name: s.name,
          student_no: s.number ?? idx + 1,
          gender: s.gender ?? null,
        }));
        await studentService.saveRosterToDb(normalized, classId);
        console.log('[StudentRosterModal] save payload', payload);
      } catch (error) {
        console.error('[StudentRosterModal] save error', error);
        alert('저장에 실패했습니다. 다시 시도해주세요.');
        return;
      }
      const roster: ClassStudent[] = normalized.map((s, idx) => ({
        id: s.id,
        name: s.name,
        number: s.number ?? idx + 1,
        gender: s.gender,
        executiveRole: s.executiveRole,
      }));
      studentService.saveRoster(roster);
      alert('학급 명부가 저장되었습니다. 모든 앱에 반영됩니다.');
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
                            <th className="py-3 px-4 text-left text-sm font-bold text-gray-600 w-28">임원</th>
                            <th className="py-3 px-4 text-center text-sm font-bold text-gray-600 w-20">삭제</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading && (
                            <tr>
                                <td colSpan={5} className="py-6 text-center text-gray-400">불러오는 중...</td>
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
                                    <select
                                        value={student.executiveRole ?? ''}
                                        onChange={(e) => handleUpdate(student.id, 'executiveRole', e.target.value)}
                                        className="w-full border rounded px-2 py-1 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold text-gray-700"
                                    >
                                        <option value="">없음</option>
                                        <option value="president">회장</option>
                                        <option value="vice">부회장</option>
                                    </select>
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
                                <td colSpan={5} className="py-8 text-center text-gray-400">등록된 학생이 없습니다.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        <div className="p-6 bg-white border-t border-gray-200 shrink-0 space-y-4">
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

            <div className="flex justify-between items-center pt-2">
                <button onClick={handleReset} className="text-gray-400 hover:text-red-500 text-sm flex items-center gap-1 font-medium">
                    <RotateCcw size={14} /> 명단 초기화
                </button>
                <div className="flex gap-3">
                    <button onClick={handleDownloadPdf} className="px-6 py-3 rounded-xl border border-gray-300 font-bold text-gray-600 hover:bg-gray-50 flex items-center gap-2">
                        <Download size={18} /> PDF 다운로드
                    </button>
                    <button onClick={onClose} className="px-6 py-3 rounded-xl border border-gray-300 font-bold text-gray-600 hover:bg-gray-50">
                        취소
                    </button>
                    <button onClick={handleSave} className="px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg flex items-center gap-2">
                        <Save size={20} /> 저장 및 적용
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
