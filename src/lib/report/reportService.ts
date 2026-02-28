import * as boardService from '../../../services/boardService';
import * as todoService from '../../../services/todoService';
import * as pointService from '../../../services/pointService';
import * as messageService from '../../../services/messageService';
import * as studentService from '../../../services/studentService';
import * as scheduleService from '../../../services/scheduleService';
import { supabase } from '../supabase/client';
import { Post, TodoRecord } from '../../../types';
import {
  buildBoardMetrics,
  buildMessagesMetrics,
  buildOmrMetrics,
  buildPointsMetrics,
  buildRange,
  buildScheduleMetrics,
  buildTodoMetrics,
  BoardMetrics,
  MessagesMetrics,
  OmrMetrics,
  PointsMetrics,
  ScheduleMetrics,
  TodoMetrics,
} from './metrics';
import { buildNarratives, buildSectionInputs } from './narrative';
import { ReportPeriod, ReportSectionId, StudentReportViewData } from './types';

/**
 * 특정 년도의 학생 리포트 데이터를 수집합니다.
 */
export const collectStudentReportData = async (
  studentId: string,
  year: number,
  period: ReportPeriod = 'year'
): Promise<StudentReportViewData> => {
  const roster = await studentService.fetchRosterFromDb();
  const student = roster.find((s) => s.id === studentId);
  if (!student) {
    throw new Error('학생을 찾을 수 없습니다.');
  }

  const range = buildRange(period, year);
  const dataAvailability: Partial<Record<ReportSectionId, boolean>> = {
    boardPosts: true,
    learningNotes: true,
    todoRecords: true,
    points: true,
    messages: true,
    writing: true,
    math: true,
    omr: true,
    reading: true,
    schedule: true,
  };

  const logUnavailable = (section: ReportSectionId, message: string) => {
    if (!import.meta.env.DEV) return;
    console.warn(`[report] ${section} 데이터 미사용/미수집:`, message);
  };

  const monthLabel = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

  let boardPosts: BoardMetrics = {
    total: 0,
    recent7: 0,
    recent30: 0,
  };
  let learningNotes: BoardMetrics = {
    total: 0,
    recent7: 0,
    recent30: 0,
  };
  let writing: BoardMetrics = {
    total: 0,
    recent7: 0,
    recent30: 0,
  };
  let reading: BoardMetrics = {
    total: 0,
    recent7: 0,
    recent30: 0,
  };
  let math: BoardMetrics = {
    total: 0,
    recent7: 0,
    recent30: 0,
  };
  let todoRecords: TodoMetrics = {
    totalCompleted: 0,
    totalIncomplete: 0,
    completionRate: 0,
    recent7: 0,
    recent30: 0,
  };
  let points: PointsMetrics = {
    currentPoints: 0,
    totalEarned: 0,
    totalDeducted: 0,
    recentDelta: 0,
  };
  let messages: MessagesMetrics = {
    sent: 0,
    received: 0,
    recent7: 0,
    recent30: 0,
  };
  let omr: OmrMetrics = {
    totalTests: 0,
    totalQuestions: 0,
    overallAccuracy: 0,
    recent7: 0,
    recent30: 0,
    hardestQuestions: [],
  };
  let schedule: ScheduleMetrics = {
    totalTasks: 0,
    completedCount: 0,
    completionRate: 0,
    overdueCount: 0,
    recent7: 0,
    recent30: 0,
  };

  try {
    const categories = ['board', 'gallery', 'writing', 'reading', 'math', 'learning'];
    const allPosts: Post[] = [];
    for (const category of categories) {
      const posts = await boardService.getPosts(category);
      const studentPosts = posts.filter((p) => p.author_participant_id === studentId);
      allPosts.push(...studentPosts);
    }
    boardPosts = buildBoardMetrics(allPosts, range, (post) => post.board_id);
    boardPosts.commentCount = 0;
    for (const post of allPosts) {
      try {
        const comments = await boardService.getComments(post.id);
        boardPosts.commentCount = (boardPosts.commentCount || 0) + comments.length;
      } catch {
        // ignore per-post comment failures
      }
    }
  } catch (error) {
    dataAvailability.boardPosts = false;
    logUnavailable('boardPosts', String(error));
  }

  try {
    const learningPosts = await boardService.getPosts('learning');
    const studentLearning = learningPosts.filter((p) => p.author_participant_id === studentId);
    learningNotes = buildBoardMetrics(studentLearning, range);
  } catch (error) {
    dataAvailability.learningNotes = false;
    logUnavailable('learningNotes', String(error));
  }

  try {
    const writingPosts = await boardService.getPosts('writing');
    const studentWriting = writingPosts.filter((p) => p.author_participant_id === studentId);
    writing = buildBoardMetrics(studentWriting, range, (post) => monthLabel(new Date(post.created_at)));
  } catch (error) {
    dataAvailability.writing = false;
    logUnavailable('writing', String(error));
  }

  try {
    const readingPosts = await boardService.getPosts('reading');
    const studentReading = readingPosts.filter((p) => p.author_participant_id === studentId);
    reading = buildBoardMetrics(studentReading, range, (post) => monthLabel(new Date(post.created_at)));
  } catch (error) {
    dataAvailability.reading = false;
    logUnavailable('reading', String(error));
  }

  try {
    const mathPosts = await boardService.getPosts('math');
    const studentMath = mathPosts.filter((p) => p.author_participant_id === studentId);
    math = buildBoardMetrics(studentMath, range, (post) => post.math_page_range || '미분류');
  } catch (error) {
    dataAvailability.math = false;
    logUnavailable('math', String(error));
  }

  try {
    const allRecords: TodoRecord[] = [];
    const cursor = new Date(range.start);
    const end = new Date(range.end);
    while (cursor <= end) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const dateStr = cursor.toISOString().split('T')[0];
      const tasks = todoService.getTasks(dateStr);
      tasks.forEach((task) => {
        const records = todoService.getRecords(task.id);
        allRecords.push(...records.filter((r) => r.student_id === studentId));
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    todoRecords = buildTodoMetrics(allRecords, range);
  } catch (error) {
    dataAvailability.todoRecords = false;
    logUnavailable('todoRecords', String(error));
  }

  try {
    const currentPoints = pointService.getStudents().find((s) => s.id === studentId)?.points || 0;
    const historiesStr = localStorage.getItem('edu_point_histories');
    const histories = historiesStr ? JSON.parse(historiesStr) : [];
    const studentHistories = histories
      .filter((h: any) => h.studentIds && h.studentIds.includes(studentId))
      .map((h: any) => ({ amount: h.amount, timestamp: h.timestamp }));
    points = buildPointsMetrics(currentPoints, studentHistories);
  } catch (error) {
    dataAvailability.points = false;
    logUnavailable('points', String(error));
  }

  try {
    const allMessages = messageService.getAllMessages();
    const studentMessages = allMessages.filter((m) => m.studentName.includes(student.name));
    messages = buildMessagesMetrics(studentMessages);
  } catch (error) {
    dataAvailability.messages = false;
    logUnavailable('messages', String(error));
  }

  try {
    if (!supabase) {
      dataAvailability.omr = false;
      logUnavailable('omr', 'Supabase 설정 없음');
    } else {
      const { data, error } = await supabase
        .from('omr_attempts')
        .select('created_at, correct_count, wrong_count')
        .eq('user_id', studentId);
      if (error) {
        dataAvailability.omr = false;
        logUnavailable('omr', error.message);
      } else {
        omr = buildOmrMetrics((data || []) as any[], range);
      }
    }
  } catch (error) {
    dataAvailability.omr = false;
    logUnavailable('omr', String(error));
  }

  try {
    const schedules = scheduleService
      .getAllSchedules()
      .filter((s) => s.studentId === studentId);
    schedule = buildScheduleMetrics(schedules, range);
  } catch (error) {
    dataAvailability.schedule = false;
    logUnavailable('schedule', String(error));
  }

  const sectionInputs = buildSectionInputs(period, {
    boardPosts,
    learningNotes,
    todoRecords,
    points,
    messages,
    writing,
    math,
    omr,
    reading,
    schedule,
  }, dataAvailability);

  const narratives = await buildNarratives(period, sectionInputs);

  if (import.meta.env.DEV) {
    console.group(`[report] ${student.name} (${student.id}) ${range.label} 집계 결과`);
    sectionInputs.forEach((section) => {
      console.log(section.id, {
        total: section.metrics.total,
        recent7: section.metrics.recent7,
        recent30: section.metrics.recent30,
        lastDate: section.metrics.lastDateLabel ?? '기록 없음',
        dataUnavailable: section.dataUnavailable ?? false,
      });
    });
    console.groupEnd();
  }

  return {
    student,
    year,
    period,
    range,
    narratives,
  };
};

/**
 * 학급의 모든 학생 리포트 데이터를 수집합니다.
 */
export const collectAllStudentsReportData = async (
  year: number,
  period: ReportPeriod = 'year'
): Promise<StudentReportViewData[]> => {
  const roster = await studentService.fetchRosterFromDb();
  const reports: StudentReportViewData[] = [];

  for (const student of roster) {
    try {
      const report = await collectStudentReportData(student.id, year, period);
      reports.push(report);
    } catch (error) {
      console.error(`학생 ${student.name} 리포트 수집 실패:`, error);
    }
  }

  return reports;
};
