import { Post, TodoRecord } from '../../../types';
import { ScheduleItem } from '../../../types';
import { ReportPeriod, ReportRange } from './types';

export type BoardMetrics = {
  total: number;
  recent7: number;
  recent30: number;
  lastDateLabel?: string;
  avgLength?: number;
  byCategory?: { category: string; count: number }[];
  attachmentCount?: number;
  commentCount?: number;
};

export type TodoMetrics = {
  totalCompleted: number;
  totalIncomplete: number;
  completionRate: number;
  recent7: number;
  recent30: number;
  lastDateLabel?: string;
};

export type PointsMetrics = {
  currentPoints: number;
  totalEarned: number;
  totalDeducted: number;
  recentDelta: number;
  lastDateLabel?: string;
};

export type MessagesMetrics = {
  sent: number;
  received: number;
  recent7: number;
  recent30: number;
  lastDateLabel?: string;
  partnerCount?: number;
};

export type OmrMetrics = {
  totalTests: number;
  totalQuestions: number;
  overallAccuracy: number;
  recent7: number;
  recent30: number;
  lastDateLabel?: string;
  hardestQuestions: string[];
  improvementAfterRetry?: string;
};

export type ScheduleMetrics = {
  totalTasks: number;
  completedCount: number;
  completionRate: number;
  overdueCount: number;
  recent7: number;
  recent30: number;
  busiestDayLabel?: string;
  lastDateLabel?: string;
};

export const buildRange = (period: ReportPeriod, year: number): ReportRange => {
  const now = new Date();
  if (period === 'last30') {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    return { label: '최근 30일', start, end: now };
  }
  if (period === 'last7') {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { label: '최근 7일', start, end: now };
  }
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31, 23, 59, 59);
  return { label: `${year}학년도`, start, end };
};

const withinRange = (date: Date, range: ReportRange) =>
  date >= range.start && date <= range.end;

const formatDateLabel = (value?: string | Date) => {
  if (!value) return undefined;
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString('ko-KR');
};

const getRecentCount = (dates: Date[], days: number) => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (days - 1));
  cutoff.setHours(0, 0, 0, 0);
  return dates.filter((d) => d >= cutoff).length;
};

export const buildBoardMetrics = (
  posts: Post[],
  range: ReportRange,
  groupBy?: (post: Post) => string
): BoardMetrics => {
  const filtered = posts.filter((p) => withinRange(new Date(p.created_at), range));
  const dates = filtered.map((p) => new Date(p.created_at));
  const totalLength = filtered.reduce((sum, p) => sum + (p.body?.length || 0), 0);
  const attachmentCount = filtered.filter((p) => p.attachment_url || p.attachment_urls?.length).length;
  const byCategory: Record<string, number> = {};
  filtered.forEach((p) => {
    const key = groupBy ? groupBy(p) : p.board_id;
    byCategory[key] = (byCategory[key] || 0) + 1;
  });
  const lastDate = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : undefined;
  return {
    total: filtered.length,
    recent7: getRecentCount(dates, 7),
    recent30: getRecentCount(dates, 30),
    lastDateLabel: formatDateLabel(lastDate),
    avgLength: filtered.length ? Math.round(totalLength / filtered.length) : 0,
    byCategory: Object.entries(byCategory).map(([category, count]) => ({ category, count })),
    attachmentCount,
  };
};

export const buildTodoMetrics = (records: TodoRecord[], range: ReportRange): TodoMetrics => {
  const filtered = records.filter((r) => withinRange(new Date(r.updated_at), range));
  const dates = filtered.map((r) => new Date(r.updated_at));
  const completed = filtered.filter((r) => r.status === 'complete').length;
  const incomplete = filtered.filter((r) => r.status === 'incomplete').length;
  const total = completed + incomplete;
  const lastDate = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : undefined;
  return {
    totalCompleted: completed,
    totalIncomplete: incomplete,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    recent7: getRecentCount(dates, 7),
    recent30: getRecentCount(dates, 30),
    lastDateLabel: formatDateLabel(lastDate),
  };
};

