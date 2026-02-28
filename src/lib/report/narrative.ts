import { generateText, getOpenAIApiKey } from '../../../services/openaiClient';
import { ReportNarratives, ReportPeriod, ReportSectionId } from './types';
import { buildSummaryTemplate, buildSectionTemplate, getPeriodLabel } from './templates';
import {
  BoardMetrics,
  MessagesMetrics,
  OmrMetrics,
  PointsMetrics,
  ScheduleMetrics,
  TodoMetrics,
} from './metrics';

type SectionInput = {
  id: ReportSectionId;
  label: string;
  metrics: {
    total: number;
    recent7: number;
    recent30: number;
    lastDateLabel?: string;
  };
  stats: { label: string; value: string }[];
  highlights: { label: string; value: string }[];
  dataUnavailable?: boolean;
};

const buildSummary = (period: ReportPeriod, sections: SectionInput[]) => {
  const activeSections = sections.filter((s) => s.metrics.total > 0).map((s) => s.label);
  const emptySections = sections.filter((s) => s.metrics.total === 0).map((s) => s.label);
  const strongest = sections.sort((a, b) => b.metrics.total - a.metrics.total)[0];
  const weakest = sections.sort((a, b) => a.metrics.total - b.metrics.total)[0];
  const nextSteps = [
    activeSections[0] ? `${activeSections[0]} 지속` : '첫 기록 만들기',
    emptySections[0] ? `${emptySections[0]} 시작` : '활동 균형 맞추기',
  ].filter(Boolean);

  return buildSummaryTemplate({
    periodLabel: getPeriodLabel(period),
    activeSections,
    emptySections,
    strongestHint: strongest?.label,
    weakestHint: weakest?.label,
    nextSteps,
  });
};

const formatSectionNarrative = (period: ReportPeriod, input: SectionInput) => ({
  paragraphs: buildSectionTemplate(input.id, {
    periodLabel: getPeriodLabel(period),
    total: input.metrics.total,
    recent7: input.metrics.recent7,
    recent30: input.metrics.recent30,
    lastDateLabel: input.metrics.lastDateLabel,
    hasData: input.metrics.total > 0,
    dataUnavailable: input.dataUnavailable,
  }),
  stats: input.stats,
  highlights: input.highlights,
  note: input.dataUnavailable ? '해당 데이터는 아직 수집되지 않음' : undefined,
});

const tryRewrite = async (text: string) => {
  if (!getOpenAIApiKey()) return text;
  try {
    return await generateText(
      `아래 내용을 교사용 서술형 문장으로 자연스럽게 정리해줘. 단정하지 말고 "기록 기준" 표현을 유지해줘.\n\n${text}`,
      { temperature: 0.2, maxTokens: 200 }
    );
  } catch {
    return text;
  }
};

export const buildNarratives = async (
  period: ReportPeriod,
  sections: SectionInput[]
): Promise<ReportNarratives> => {
  const summaryBase = buildSummary(period, sections).join(' ');
  const summary = (await tryRewrite(summaryBase)).split(/\n+/).filter(Boolean);

  const narratives: ReportNarratives = {
    summary,
    sections: {},
  };

  for (const section of sections) {
    const baseParagraphs = formatSectionNarrative(period, section).paragraphs.join(' ');
    const rewritten = await tryRewrite(baseParagraphs);
    narratives.sections[section.id] = {
      ...formatSectionNarrative(period, section),
      paragraphs: rewritten.split(/\n+/).filter(Boolean),
    };
  }

  return narratives;
};

