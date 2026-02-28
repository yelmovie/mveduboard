const SURVEY_ATTACHMENT_MAX_MB = Number(import.meta.env.VITE_SURVEY_ATTACHMENT_MAX_MB || 5);
const SURVEY_ALLOWED_MIME_RAW = String(import.meta.env.VITE_SURVEY_ATTACHMENT_MIME || 'image/*');

export const SURVEY_ATTACHMENT_MAX_BYTES = Math.max(1, SURVEY_ATTACHMENT_MAX_MB) * 1024 * 1024;
export const SURVEY_ALLOWED_MIME = SURVEY_ALLOWED_MIME_RAW.split(',')
  .map((v) => v.trim())
  .filter(Boolean);