export const buildPointsMetrics = (
  currentPoints: number,
  histories: { amount: number; timestamp: number }[]
): PointsMetrics => {
  const totalEarned = histories.filter((h) => h.amount > 0).reduce((sum, h) => sum + h.amount, 0);
  const totalDeducted = Math.abs(histories.filter((h) => h.amount < 0).reduce((sum, h) => sum + h.amount, 0));
  const recentCutoff = new Date();
  recentCutoff.setDate(recentCutoff.getDate() - 29);
  const recentDelta = histories
    .filter((h) => new Date(h.timestamp) >= recentCutoff)
    .reduce((sum, h) => sum + h.amount, 0);
  const lastTimestamp = histories.length > 0 ? Math.max(...histories.map((h) => h.timestamp)) : undefined;
  return {
    currentPoints,
    totalEarned,
    totalDeducted,
    recentDelta,
    lastDateLabel: formatDateLabel(lastTimestamp ? new Date(lastTimestamp) : undefined),
  };
};

export const buildMessagesMetrics = (
  messages: { sender: string; timestamp: number; studentName: string }[]
): MessagesMetrics => {
  const sent = messages.filter((m) => m.sender === 'student').length;
  const received = messages.filter((m) => m.sender === 'teacher').length;
  const dates = messages.map((m) => new Date(m.timestamp));
  const lastDate = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : undefined;
  const partnerCount = new Set(messages.map((m) => m.studentName)).size;
  return {
    sent,
    received,
    recent7: getRecentCount(dates, 7),
    recent30: getRecentCount(dates, 30),
    lastDateLabel: formatDateLabel(lastDate),
    partnerCount,
  };
};

export const buildOmrMetrics = (
  attempts: { created_at: string; correct_count: number; wrong_count: number }[],
  range: ReportRange
): OmrMetrics => {
  const filtered = attempts.filter((a) => withinRange(new Date(a.created_at), range));
  const dates = filtered.map((a) => new Date(a.created_at));
  const totalTests = filtered.length;
  const totalQuestions = filtered.reduce((sum, a) => sum + a.correct_count + a.wrong_count, 0);
  const totalCorrect = filtered.reduce((sum, a) => sum + a.correct_count, 0);
  const overallAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  const lastDate = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : undefined;
  return {
    totalTests,
    totalQuestions,
    overallAccuracy,
    recent7: getRecentCount(dates, 7),
    recent30: getRecentCount(dates, 30),
    lastDateLabel: formatDateLabel(lastDate),
    hardestQuestions: [],
  };
};

export const buildScheduleMetrics = (
  schedules: ScheduleItem[],
  range: ReportRange
): ScheduleMetrics => {
  const filtered = schedules.filter((s) => withinRange(new Date(s.date), range));
  const dates = filtered.map((s) => new Date(s.date));
  const completedCount = filtered.filter((s) => s.isCompleted).length;
  const overdueCount = filtered.filter((s) => {
    const date = new Date(s.date);
    return !s.isCompleted && date < new Date();
  }).length;
  const totalTasks = filtered.length;
  const completionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
  const dayCounts: Record<string, number> = {};
  filtered.forEach((s) => {
    const day = new Date(s.date).toLocaleDateString('ko-KR', { weekday: 'long' });
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  });
  const busiestDayLabel =
    Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || undefined;
  const lastDate = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : undefined;
  return {
    totalTasks,
    completedCount,
    completionRate,
    overdueCount,
    recent7: getRecentCount(dates, 7),
    recent30: getRecentCount(dates, 30),
    busiestDayLabel,
    lastDateLabel: formatDateLabel(lastDate),
  };
};

export const getPeriodLabel = (period: ReportPeriod, range: ReportRange) =>
  period === 'year' ? range.label : range.label;
