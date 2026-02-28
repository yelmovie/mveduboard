import { jsPDF } from 'jspdf';
import { StudentReportData } from './reportService';

interface ReportSection {
  id: string;
  name: string;
  enabled: boolean;
}

/**
 * 학생 리포트를 PDF로 생성합니다.
 */
export const generateStudentReportPDF = async (
  reportData: StudentReportData,
  selectedSections: ReportSection[]
): Promise<jsPDF> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;

  // 헤더
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(`${reportData.year}학년도 학생 활동 리포트`, margin, yPos);
  yPos += 10;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(`학생: ${reportData.student.number}. ${reportData.student.name}`, margin, yPos);
  yPos += 8;

  // 구분선
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // 각 섹션 렌더링
  for (const section of selectedSections) {
    if (!section.enabled) continue;

    // 페이지 여유 공간 확인
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = margin;
    }

    switch (section.id) {
      case 'boardPosts':
        yPos = renderBoardPostsSection(doc, reportData, margin, yPos, contentWidth);
        break;
      case 'learningNotes':
        yPos = renderLearningNotesSection(doc, reportData, margin, yPos, contentWidth);
        break;
      case 'todoRecords':
        yPos = renderTodoRecordsSection(doc, reportData, margin, yPos, contentWidth);
        break;
      case 'points':
        yPos = renderPointsSection(doc, reportData, margin, yPos, contentWidth);
        break;
      case 'messages':
        yPos = renderMessagesSection(doc, reportData, margin, yPos, contentWidth);
        break;
    }

    yPos += 10; // 섹션 간 간격
  }

  return doc;
};

/**
 * 게시판 활동 섹션 렌더링
 */
const renderBoardPostsSection = (
  doc: jsPDF,
  reportData: StudentReportData,
  margin: number,
  yPos: number,
  width: number
): number => {
  const section = reportData.sections.boardPosts;
  if (!section) return yPos;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('📢 게시판 활동', margin, yPos);
  yPos += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`총 게시물 수: ${section.total}개`, margin + 5, yPos);
  yPos += 6;

  // 카테고리별 통계
  if (section.byCategory.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('카테고리별 활동:', margin + 5, yPos);
    yPos += 5;

    section.byCategory.forEach((cat, idx) => {
      if (yPos > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        yPos = margin;
      }
      doc.setFont('helvetica', 'normal');
      doc.text(`  • ${cat.category}: ${cat.count}개`, margin + 10, yPos);
      yPos += 5;
    });
  }

  return yPos;
};

/**
 * 학습 노트 섹션 렌더링
 */
const renderLearningNotesSection = (
  doc: jsPDF,
  reportData: StudentReportData,
  margin: number,
  yPos: number,
  width: number
): number => {
  const section = reportData.sections.learningNotes;
  if (!section) return yPos;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('📝 배움 노트', margin, yPos);
  yPos += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`총 작성 수: ${section.total}개`, margin + 5, yPos);
  yPos += 8;

  // 최근 게시물 목록
  if (section.posts.length > 0) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('최근 작성 내역:', margin + 5, yPos);
    yPos += 5;

    section.posts.slice(0, 5).forEach((post, idx) => {
      if (yPos > doc.internal.pageSize.getHeight() - 30) {
        doc.addPage();
        yPos = margin;
      }

      const date = new Date(post.created_at).toLocaleDateString('ko-KR');
      const title = post.title || '제목 없음';
      const truncatedTitle = doc.splitTextToSize(title, width - 30)[0];

      doc.setFont('helvetica', 'normal');
      doc.text(`  ${idx + 1}. ${date} - ${truncatedTitle}`, margin + 10, yPos);
      yPos += 5;
    });
  }

  return yPos;
};

/**
 * 할일 기록 섹션 렌더링
 */
const renderTodoRecordsSection = (
  doc: jsPDF,
  reportData: StudentReportData,
  margin: number,
  yPos: number,
  width: number
): number => {
  const section = reportData.sections.todoRecords;
  if (!section) return yPos;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('✅ 할일 체크 기록', margin, yPos);
  yPos += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`완료한 과제: ${section.totalCompleted}개`, margin + 5, yPos);
  yPos += 5;
  doc.text(`미완료 과제: ${section.totalIncomplete}개`, margin + 5, yPos);
  yPos += 5;
  doc.setFont('helvetica', 'bold');
  doc.text(`완료율: ${section.completionRate}%`, margin + 5, yPos);
  yPos += 8;

  return yPos;
};

/**
 * 포인트 섹션 렌더링
 */
const renderPointsSection = (
  doc: jsPDF,
  reportData: StudentReportData,
  margin: number,
  yPos: number,
  width: number
): number => {
  const section = reportData.sections.points;
  if (!section) return yPos;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('⭐ 포인트 활동', margin, yPos);
  yPos += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`현재 포인트: ${section.currentPoints}점`, margin + 5, yPos);
  yPos += 5;
  doc.text(`총 획득: ${section.totalEarned}점`, margin + 5, yPos);
  yPos += 5;
  doc.text(`총 차감: ${section.totalDeducted}점`, margin + 5, yPos);
  yPos += 8;

  return yPos;
};

/**
 * 쪽지 활동 섹션 렌더링
 */
const renderMessagesSection = (
  doc: jsPDF,
  reportData: StudentReportData,
  margin: number,
  yPos: number,
  width: number
): number => {
  const section = reportData.sections.messages;
  if (!section) return yPos;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('💌 쪽지 활동', margin, yPos);
  yPos += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`보낸 쪽지: ${section.sent}개`, margin + 5, yPos);
  yPos += 5;
  doc.text(`받은 쪽지: ${section.received}개`, margin + 5, yPos);
  yPos += 8;

  return yPos;
};
