const OMR_MAX_QUESTIONS = Number(import.meta.env.VITE_OMR_MAX_QUESTIONS || 200);
const OMR_MIN_QUESTIONS = Number(import.meta.env.VITE_OMR_MIN_QUESTIONS || 1);

export const OMR_QUESTION_MAX = Math.max(1, OMR_MAX_QUESTIONS);
export const OMR_QUESTION_MIN = Math.max(1, OMR_MIN_QUESTIONS);
