
import { RoleData, RoleItem, RoleStudent, RoleAssignment, RoleHistory } from '../types';
import * as studentService from './studentService';
import { generateUUID } from '../src/utils/uuid';

const LS_KEY = 'edu_role_data';

const INITIAL_ROLES = [
  '줄세우기', '분리수거1', '분리수거2', '창문환기', '시간표관리',
  '칠판관리1', '칠판관리2', '책장 정리', '에너지절약', '청소 검사',
  '앞쓸기', '뒤쓸기', '태블릿관리1', '태블릿관리2', '교실물건정리1',
  '교실물건정리2', '분실물정리, 찾아주기', '복도쓰레기정리', '신발장 정리', '복도쪽 쓸기',
  '창가쪽 쓸기', '변호사1', '변호사2', '판사1', '판사2',
  '1인1역검사', '서기,필기', '미세먼지체크', '서랍정리체크', '우유급식체크'
];

export const getInitialRoles = () => INITIAL_ROLES;

export const getRoleData = (): RoleData => {
  const stored = localStorage.getItem(LS_KEY);
  const roster = studentService.getRoster();
  
  let data: RoleData;

  if (stored) {
      try {
          data = JSON.parse(stored);
      } catch (e) {
          console.error("Role Data Parse Error", e);
          data = { students: [], roles: [], currentAssignments: [], history: [] };
      }

      // 1. Ensure all properties exist & Sanitize
      if (!Array.isArray(data.history)) data.history = [];
      data.history = data.history.filter(h => h && Array.isArray(h.assignments));

      if (!Array.isArray(data.roles)) data.roles = [];
      if (!Array.isArray(data.students)) data.students = [];
      if (!Array.isArray(data.currentAssignments)) data.currentAssignments = [];

      // 2. Sync roster: Add missing students
      const existingIds = new Set(data.students.map(s => s.id));
      const rosterIds = new Set(roster.map(s => s.id));

      roster.forEach(s => {
          if (!existingIds.has(s.id)) {
              data.students.push({ id: s.id, name: s.name });
              const hasAssignment = data.currentAssignments.some(a => a.studentId === s.id);
              if (!hasAssignment) {
                  data.currentAssignments.push({ studentId: s.id, roleId: null, isLocked: false });
              }
          } else {
              const existing = data.students.find(es => es.id === s.id);
              if (existing && existing.name !== s.name) existing.name = s.name;
          }
      });

      // 3. Remove deleted students
      data.students = data.students.filter(s => rosterIds.has(s.id));
      data.currentAssignments = data.currentAssignments.filter(a => rosterIds.has(a.studentId));
      
      // 4. Sort students by roster order
      const rosterOrder = new Map(roster.map((s, i) => [s.id, i]));
      data.students.sort((a, b) => (rosterOrder.get(a.id) ?? 0) - (rosterOrder.get(b.id) ?? 0));

      saveData(data);
  } else {
      // Initialize new
      const students: RoleStudent[] = roster.map(s => ({ id: s.id, name: s.name }));
      const roles: RoleItem[] = INITIAL_ROLES.map(title => ({ id: generateUUID(), title }));
      
      const currentAssignments: RoleAssignment[] = students.map(s => ({
          studentId: s.id,
          roleId: null,
          isLocked: false
      }));

      data = {
          students,
          roles,
          currentAssignments,
          history: []
      };
      
      localStorage.setItem(LS_KEY, JSON.stringify(data));
  }
  return data;
};

export const saveData = (data: RoleData) => {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
};

export const resetData = () => {
    localStorage.removeItem(LS_KEY);
};

// --- Core Logic: Shuffle Roles with History Avoidance ---