export const buildSectionInputs = (
  period: ReportPeriod,
  data: {
    boardPosts: BoardMetrics;
    learningNotes: BoardMetrics;
    todoRecords: TodoMetrics;
    points: PointsMetrics;
    messages: MessagesMetrics;
    writing: BoardMetrics;
    math: BoardMetrics;
    omr: OmrMetrics;
    reading: BoardMetrics;
    schedule: ScheduleMetrics;
  },
  dataAvailability: Partial<Record<ReportSectionId, boolean>>
): SectionInput[] => {
  return [
    {
      id: 'boardPosts',
      label: '게시판 활동',
      metrics: {
        total: data.boardPosts.total,
        recent7: data.boardPosts.recent7,
        recent30: data.boardPosts.recent30,
        lastDateLabel: data.boardPosts.lastDateLabel,
      },
      stats: [
        { label: '총 게시물', value: `${data.boardPosts.total}개` },
        { label: '최근 7일', value: `${data.boardPosts.recent7}개` },
        { label: '최근 30일', value: `${data.boardPosts.recent30}개` },
        { label: '평균 글자수', value: `${data.boardPosts.avgLength ?? 0}자` },
        { label: '첨부 포함', value: `${data.boardPosts.attachmentCount ?? 0}건` },
        { label: '최근 활동일', value: data.boardPosts.lastDateLabel ?? '기록 없음' },
      ],
      highlights: data.boardPosts.byCategory?.slice(0, 3).map((item) => ({
        label: '카테고리',
        value: `${item.category} ${item.count}건`,
      })) || [],
      dataUnavailable: dataAvailability.boardPosts === false,
    },
    {
      id: 'learningNotes',
      label: '배움 노트',
      metrics: {
        total: data.learningNotes.total,
        recent7: data.learningNotes.recent7,
        recent30: data.learningNotes.recent30,
        lastDateLabel: data.learningNotes.lastDateLabel,
      },
      stats: [
        { label: '총 작성', value: `${data.learningNotes.total}회` },
        { label: '최근 7일', value: `${data.learningNotes.recent7}회` },
        { label: '최근 30일', value: `${data.learningNotes.recent30}회` },
        { label: '평균 글자수', value: `${data.learningNotes.avgLength ?? 0}자` },
        { label: '최근 작성일', value: data.learningNotes.lastDateLabel ?? '기록 없음' },
      ],
      highlights: data.learningNotes.byCategory?.slice(0, 2).map((item) => ({
        label: '유형',
        value: `${item.category} ${item.count}회`,
      })) || [],
      dataUnavailable: dataAvailability.learningNotes === false,
    },
    {
      id: 'todoRecords',
      label: '할일 체크',
      metrics: {
        total: data.todoRecords.totalCompleted + data.todoRecords.totalIncomplete,
        recent7: data.todoRecords.recent7,
        recent30: data.todoRecords.recent30,
        lastDateLabel: data.todoRecords.lastDateLabel,
      },
      stats: [
        { label: '완료', value: `${data.todoRecords.totalCompleted}건` },
        { label: '미완료', value: `${data.todoRecords.totalIncomplete}건` },
        { label: '완료율', value: `${data.todoRecords.completionRate}%` },
        { label: '최근 7일', value: `${data.todoRecords.recent7}건` },
        { label: '최근 체크일', value: data.todoRecords.lastDateLabel ?? '기록 없음' },
      ],
      highlights: [
        { label: '완료율', value: `${data.todoRecords.completionRate}%` },
      ],
      dataUnavailable: dataAvailability.todoRecords === false,
    },
    {
      id: 'points',
      label: '포인트 활동',
      metrics: {
        total: data.points.totalEarned + data.points.totalDeducted,
        recent7: 0,
        recent30: 0,
        lastDateLabel: data.points.lastDateLabel,
      },
      stats: [
        { label: '현재 포인트', value: `${data.points.currentPoints}점` },
        { label: '총 획득', value: `${data.points.totalEarned}점` },
        { label: '총 차감', value: `${data.points.totalDeducted}점` },
        { label: '최근 30일 변화', value: `${data.points.recentDelta}점` },
        { label: '최근 변동일', value: data.points.lastDateLabel ?? '기록 없음' },
      ],
      highlights: [
        { label: '최근 30일 변화', value: `${data.points.recentDelta}점` },
      ],
      dataUnavailable: dataAvailability.points === false,
    },
    {
      id: 'messages',
      label: '쪽지 활동',
      metrics: {
        total: data.messages.sent + data.messages.received,
        recent7: data.messages.recent7,
        recent30: data.messages.recent30,
        lastDateLabel: data.messages.lastDateLabel,
      },
      stats: [
        { label: '보낸 쪽지', value: `${data.messages.sent}건` },
        { label: '받은 쪽지', value: `${data.messages.received}건` },
        { label: '최근 7일', value: `${data.messages.recent7}건` },
        { label: '최근 30일', value: `${data.messages.recent30}건` },
        { label: '최근 수신일', value: data.messages.lastDateLabel ?? '기록 없음' },
      ],
      highlights: data.messages.partnerCount
        ? [{ label: '소통 상대 수', value: `${data.messages.partnerCount}명` }]
        : [],
      dataUnavailable: dataAvailability.messages === false,
    },
    {
      id: 'writing',
      label: '주제글쓰기',
      metrics: {
        total: data.writing.total,
        recent7: data.writing.recent7,
        recent30: data.writing.recent30,
        lastDateLabel: data.writing.lastDateLabel,
      },
      stats: [
        { label: '총 작성', value: `${data.writing.total}건` },
        { label: '최근 7일', value: `${data.writing.recent7}건` },
        { label: '최근 30일', value: `${data.writing.recent30}건` },
        { label: '평균 글자수', value: `${data.writing.avgLength ?? 0}자` },
        { label: '최근 작성일', value: data.writing.lastDateLabel ?? '기록 없음' },
      ],
      highlights: data.writing.byCategory?.slice(0, 2).map((item) => ({
        label: '월별',
        value: `${item.category} ${item.count}건`,
      })) || [],
      dataUnavailable: dataAvailability.writing === false,
    },
    {
      id: 'math',
      label: '오답노트',
      metrics: {
        total: data.math.total,
        recent7: data.math.recent7,
        recent30: data.math.recent30,
        lastDateLabel: data.math.lastDateLabel,
      },
      stats: [
        { label: '총 기록', value: `${data.math.total}건` },
        { label: '최근 7일', value: `${data.math.recent7}건` },
        { label: '최근 30일', value: `${data.math.recent30}건` },
        { label: '평균 글자수', value: `${data.math.avgLength ?? 0}자` },
        { label: '최근 작성일', value: data.math.lastDateLabel ?? '기록 없음' },
      ],
      highlights: data.math.byCategory?.slice(0, 2).map((item) => ({
        label: '단원',
        value: `${item.category} ${item.count}건`,
      })) || [],
      dataUnavailable: dataAvailability.math === false,
    },
    {
      id: 'omr',
      label: 'OMR',
      metrics: {
        total: data.omr.totalTests,
        recent7: data.omr.recent7,
        recent30: data.omr.recent30,
        lastDateLabel: data.omr.lastDateLabel,
      },
      stats: [
        { label: '총 테스트', value: `${data.omr.totalTests}회` },
        { label: '총 문항', value: `${data.omr.totalQuestions}문항` },
        { label: '정확도', value: `${data.omr.overallAccuracy}%` },
        { label: '최근 30일', value: `${data.omr.recent30}회` },
        { label: '최근 제출일', value: data.omr.lastDateLabel ?? '기록 없음' },
      ],
      highlights: data.omr.hardestQuestions.slice(0, 3).map((item) => ({
        label: '오답률 높은 문항',
        value: item,
      })),
      dataUnavailable: dataAvailability.omr === false,
    },
    {
      id: 'reading',
      label: '독서록',
      metrics: {
        total: data.reading.total,
        recent7: data.reading.recent7,
        recent30: data.reading.recent30,
        lastDateLabel: data.reading.lastDateLabel,
      },
      stats: [
        { label: '총 기록', value: `${data.reading.total}건` },
        { label: '최근 7일', value: `${data.reading.recent7}건` },
        { label: '최근 30일', value: `${data.reading.recent30}건` },
        { label: '평균 글자수', value: `${data.reading.avgLength ?? 0}자` },
        { label: '최근 작성일', value: data.reading.lastDateLabel ?? '기록 없음' },
      ],
      highlights: data.reading.byCategory?.slice(0, 2).map((item) => ({
        label: '월별',
        value: `${item.category} ${item.count}건`,
      })) || [],
      dataUnavailable: dataAvailability.reading === false,
    },
    {
      id: 'schedule',
      label: '스케줄',
      metrics: {
        total: data.schedule.totalTasks,
        recent7: data.schedule.recent7,
        recent30: data.schedule.recent30,
        lastDateLabel: data.schedule.lastDateLabel,
      },
      stats: [
        { label: '총 일정', value: `${data.schedule.totalTasks}건` },
        { label: '완료', value: `${data.schedule.completedCount}건` },
        { label: '완료율', value: `${data.schedule.completionRate}%` },
        { label: '미완료/지연', value: `${data.schedule.overdueCount}건` },
        { label: '최근 일정일', value: data.schedule.lastDateLabel ?? '기록 없음' },
      ],
      highlights: data.schedule.busiestDayLabel
        ? [{ label: '활동 많은 요일', value: data.schedule.busiestDayLabel }]
        : [],
      dataUnavailable: dataAvailability.schedule === false,
    },
  ];
};
