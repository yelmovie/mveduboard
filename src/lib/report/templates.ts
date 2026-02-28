import { ReportPeriod, ReportSectionId } from './types';

type SummaryTemplateInput = {
  periodLabel: string;
  activeSections: string[];
  emptySections: string[];
  strongestHint?: string;
  weakestHint?: string;
  nextSteps: string[];
};

type SectionTemplateInput = {
  periodLabel: string;
  total: number;
  recent7: number;
  recent30: number;
  lastDateLabel?: string;
  extraLabel?: string;
  hasData: boolean;
  dataUnavailable?: boolean;
};

const summaryTemplates = {
  base: (input: SummaryTemplateInput) => [
    `데이터 기준으로 ${input.periodLabel} 동안의 학생 활동을 종합했습니다.`,
    input.activeSections.length > 0
      ? `활동 기록이 있는 영역은 ${input.activeSections.join(', ')}입니다.`
      : `현재 기록된 활동이 없는 영역이 많아 첫 기록 안내가 필요해 보입니다.`,
    input.emptySections.length > 0
      ? `기록이 비어 있는 영역은 ${input.emptySections.join(', ')}로 확인됩니다.`
      : `모든 선택 섹션에서 일정 수준의 기록이 확인됩니다.`,
    input.strongestHint
      ? `활동이 특히 두드러지는 부분은 ${input.strongestHint}입니다.`
      : `활동 강도가 높은 영역은 데이터 기준으로 추가 확인이 필요합니다.`,
    input.weakestHint
      ? `활동이 상대적으로 적은 부분은 ${input.weakestHint}로 보입니다.`
      : `활동이 적은 영역은 기록 기준으로 추가 지도 포인트가 될 수 있습니다.`,
    `다음 주 추천 목표는 ${input.nextSteps.join(', ')}입니다.`,
  ],
};

