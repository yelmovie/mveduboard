export const getErrorMessage = (error: unknown, fallback = '요청 처리 중 오류가 발생했습니다.') => {
  if (error instanceof Error) {
    const msg = error.message || '';
    // Handle Supabase rate limit errors (429)
    if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests')) {
      return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
    }
    // Handle Supabase auth errors
    if (msg.includes('User already registered')) {
      return '이미 등록된 이메일입니다. 로그인을 시도해주세요.';
    }
    if (msg.includes('Invalid login credentials')) {
      return '이메일 또는 비밀번호가 올바르지 않습니다.';
    }
    if (msg.includes('Email not confirmed')) {
      return '이메일 인증이 필요합니다. 이메일을 확인해주세요.';
    }
    return msg || fallback;
  }
  if (error && typeof error === 'object') {
    const msg = typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message
      : '';
    if (msg) {
      if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests')) {
        return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
      }
      if (msg.includes('User already registered')) {
        return '이미 등록된 이메일입니다. 로그인을 시도해주세요.';
      }
      if (msg.includes('Invalid login credentials')) {
        return '이메일 또는 비밀번호가 올바르지 않습니다.';
      }
      if (msg.includes('Email not confirmed')) {
        return '이메일 인증이 필요합니다. 이메일을 확인해주세요.';
      }
      if (msg.includes('42501') || msg.includes('permission denied') || msg.includes('policy')) {
        return '데이터베이스 권한 오류입니다. RLS 정책을 확인해주세요.';
      }
      if (msg.includes('PGRST116') || msg.includes('404')) {
        return '데이터베이스 테이블에 접근할 수 없습니다. 스키마를 확인해주세요.';
      }
      return msg;
    }
  }
  if (typeof error === 'string') return error;
  return fallback;
};