export const assignRoles = (data: RoleData): RoleData => {
    const history = data.history || [];
    const students = data.students || [];
    const roles = data.roles || [];
    const currentAssignments = data.currentAssignments || [];

    // 1. Identify Locked Assignments
    const lockedAssignments = currentAssignments.filter(a => a.isLocked && a.roleId !== null);
    const lockedStudentIds = new Set(lockedAssignments.map(a => a.studentId));
    // Count how many times each role is used in locked (to subtract from pool)
    const lockedRoleCounts = new Map<string, number>();
    lockedAssignments.forEach(a => {
        if (a.roleId) lockedRoleCounts.set(a.roleId, (lockedRoleCounts.get(a.roleId) || 0) + 1);
    });

    const availableStudents = students.filter(s => !lockedStudentIds.has(s.id));
    
    if (availableStudents.length === 0) return data;

    // 2. Prepare Role Pool
    // We need exactly 'availableStudents.length' roles in the pool.
    // Logic: Fill with available roles. If roles < students, duplicate roles.
    let rolePool: string[] = [];
    
    // Create base pool from all roles
    const baseRoleIds = roles.map(r => r.id);
    let tempPool: string[] = [];

    // Simple distribution strategy:
    // If we have 30 students and 30 roles, use all.
    // If we have 30 students and 15 roles, use each role twice.
    if (baseRoleIds.length > 0) {
        let i = 0;
        while (tempPool.length < students.length) { // Fill enough for EVERYONE first
            tempPool.push(baseRoleIds[i % baseRoleIds.length]);
            i++;
        }
    } else {
        // No roles defined?
        return data;
    }

    // Now remove the roles that are already locked
    // This is tricky because of duplicates. We need to remove one instance for each lock.
    const finalPool: string[] = [];
    const lockedConsumed = new Map(lockedRoleCounts); // Copy to track consumption

    // We iterate the "ideal full distribution" and skip if it's locked
    // But since we want to reshuffle the *remaining* students, we just need to ensure
    // the remaining pool size matches availableStudents.length
    
    // Easier strategy: Just build a pool of size 'availableStudents.length' from scratch
    // prioritizing roles that are least used or just cycling.
    // BUT we must respect "1 student 1 role" concept if roles >= students.
    
    // Strategy B:
    // 1. Determine total slots needed = students.length
    // 2. Create a "Ideal Full Pool" of that size.
    // 3. Remove the specific locked RoleIDs from that pool (one by one).
    // 4. Whatever remains is the shuffle pool.
    
    const idealPool: string[] = [];
    let roleIdx = 0;
    for(let k=0; k<students.length; k++) {
        if (baseRoleIds.length > 0) {
            idealPool.push(baseRoleIds[roleIdx % baseRoleIds.length]);
            roleIdx++;
        }
    }

    // Remove locked roles from ideal pool
    // We try to match locked roles by ID and remove them.
    for (const lockedRole of lockedRoleCounts.keys()) {
        let count = lockedRoleCounts.get(lockedRole) || 0;
        while (count > 0) {
            const idx = idealPool.indexOf(lockedRole);
            if (idx > -1) {
                idealPool.splice(idx, 1);
            }
            count--;
        }
    }

    // Now idealPool should be roughly the size of availableStudents.
    // If it's smaller (because we removed specific instances but maybe distribution was uneven), fill it.
    // If it's larger (unlikely if logic holds), trim it.
    while (idealPool.length < availableStudents.length) {
        if (baseRoleIds.length > 0) {
             idealPool.push(baseRoleIds[Math.floor(Math.random() * baseRoleIds.length)]);
        } else {
            break;
        }
    }
    // Trim if excess
    while (idealPool.length > availableStudents.length) {
        idealPool.pop();
    }

    rolePool = idealPool;
    rolePool.sort(() => Math.random() - 0.5); // Initial Shuffle

    // 3. History Check & Swap (Monte Carlo)
    // Map: StudentID -> Set(RoleIDs they have done)
    const historyMap = new Map<string, Set<string>>();
    history.forEach(h => {
        if (Array.isArray(h.assignments)) {
            h.assignments.forEach(a => {
                if (a.roleId) {
                    if (!historyMap.has(a.studentId)) historyMap.set(a.studentId, new Set());
                    historyMap.get(a.studentId)!.add(a.roleId);
                }
            });
        }
    });

    const tempAssignments: {studentId: string, roleId: string}[] = availableStudents.map((s, i) => ({
        studentId: s.id,
        roleId: rolePool[i]
    }));

    // Try to swap to minimize conflicts
    // We loop N times. If a student has a conflict, we try to swap with a random other student.
    // If the swap improves or is neutral, we keep it.
    const MAX_ITERATIONS = 500;
    
    for (let i = 0; i < MAX_ITERATIONS; i++) {
        // Find all conflicts
        const conflictIndices = tempAssignments
            .map((a, idx) => ({ idx, hasConflict: historyMap.get(a.studentId)?.has(a.roleId) }))
            .filter(item => item.hasConflict)
            .map(item => item.idx);

        if (conflictIndices.length === 0) break; // Solved!

        // Pick one conflict
        const idxA = conflictIndices[Math.floor(Math.random() * conflictIndices.length)];
        // Pick any random other slot to swap with
        const idxB = Math.floor(Math.random() * tempAssignments.length);

        if (idxA === idxB) continue;

        const assignmentA = tempAssignments[idxA];
        const assignmentB = tempAssignments[idxB];

        // Check if swap helps
        // Current Conflicts: (A has history with roleA?) + (B has history with roleB?) (We know A does)
        // New Conflicts: (A has history with roleB?) + (B has history with roleA?)
        
        const currentConflictCount = 
            (historyMap.get(assignmentA.studentId)?.has(assignmentA.roleId) ? 1 : 0) +
            (historyMap.get(assignmentB.studentId)?.has(assignmentB.roleId) ? 1 : 0);
            
        const newConflictCount = 
            (historyMap.get(assignmentA.studentId)?.has(assignmentB.roleId) ? 1 : 0) +
            (historyMap.get(assignmentB.studentId)?.has(assignmentA.roleId) ? 1 : 0);

        // Swap if it improves or stays same (to escape local minima) with small probability
        if (newConflictCount < currentConflictCount || (newConflictCount === currentConflictCount && Math.random() > 0.5)) {
            const tempRole = assignmentA.roleId;
            assignmentA.roleId = assignmentB.roleId;
            assignmentB.roleId = tempRole;
        }
    }

    // 4. Construct Final Assignments
    const newAssignmentsMap = new Map<string, RoleAssignment>();
    
    lockedAssignments.forEach(a => newAssignmentsMap.set(a.studentId, a));
    tempAssignments.forEach(t => {
        newAssignmentsMap.set(t.studentId, {
            studentId: t.studentId,
            roleId: t.roleId,
            isLocked: false
        });
    });

    const finalAssignments = students.map(s => {
        if (newAssignmentsMap.has(s.id)) {
            return newAssignmentsMap.get(s.id)!;
        }
        return { studentId: s.id, roleId: null, isLocked: false };
    });

    const newData = { ...data, currentAssignments: finalAssignments };
    saveData(newData);
    return newData;
};