const sectionTemplates: Record<ReportSectionId, (input: SectionTemplateInput) => string[]> = {
  boardPosts: (input) => [
    `데이터 기준으로 ${input.periodLabel} 동안 게시판 활동은 총 ${input.total}건입니다.`,
    input.hasData
      ? `최근 7일 기준 ${input.recent7}건으로 활동 흐름을 확인했습니다.`
      : `최근 활동 기록이 없어 기능 미사용 가능성을 함께 확인해 주세요.`,
    input.lastDateLabel
      ? `마지막 활동일은 ${input.lastDateLabel}로 기록되어 있습니다.`
      : `현재 기록상 마지막 활동일을 확인할 수 없습니다.`,
    `다음 단계로 게시판 참여 목표를 짧게 안내해 주시면 도움이 됩니다.`,
  ],
  learningNotes: (input) => [
    `데이터 기준으로 ${input.periodLabel} 동안 배움 노트 작성은 총 ${input.total}회입니다.`,
    input.hasData
      ? `최근 30일 기준 ${input.recent30}회로 학습 기록의 지속성을 확인했습니다.`
      : `현재 기록이 없어 배움 노트 기능 안내가 필요할 수 있습니다.`,
    input.lastDateLabel
      ? `마지막 작성일은 ${input.lastDateLabel}로 확인됩니다.`
      : `작성 기록이 없어 최근 작성일을 확인할 수 없습니다.`,
    `배움 노트는 학습 정리에 도움이 되니 기록 습관을 제안해 보세요.`,
  ],
  todoRecords: (input) => [
    `데이터 기준으로 ${input.periodLabel} 동안 할일 체크 기록을 집계했습니다.`,
    input.hasData
      ? `최근 7일 기준 체크 기록은 ${input.recent7}건입니다.`
      : `체크 기록이 없어 기능 미사용 가능성을 고려해 주세요.`,
    input.lastDateLabel
      ? `마지막 체크일은 ${input.lastDateLabel}로 확인됩니다.`
      : `기록상 최근 체크일을 확인할 수 없습니다.`,
    `완료율 향상을 위해 작은 목표부터 안내해 주세요.`,
  ],
  points: (input) => [
    `데이터 기준으로 ${input.periodLabel} 동안 포인트 활동 기록을 확인했습니다.`,
    input.hasData
      ? `최근 30일 기준 포인트 변화가 기록되어 있습니다.`
      : `포인트 기록이 없어 활동 집계가 제한됩니다.`,
    input.lastDateLabel
      ? `마지막 포인트 변동일은 ${input.lastDateLabel}입니다.`
      : `최근 변동 기록이 확인되지 않습니다.`,
    `포인트 규칙 안내와 목표 설정을 함께 제안해 주세요.`,
  ],
  messages: (input) => [
    `데이터 기준으로 ${input.periodLabel} 동안 쪽지 활동을 요약했습니다.`,
    input.hasData
      ? `최근 7일 기준 쪽지 기록은 ${input.recent7}건입니다.`
      : `쪽지 기록이 없어 소통 채널 안내가 필요해 보입니다.`,
    input.lastDateLabel
      ? `최근 쪽지 활동일은 ${input.lastDateLabel}입니다.`
      : `최근 쪽지 활동일을 확인할 수 없습니다.`,
    `필요 시 교사-학생 소통 목표를 제안해 주세요.`,
  ],
  writing: (input) => [
    `데이터 기준으로 ${input.periodLabel} 동안 주제글쓰기 기록은 ${input.total}건입니다.`,
    input.hasData
      ? `최근 7일 기준 ${input.recent7}건으로 활동 흐름을 확인했습니다.`
      : `주제글쓰기 기록이 없어 첫 기록 안내가 필요할 수 있습니다.`,
    input.lastDateLabel
      ? `마지막 작성일은 ${input.lastDateLabel}입니다.`
      : `최근 작성일이 확인되지 않습니다.`,
    `다음 글쓰기 목표를 간단히 제시해 주세요.`,
  ],
  math: (input) => [
    `데이터 기준으로 ${input.periodLabel} 동안 오답노트 기록을 요약했습니다.`,
    input.hasData
      ? `최근 30일 기준 ${input.recent30}건으로 복습 기록을 확인했습니다.`
      : `오답노트 기록이 없어 기능 안내가 필요할 수 있습니다.`,
    input.lastDateLabel
      ? `마지막 오답노트 작성일은 ${input.lastDateLabel}입니다.`
      : `최근 작성일이 확인되지 않습니다.`,
    `오답 유형 정리를 함께 안내해 주세요.`,
  ],
  omr: (input) => [
    `데이터 기준으로 ${input.periodLabel} 동안 OMR 활동 기록을 확인했습니다.`,
    input.hasData
      ? `최근 30일 기준 ${input.recent30}회 제출 기록이 있습니다.`
      : `OMR 기록이 없어 처음 참여를 안내해 주세요.`,
    input.lastDateLabel
      ? `마지막 제출일은 ${input.lastDateLabel}입니다.`
      : `최근 제출일이 확인되지 않습니다.`,
    `OMR 복습 루틴을 제안해 주세요.`,
  ],
  reading: (input) => [
    `데이터 기준으로 ${input.periodLabel} 동안 독서록 기록은 ${input.total}건입니다.`,
    input.hasData
      ? `최근 7일 기준 ${input.recent7}건으로 독서 활동 흐름을 확인했습니다.`
      : `독서록 기록이 없어 첫 기록 안내가 필요합니다.`,
    input.lastDateLabel
      ? `마지막 작성일은 ${input.lastDateLabel}입니다.`
      : `최근 작성일이 확인되지 않습니다.`,
    `독서록 작성 주기를 함께 정해 주세요.`,
  ],
  schedule: (input) => [
    `데이터 기준으로 ${input.periodLabel} 동안 스케줄 기록을 요약했습니다.`,
    input.hasData
      ? `최근 7일 기준 ${input.recent7}건의 일정 기록이 있습니다.`
      : `스케줄 기록이 없어 기능 안내가 필요할 수 있습니다.`,
    input.lastDateLabel
      ? `마지막 일정 기록일은 ${input.lastDateLabel}입니다.`
      : `최근 기록일이 확인되지 않습니다.`,
    `주간 계획 점검을 함께 제안해 주세요.`,
  ],
};

const periodLabels: Record<ReportPeriod, string> = {
  year: '학년도 전체',
  last30: '최근 30일',
  last7: '최근 7일',
};

export const getPeriodLabel = (period: ReportPeriod) => periodLabels[period];

export const buildSummaryTemplate = (input: SummaryTemplateInput) => summaryTemplates.base(input);

export const buildSectionTemplate = (sectionId: ReportSectionId, input: SectionTemplateInput) =>
  sectionTemplates[sectionId](input);
