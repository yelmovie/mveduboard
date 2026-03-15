/**
 * 학생 입장 실패 원인 구분 — 로그/UI 메시지용.
 * 민감정보 노출 없이 원인만 구분.
 */
export const StudentJoinFailureReason = {
  CODE_EMPTY: 'CODE_EMPTY',
  CODE_NOT_FOUND: 'CODE_NOT_FOUND',
  RPC_ERROR: 'RPC_ERROR',
  STUDENT_NAME_NOT_FOUND: 'STUDENT_NAME_NOT_FOUND',
  CLASS_FULL: 'CLASS_FULL',
  SERVER_ERROR: 'SERVER_ERROR',
  UNKNOWN: 'UNKNOWN',
} as const;

export type StudentJoinFailureReasonType =
  (typeof StudentJoinFailureReason)[keyof typeof StudentJoinFailureReason];

export function getStudentJoinFailureMessage(reason: StudentJoinFailureReasonType): string {
  switch (reason) {
    case StudentJoinFailureReason.CODE_EMPTY:
      return '참여 코드를 입력해주세요.';
    case StudentJoinFailureReason.CODE_NOT_FOUND:
      return '입력한 참여 코드를 찾을 수 없습니다. 코드를 확인해 주세요.';
    case StudentJoinFailureReason.RPC_ERROR:
      return '참여 코드를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.';
    case StudentJoinFailureReason.STUDENT_NAME_NOT_FOUND:
      return '학급 명부에 없는 이름입니다. 정확한 이름을 입력해 주세요.';
    case StudentJoinFailureReason.CLASS_FULL:
      return '현재 학급 인원이 가득 찼습니다.';
    case StudentJoinFailureReason.SERVER_ERROR:
      return '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
    default:
      return '입장에 실패했습니다. 다시 시도해 주세요.';
  }
}
