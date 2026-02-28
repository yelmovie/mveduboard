import React from 'react';
import { ReportSectionId, StudentReportViewData } from '../src/lib/report/types';

type SectionConfig = {
  id: ReportSectionId;
  name: string;
};

interface StudentReportPdfViewProps {
  data: StudentReportViewData;
  sections: SectionConfig[];
  enabledSectionIds: Set<ReportSectionId>;
}

const Page: React.FC<{ children: React.ReactNode; isLast?: boolean }> = ({ children, isLast }) => (
  <div
    className="w-full bg-white text-gray-900 px-10 py-8"
    style={{
      minHeight: 1123,
      pageBreakAfter: isLast ? 'auto' : 'always',
    }}
  >
    {children}
  </div>
);

const SectionTable: React.FC<{ stats: { label: string; value: string }[] }> = ({ stats }) => (
  <div className="grid grid-cols-2 gap-2 text-sm border border-gray-200 rounded-lg p-3 bg-gray-50">
    {stats.map((item) => (
      <div key={item.label} className="flex items-center justify-between">
        <span className="text-gray-600">{item.label}</span>
        <span className="font-bold text-gray-900">{item.value}</span>
      </div>
    ))}
  </div>
);

const Highlights: React.FC<{ items: { label: string; value: string }[] }> = ({ items }) => {
  if (items.length === 0) return null;
  return (
    <div className="mt-3 space-y-1 text-sm">
      <div className="font-bold text-gray-800">하이라이트</div>
      {items.map((item, idx) => (
        <div key={`${item.label}-${idx}`} className="text-gray-700">
          • {item.label}: {item.value}
        </div>
      ))}
    </div>
  );
};

export const StudentReportPdfView: React.FC<StudentReportPdfViewProps> = ({
  data,
  sections,
  enabledSectionIds,
}) => {
  const sectionNarratives = data.narratives.sections;
  const enabledSections = sections.filter((s) => enabledSectionIds.has(s.id));

  return (
    <div className="w-[794px] bg-white text-gray-900" style={{ fontFamily: 'Noto Sans KR, sans-serif' }}>
      <Page>
        <div className="text-2xl font-bold mb-2">{data.year}학년도 학생 활동 리포트</div>
        <div className="text-base text-gray-700 mb-1">학생: {data.student.number}. {data.student.name}</div>
        <div className="text-sm text-gray-500 mb-6">기간: {data.range.label}</div>

        <div className="border-t border-gray-200 pt-4 space-y-3">
          <div className="text-lg font-bold text-gray-800">총평</div>
          {data.narratives.summary.map((line, idx) => (
            <p key={`summary-${idx}`} className="text-sm text-gray-700 leading-6">
              {line}
            </p>
          ))}
        </div>
      </Page>

      {enabledSections.map((section, index) => {
        const narrative = sectionNarratives[section.id];
        if (!narrative) return null;
        const isLast = index === enabledSections.length - 1;
        return (
          <Page key={section.id} isLast={false}>
            <div className="text-xl font-bold mb-1">{section.name}</div>
            <div className="text-sm text-gray-500 mb-4">기간: {data.range.label}</div>

            <div className="space-y-2">
              {narrative.paragraphs.map((line, idx) => (
                <p key={`${section.id}-p-${idx}`} className="text-sm text-gray-700 leading-6">
                  {line}
                </p>
              ))}
              {narrative.note && (
                <p className="text-xs text-red-600 font-bold">{narrative.note}</p>
              )}
            </div>

            <div className="mt-4">
              <SectionTable stats={narrative.stats} />
              <Highlights items={narrative.highlights} />
            </div>

            {!isLast && <div className="mt-8 text-xs text-gray-400"> </div>}
          </Page>
        );
      })}

      <Page isLast>
        <div className="text-xl font-bold mb-4">교사 코멘트 / 다음 목표</div>
        <div className="space-y-6">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={`line-${idx}`} className="border-b border-gray-300 h-6" />
          ))}
        </div>
      </Page>
    </div>
  );
};