export const saveHistory = (data: RoleData): RoleData => {
    const today = new Date();
    // Use YYYY-MM format to group by month
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    
    const history = Array.isArray(data.history) ? data.history : [];
    
    // Check if entry for this month already exists
    const existingIdx = history.findIndex(h => h.date === dateStr);
    
    const newHistoryEntry: RoleHistory = {
        date: dateStr,
        assignments: data.currentAssignments.map((a) => ({
            studentId: a.studentId,
            roleId: a.roleId,
            isLocked: a.isLocked,
        }))
    };

    let newHistory = [...history];
    if (existingIdx > -1) {
        // Update existing month
        newHistory[existingIdx] = newHistoryEntry;
    } else {
        // Add new
        newHistory.push(newHistoryEntry);
    }
    
    // Sort descending by date (Newest first)
    newHistory.sort((a, b) => b.date.localeCompare(a.date));
    
    // Optional: Keep last 24 months
    if (newHistory.length > 24) newHistory = newHistory.slice(0, 24); 

    const newData = { ...data, history: newHistory };
    saveData(newData);
    return newData;
};

export const updateRoles = (data: RoleData, titles: string[]): RoleData => {
    const newRoles: RoleItem[] = titles.map(title => {
        const existing = data.roles.find(r => r.title === title);
        return existing ? existing : { id: generateUUID(), title };
    });

    const validRoleIds = new Set(newRoles.map(r => r.id));
    const newAssignments = data.currentAssignments.map(a => {
        if (a.roleId && !validRoleIds.has(a.roleId)) {
            return { ...a, roleId: null, isLocked: false };
        }
        return a;
    });

    const newData = { ...data, roles: newRoles, currentAssignments: newAssignments };
    saveData(newData);
    return newData;
};

export const updateStudents = (data: RoleData, names: string[]): RoleData => {
    const newStudents: RoleStudent[] = names.map(name => {
        const existing = data.students.find(s => s.name === name);
        return existing ? existing : { id: generateUUID(), name };
    });

    const validIds = new Set(newStudents.map(s => s.id));
    const newAssignments = newStudents.map(s => {
        const existing = data.currentAssignments.find(a => a.studentId === s.id);
        return existing ? existing : { studentId: s.id, roleId: null, isLocked: false };
    });

    const newData = { ...data, students: newStudents, currentAssignments: newAssignments };
    saveData(newData);
    return newData;
};

export const toggleLock = (data: RoleData, studentId: string): RoleData => {
    const newAssignments = data.currentAssignments.map(a => 
        a.studentId === studentId ? { ...a, isLocked: !a.isLocked } : a
    );
    const newData = { ...data, currentAssignments: newAssignments };
    saveData(newData);
    return newData;
}

export const manualAssign = (data: RoleData, studentId: string, roleId: string): RoleData => {
    const newAssignments = data.currentAssignments.map(a => 
        a.studentId === studentId ? { ...a, roleId, isLocked: true } : a
    );
    const newData = { ...data, currentAssignments: newAssignments };
    saveData(newData);
    return newData;
}

export const assignRoleByTitle = (data: RoleData, studentId: string, title: string): RoleData => {
    const trimmed = title.trim();
    if (!trimmed) return data;
    const existing = data.roles.find((r) => r.title === trimmed);
    const roleId = existing ? existing.id : generateUUID();
    const nextRoles = existing ? data.roles : [...data.roles, { id: roleId, title: trimmed }];
    const newAssignments = data.currentAssignments.map((a) =>
        a.studentId === studentId ? { ...a, roleId, isLocked: true } : a
    );
    const newData = { ...data, roles: nextRoles, currentAssignments: newAssignments };
    saveData(newData);
    return newData;
}
