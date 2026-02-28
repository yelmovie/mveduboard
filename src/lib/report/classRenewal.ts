/**
 * 학급정보 갱신 관련 유틸리티
 * 매년 2월 1일에 학급정보를 갱신합니다.
 */

const RENEWAL_DATE_KEY = 'edu_class_renewal_date';
const BACKUP_PREFIX = 'edu_class_backup_';

/**
 * 마지막 갱신일을 확인하고, 2월 1일이 지났는지 확인합니다.
 */
export const shouldRenewClassData = (): boolean => {
  const lastRenewalStr = localStorage.getItem(RENEWAL_DATE_KEY);
  
  if (!lastRenewalStr) {
    // 처음 사용하는 경우
    return false;
  }

  const lastRenewal = new Date(lastRenewalStr);
  const now = new Date();
  const currentYear = now.getFullYear();
  const renewalDateThisYear = new Date(currentYear, 1, 1); // 2월 1일 (월은 0부터 시작)

  // 올해 2월 1일이 지났고, 마지막 갱신이 올해 2월 1일 이전이면 갱신 필요
  return now >= renewalDateThisYear && lastRenewal < renewalDateThisYear;
};

/**
 * 학급 데이터를 백업합니다.
 */
export const backupClassData = (year: number): void => {
  const backupData: Record<string, any> = {};

  // 백업할 localStorage 키들
  const keysToBackup = [
    'edu_class_roster',
    'edu_posts_data',
    'edu_comments_data',
    'edu_todo_tasks',
    'edu_todo_records',
    'edu_point_students',
    'edu_point_histories',
    'edu_role_data',
    'edu_private_messages',
  ];

  keysToBackup.forEach(key => {
    const value = localStorage.getItem(key);
    if (value) {
      backupData[key] = value;
    }
  });

  // 백업 데이터를 JSON으로 저장
  const backupKey = `${BACKUP_PREFIX}${year}`;
  localStorage.setItem(backupKey, JSON.stringify(backupData));
  console.log(`학급 데이터 백업 완료: ${year}학년도`);
};

/**
 * 백업된 데이터를 복원합니다.
 */
export const restoreClassData = (year: number): Record<string, any> | null => {
  const backupKey = `${BACKUP_PREFIX}${year}`;
  const backupStr = localStorage.getItem(backupKey);
  
  if (!backupStr) {
    return null;
  }

  try {
    return JSON.parse(backupStr);
  } catch (error) {
    console.error(`백업 데이터 복원 실패 (${year}학년도):`, error);
    return null;
  }
};

/**
 * 학급 데이터를 초기화합니다.
 * (학생 명부는 유지, 활동 데이터만 초기화)
 */
export const renewClassData = (): void => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const lastYear = currentYear - 1;

  // 작년 데이터 백업
  backupClassData(lastYear);

  // 초기화할 데이터 (학생 명부는 유지)
  const keysToReset = [
    'edu_posts_data',
    'edu_comments_data',
    'edu_todo_tasks',
    'edu_todo_records',
    'edu_point_students',
    'edu_point_histories',
    'edu_role_data',
    'edu_private_messages',
  ];

  keysToReset.forEach(key => {
    localStorage.removeItem(key);
  });

  // 초기화 플래그도 리셋
  localStorage.removeItem('edu_todo_initialized');
  localStorage.removeItem('edu_messages_initialized');

  // 갱신일 업데이트
  const renewalDateThisYear = new Date(currentYear, 1, 1); // 올해 2월 1일
  localStorage.setItem(RENEWAL_DATE_KEY, renewalDateThisYear.toISOString());

  console.log(`${currentYear}학년도 학급 데이터 갱신 완료`);
};

/**
 * 학급 데이터 갱신이 필요한지 확인하고, 필요시 자동 갱신합니다.
 */
export const checkAndRenewClassData = (): boolean => {
  if (shouldRenewClassData()) {
    renewClassData();
    return true;
  }
  return false;
};

/**
 * 앱 시작 시 자동으로 확인하는 함수
 */
export const initializeClassRenewal = (): void => {
  const lastRenewalStr = localStorage.getItem(RENEWAL_DATE_KEY);
  
  if (!lastRenewalStr) {
    // 처음 사용 시 현재 날짜를 저장
    const now = new Date();
    const renewalDateThisYear = new Date(now.getFullYear(), 1, 1); // 올해 2월 1일
    localStorage.setItem(RENEWAL_DATE_KEY, renewalDateThisYear.toISOString());
    return;
  }

  // 갱신 필요 여부 확인 및 실행
  checkAndRenewClassData();
};
