-- =============================================================================
-- board-images 버킷: 이미지/PDF MIME 타입 허용 (기존 버킷 업데이트)
-- =============================================================================

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
  'application/octet-stream'
]
WHERE id = 'board-images';

NOTIFY pgrst, 'reload schema';
