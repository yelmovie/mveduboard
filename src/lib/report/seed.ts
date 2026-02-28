import * as boardService from '../../../services/boardService';
import * as todoService from '../../../services/todoService';
import * as pointService from '../../../services/pointService';
import * as messageService from '../../../services/messageService';
import * as scheduleService from '../../../services/scheduleService';
import { ClassStudent, Post } from '../../../types';

const addPointHistory = (studentId: string, amount: number, reason: string) => {
  const key = 'edu_point_histories';
  const stored = localStorage.getItem(key);
  const histories = stored ? JSON.parse(stored) : [];
  histories.push({
    id: `seed-${Date.now()}`,
    studentIds: [studentId],
    amount,
    reason,
    timestamp: Date.now(),
  });
  localStorage.setItem(key, JSON.stringify(histories));
};

const createStudentPost = async (
  student: ClassStudent,
  boardId: string,
  title: string,
  body: string,
  extra?: Partial<Post>
) => {
  return boardService.createPost(
    {
      board_id: boardId,
      author_participant_id: student.id,
      author_name: `${student.number}. ${student.name}`,
      title,
      body,
      ...extra,
    },
    false
  );
};

export const seedStudentReportData = async (students: ClassStudent[]) => {
  const targets = students.slice(0, 3);
  const today = new Date().toISOString().split('T')[0];

  for (const [idx, student] of targets.entries()) {
    const tag = `샘플-${idx + 1}`;

    const writingPost = await createStudentPost(
      student,
      'writing',
      `${tag} 주제글쓰기`,
      '데이터 기준으로 글쓰기 연습을 위한 샘플 기록입니다.'
    );

    await createStudentPost(
      student,
      'learning',
      `${tag} 배움노트`,
      '오늘 배운 내용을 정리하며 학습 내용을 스스로 설명해보았습니다.'
    );

    await createStudentPost(
      student,
      'reading',
      `${tag} 독서록`,
      '읽은 책에서 인상 깊었던 장면과 느낀 점을 기록했습니다.'
    );

    await createStudentPost(
      student,
      'math',
      `${tag} 오답노트`,
      '틀린 문제를 다시 풀어보며 풀이 과정을 점검했습니다.',
      { math_page_range: 'P.12~13', is_corrected: true }
    );

    await createStudentPost(
      student,
      'board',
      `${tag} 자유게시판`,
      '게시판 활동 샘플 글입니다.'
    );

    await boardService.addComment(
      writingPost.id,
      `${student.number}. ${student.name}`,
      '댓글 샘플입니다.'
    );

    const task = todoService.createTask(today, `${tag} 오늘 할 일`, idx % 2 === 0);
    todoService.updateStudentStatus(task.id, { id: student.id, nickname: `${student.number}. ${student.name}` }, 'complete');

    pointService.updatePoints([student.id], 2, `${tag} 칭찬 포인트`);
    addPointHistory(student.id, 2, `${tag} 칭찬 포인트`);

    messageService.sendMessage(`${student.number}. ${student.name}`, `${tag} 쪽지 샘플입니다.`, 'student');

    scheduleService.addSchedule(student.id, today, 'schedule', `${tag} 학습 계획`, '09:00');
  }

  return targets.map((s) => s.id);
};
