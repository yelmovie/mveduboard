
import React, { useState, useEffect, useRef } from 'react';
import { Home, Users, Settings, Shuffle, Lock, Unlock, History, Save, UserCheck, Trash2, Download, RefreshCw, Loader2 } from 'lucide-react';
import * as roleService from '../services/roleService';
import * as studentService from '../services/studentService';
import { RoleData } from '../types';

interface RoleAppProps {
  onBack: () => void;
  isTeacherMode: boolean;
}

type Tab = 'board' | 'students' | 'roles' | 'history';

const getFallbackData = (): RoleData => ({
  students: [],
  roles: roleService.getInitialRoles().map((title) => ({ id: `role-${title}`, title })),
  currentAssignments: [],
  history: [],
});

/** 로컬(localStorage + 명부 캐시)만으로 즉시 데이터 반환 - 첫 화면 빠르게 표시용 */
const getInitialData = (): RoleData => {
  try {
    return roleService.getRoleData();
  } catch {
    return getFallbackData();
  }
};

export const RoleApp: React.FC<RoleAppProps> = ({ onBack, isTeacherMode }) => {
  const [data, setData] = useState<RoleData | null>(() => getInitialData());
  const [activeTab, setActiveTab] = useState<Tab>('board');
  const [roleInput, setRoleInput] = useState(() => getInitialData().roles.map((r) => r.title).join('\n'));
  
  const [customRoleInputs, setCustomRoleInputs] = useState<Record<string, string>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const emptyRetryDone = useRef(false);

  useEffect(() => {
    loadData();
  }, [isTeacherMode]);

  // 안전장치: 10초 후에도 data가 null이면 fallback (현재는 초기값이 있으므로 거의 미사용)
  useEffect(() => {
    if (data !== null) return;
    const t = setTimeout(() => {
      const fallback = getFallbackData();
      setData((prev) => {
        if (prev !== null) return prev;
        queueMicrotask(() => setRoleInput(fallback.roles.map((r) => r.title).join('\n')));
        return fallback;
      });
    }, 10000);
    return () => clearTimeout(t);
  }, [data]);

  // 교사 모드에서 학생이 0명일 때 한 번 더 명부 반영 시도
  useEffect(() => {
    if (!isTeacherMode || !data || data.students.length > 0 || emptyRetryDone.current) return;
    emptyRetryDone.current = true;
    const t = setTimeout(() => {
      (async () => {
        try {
          await studentService.preloadClassId();
          await studentService.fetchRosterFromDb();
          const d = roleService.getRoleData();
          if (d.students.length > 0) {
            setData(d);
            setRoleInput(d.roles.map((r) => r.title).join('\n'));
          }
        } catch {
          /* ignore */
        }
      })();
    }, 600);
    return () => clearTimeout(t);
  }, [isTeacherMode, data]);

  const LOAD_TIMEOUT_MS = 6000;

  const loadData = async () => {
    try {
      await Promise.race([
        (async () => {
          try {
            await studentService.preloadClassId();
            await studentService.fetchRosterFromDb();
          } catch {
            /* fallback to localStorage */
          }
          try {
            await roleService.loadRoleDataAsync();
          } catch {
            /* fallback to localStorage */
          }
        })(),
        new Promise<void>((resolve) => setTimeout(resolve, LOAD_TIMEOUT_MS)),
      ]);
    } catch {
      /* ignore */
    }
    try {
      const d = roleService.getRoleData();
      setData(d);
      setRoleInput(d.roles.map((r) => r.title).join('\n'));
    } catch (e) {
      console.error('[RoleApp] getRoleData error', e);
      const fallback = getFallbackData();
      setData(fallback);
      setRoleInput(fallback.roles.map((r) => r.title).join('\n'));
    }
  };

  const handleSyncFromRoster = async () => {
    setIsSyncing(true);
    try {
      await studentService.preloadClassId();
      await studentService.fetchRosterFromDb();
      const d = roleService.getRoleData();
      setData(d);
      alert(`학급 명부에서 ${d.students.length}명의 학생을 불러왔습니다.`);
    } catch (err: any) {
      alert(err.message || '명부를 불러오는데 실패했습니다.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveRoles = () => {
      if (!data) return;
      if (!confirm('역할 목록을 수정하시겠습니까?')) return;
      const titles = roleInput.split('\n').map(s => s.trim()).filter(s => s !== '');
      const newData = roleService.updateRoles(data, titles);
      setData(newData);
      alert('역할 목록이 저장되었습니다.');
  };

  const handleLoadSampleRoles = () => {
      if(!confirm('기본 30개 역할 샘플로 목록을 교체하시겠습니까?\n현재 입력된 역할 목록은 사라집니다.')) return;
      const sampleRoles = roleService.getInitialRoles();
      setRoleInput(sampleRoles.join('\n'));
  };

  const handleShuffle = () => {
      if (!data) return;
      // if (!confirm('역할을 랜덤으로 배정하시겠습니까? (잠금된 역할은 유지됩니다)')) return;
      const newData = roleService.assignRoles(data);
      setData(newData);
  };

  const handleSaveHistory = () => {
      if (!data) return;
      if (!confirm('현재 배정 결과를 이달의 기록으로 저장하시겠습니까? (1년 보관)')) return;
      const newData = roleService.saveHistory(data);
      setData(newData);
      alert('기록이 저장되었습니다. [기록 보기] 탭에서 확인할 수 있습니다.');
  };

  const handleReset = () => {
    if (!confirm('모든 데이터가 초기화됩니다. 정말 하시겠습니까?')) return;
    roleService.resetData();
    loadData();
  };


  if (!data) return <div>Loading...</div>;

  // --- Student View ---
  if (!isTeacherMode) {
      // Filter out unassigned
      const assignedList = data.currentAssignments.filter(a => a.roleId);
      
      return (
        <div className="min-h-screen bg-teal-50 flex flex-col font-sans">
            <header className="bg-white p-4 shadow-sm flex items-center gap-3 sticky top-0 z-10">
                <button onClick={onBack} className="bg-gray-100 p-2 rounded-full text-gray-500 hover:bg-gray-200"><Home size={20}/></button>
                <h1 className="font-bold text-teal-900 text-xl flex items-center gap-2"><UserCheck /> 이번달 1인 1역</h1>
            </header>

            <main className="p-6 max-w-6xl mx-auto w-full">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {assignedList.length === 0 ? (
                         <div className="col-span-full text-center py-20 text-gray-400">
                             <UserCheck size={64} className="mx-auto mb-4 opacity-30" />
                             <p>아직 역할이 배정되지 않았습니다.</p>
                         </div>
                    ) : (
                        assignedList.map(assignment => {
                            const student = data.students.find(s => s.id === assignment.studentId);
                            const role = data.roles.find(r => r.id === assignment.roleId);
                            if (!student || !role) return null;

                            return (
                                <div key={assignment.studentId} className="bg-white rounded-xl shadow-md p-5 border-l-4 border-teal-500 flex items-center justify-between hover:shadow-lg transition-shadow">
                                    <div className="flex flex-col">
                                        <span className="text-gray-500 text-sm font-bold mb-1">{student.name}</span>
                                        <span className="text-xl font-black text-gray-800">{role.title}</span>
                                    </div>
                                    <div className="bg-teal-100 text-teal-700 p-2 rounded-full">
                                        <UserCheck size={20} />
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </main>
        </div>
      );
  }

  // --- Teacher View ---
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <header className="bg-white p-4 shadow-sm sticky top-0 z-20">
            <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button onClick={onBack} className="bg-gray-100 p-2 rounded-full text-gray-500 hover:bg-gray-200"><Home size={20}/></button>
                    <h1 className="font-bold text-slate-800 text-xl flex items-center gap-2"><Settings /> 1인 1역 관리</h1>
                </div>
                
                {/* Tabs */}
                <div className="flex bg-gray-100 p-1 rounded-lg w-full sm:w-auto overflow-x-auto">
                    {[
                        { id: 'board', label: '역할 배정', icon: UserCheck },
                        { id: 'students', label: '명단 관리', icon: Users },
                        { id: 'roles', label: '역할 목록', icon: Settings },
                        { id: 'history', label: '지난 기록', icon: History },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as Tab)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <tab.icon size={16} /> {tab.label}
                        </button>
                    ))}
                </div>
            </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full">
            
            {/* 1. Board Tab */}
            {activeTab === 'board' && (
                <div className="space-y-6 animate-fade-in-up">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">이번 달 역할 배정</h2>
                            <p className="text-sm text-gray-500">잠금 버튼을 누르면 랜덤 배치 시 변경되지 않습니다.</p>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                             <button 
                                onClick={handleShuffle}
                                className="flex-1 sm:flex-none bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform"
                            >
                                <Shuffle size={18} /> 랜덤 배치
                            </button>
                            <button 
                                onClick={handleSaveHistory}
                                className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-transform"
                            >
                                <Save size={18} /> 기록 저장
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {data.students.map(student => {
                            const assignment = data.currentAssignments.find(a => a.studentId === student.id) || { studentId: student.id, roleId: null, isLocked: false };
                            // data.roles is guaranteed to be array by getRoleData
                            const role = data.roles.find(r => r.id === assignment.roleId);
                            return (
                                <div key={student.id} className={`bg-white rounded-xl shadow-sm p-4 border transition-all ${assignment.isLocked ? 'border-orange-300 ring-1 ring-orange-100' : 'border-gray-200 hover:border-teal-300'}`}>
                                    <div className="flex justify-between items-center mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-gray-700">{student.name}</span>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                const newData = roleService.toggleLock(data, student.id);
                                                setData(newData);
                                            }}
                                            className={`p-1.5 rounded-md transition-colors ${assignment.isLocked ? 'bg-orange-100 text-orange-600' : 'text-gray-300 hover:bg-gray-100 hover:text-gray-500'}`}
                                            title={assignment.isLocked ? "잠금 해제" : "잠금"}
                                        >
                                            {assignment.isLocked ? <Lock size={16} /> : <Unlock size={16} />}
                                        </button>
                                    </div>
                                    
                                    <select 
                                        className="w-full p-2 border rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-teal-500 focus:outline-none text-gray-800"
                                        value={assignment.roleId || ''}
                                        onChange={(e) => {
                                            const newData = roleService.manualAssign(data, student.id, e.target.value);
                                            setData(newData);
                                        }}
                                    >
                                        <option value="">(역할 없음)</option>
                                        {data.roles.map(r => (
                                            <option key={r.id} value={r.id}>{r.title}</option>
                                        ))}
                                    </select>
                                    <div className="mt-2 flex gap-2">
                                        <input
                                            type="text"
                                            value={customRoleInputs[student.id] || ''}
                                            onChange={(e) => setCustomRoleInputs((prev) => ({ ...prev, [student.id]: e.target.value }))}
                                            placeholder="역할 직접 입력"
                                            className="flex-1 p-2 border rounded-lg text-xs focus:ring-2 focus:ring-teal-500 outline-none"
                                        />
                                        <button
                                            onClick={() => {
                                                const input = customRoleInputs[student.id]?.trim() || '';
                                                if (!input) return;
                                                const newData = roleService.assignRoleByTitle(data, student.id, input);
                                                setData(newData);
                                                setCustomRoleInputs((prev) => ({ ...prev, [student.id]: '' }));
                                            }}
                                            className="px-3 py-2 rounded-lg text-xs font-bold bg-teal-600 text-white hover:bg-teal-700"
                                        >
                                            입력
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 2. Students Tab */}
            {activeTab === 'students' && (
                <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl mx-auto border border-gray-200 animate-fade-in-up">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <Users size={20} /> 학생 명단 관리
                        </h2>
                        <button
                            onClick={handleSyncFromRoster}
                            disabled={isSyncing}
                            className="bg-teal-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-teal-700 flex items-center gap-2 disabled:bg-gray-400 text-sm"
                        >
                            {isSyncing ? (
                                <><Loader2 size={16} className="animate-spin" /> 불러오는 중...</>
                            ) : (
                                <><RefreshCw size={16} /> 학급 명부에서 불러오기</>
                            )}
                        </button>
                    </div>
                    <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 mb-4">
                        <p className="text-sm text-teal-800 font-bold mb-1">학급 명부 연동</p>
                        <p className="text-xs text-teal-700">
                            선생님 대시보드의 [학급관리 &gt; 명단 관리]에서 등록한 학생 명단을 자동으로 불러옵니다.<br/>
                            명단을 수정하려면 [학급관리 &gt; 명단 관리]에서 변경 후 위의 "학급 명부에서 불러오기" 버튼을 눌러주세요.
                        </p>
                    </div>

                    {data.students.length === 0 ? (
                        <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                            <Users size={48} className="mx-auto mb-4 text-gray-300" />
                            <p className="text-gray-500 font-bold mb-2">등록된 학생이 없습니다.</p>
                            <p className="text-gray-400 text-sm mb-4">선생님 대시보드에서 학급 명부를 먼저 등록해주세요.</p>
                            <button
                                onClick={handleSyncFromRoster}
                                disabled={isSyncing}
                                className="bg-teal-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-teal-700 inline-flex items-center gap-2 disabled:bg-gray-400"
                            >
                                {isSyncing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                                학급 명부에서 불러오기
                            </button>
                        </div>
                    ) : (
                        <div className="border rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-gray-600 font-bold w-16">번호</th>
                                        <th className="px-4 py-3 text-left text-gray-600 font-bold">이름</th>
                                        <th className="px-4 py-3 text-left text-gray-600 font-bold">현재 역할</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {data.students.map((student, idx) => {
                                        const assignment = data.currentAssignments.find(a => a.studentId === student.id);
                                        const role = assignment?.roleId ? data.roles.find(r => r.id === assignment.roleId) : null;
                                        return (
                                            <tr key={student.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 text-gray-500 font-mono">{idx + 1}</td>
                                                <td className="px-4 py-3 text-gray-800 font-bold">{student.name}</td>
                                                <td className="px-4 py-3">
                                                    {role ? (
                                                        <span className="inline-block bg-teal-100 text-teal-700 px-2 py-1 rounded-full text-xs font-bold">{role.title}</span>
                                                    ) : (
                                                        <span className="text-gray-300 text-xs">미배정</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <div className="bg-gray-50 px-4 py-3 border-t text-xs text-gray-500 font-bold">
                                총 {data.students.length}명
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 3. Roles Tab */}
            {activeTab === 'roles' && (
                <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl mx-auto border border-gray-200 animate-fade-in-up">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <Settings size={20} /> 역할 목록 관리
                        </h2>
                        <button 
                            onClick={handleLoadSampleRoles}
                            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-full font-bold flex items-center gap-1 transition-colors"
                        >
                            <Download size={14}/> 기본 30개 샘플 불러오기
                        </button>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">
                        배정할 역할들을 입력해주세요. 줄바꿈(Enter)으로 구분합니다.<br/>
                        학생 수보다 역할이 적으면 일부 역할이 중복 배정될 수 있습니다.
                    </p>
                    <textarea 
                        value={roleInput}
                        onChange={e => setRoleInput(e.target.value)}
                        className="w-full h-48 border rounded-xl p-4 text-gray-800 focus:ring-2 focus:ring-teal-500 mb-4 font-mono text-sm leading-relaxed"
                        placeholder="칠판 지우기&#10;우유 당번&#10;줄 세우기..."
                    />
                    {(() => {
                        const parsed = roleInput.split('\n').map(s => s.trim()).filter(s => s !== '');
                        return parsed.length > 0 ? (
                            <div className="border rounded-xl overflow-hidden mb-4">
                                <div className="bg-gray-50 px-4 py-2 border-b text-xs font-bold text-gray-600 flex justify-between">
                                    <span>역할 미리보기</span>
                                    <span className="text-teal-600">총 {parsed.length}개</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-0 max-h-48 overflow-y-auto">
                                    {parsed.map((role, i) => (
                                        <div key={i} className="flex items-center gap-2 px-3 py-2 border-b border-r border-gray-100 text-sm">
                                            <span className="text-xs font-bold text-teal-600 bg-teal-50 w-6 h-6 rounded-full flex items-center justify-center shrink-0">{i + 1}</span>
                                            <span className="text-gray-700 truncate">{role}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null;
                    })()}
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">총 {roleInput.split('\n').filter(s=>s.trim()).length}개</span>
                        <button 
                            onClick={handleSaveRoles}
                            className="bg-teal-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-teal-700"
                        >
                            저장하기
                        </button>
                    </div>
                </div>
            )}

            {/* 4. History Tab (Updated Table Layout) */}
            {activeTab === 'history' && (
                <div className="space-y-6 animate-fade-in-up">
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="text-lg font-bold text-gray-800">학생별 역할 배정 기록</h2>
                        <button onClick={handleReset} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
                            <Trash2 size={12} /> 전체 초기화
                        </button>
                    </div>
                    
                    {(!data.history || data.history.length === 0) ? (
                        <div className="text-center py-20 text-gray-400 bg-white rounded-xl border border-dashed">
                            <History size={48} className="mx-auto mb-4 opacity-30" />
                            <p>저장된 기록이 없습니다.</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-100 text-gray-600 font-bold border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3 min-w-[100px] sticky left-0 bg-gray-100 z-10 border-r border-gray-200">학생 이름</th>
                                        {/* Sort History by date asc for table columns */}
                                        {[...data.history].sort((a,b) => a.date.localeCompare(b.date)).map((h, i) => (
                                            <th key={i} className="px-4 py-3 min-w-[120px] text-center border-r border-gray-200 last:border-r-0">
                                                {h.date}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {data.students.map((student) => (
                                        <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 font-bold text-gray-800 sticky left-0 bg-white border-r border-gray-200 z-10 group-hover:bg-gray-50">
                                                {student.name}
                                            </td>
                                            {[...data.history].sort((a,b) => a.date.localeCompare(b.date)).map((h, i) => {
                                                const assignment = h.assignments.find(a => a.studentId === student.id);
                                                const roleName = assignment && assignment.roleId 
                                                    ? data.roles.find(r => r.id === assignment.roleId)?.title 
                                                    : '-';
                                                
                                                return (
                                                    <td key={i} className="px-4 py-3 text-center text-gray-600 border-r border-gray-200 last:border-r-0 truncate max-w-[150px]" title={roleName}>
                                                        {roleName || '-'}
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

        </main>
    </div>
  );
};
