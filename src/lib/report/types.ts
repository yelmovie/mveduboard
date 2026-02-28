import { ClassStudent } from '../../../types';

export type ReportPeriod = 'year' | 'last30' | 'last7';

export type ReportSectionId =
  | 'boardPosts'
  | 'learningNotes'
  | 'todoRecords'
  | 'points'
  | 'messages'
  | 'writing'
  | 'math'
  | 'omr'
  | 'reading'
  | 'schedule';

export type ReportRange = {
  label: string;
  start: Date;
  end: Date;
};

export type SectionStatItem = {
  label: string;
  value: string;
};

export type SectionHighlight = {
  label: string;
  value: string;
};

export type SectionNarrative = {
  paragraphs: string[];
  stats: SectionStatItem[];
  highlights: SectionHighlight[];
  note?: string;
};

export type ReportNarratives = {
  summary: string[];
  sections: Partial<Record<ReportSectionId, SectionNarrative>>;
};

export type StudentReportViewData = {
  student: ClassStudent;
  year: number;
  period: ReportPeriod;
  range: ReportRange;
  narratives: ReportNarratives;
};
