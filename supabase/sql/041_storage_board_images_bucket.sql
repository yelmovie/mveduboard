-- =============================================================================
-- board-images 스토리지 버킷 생성 및 RLS 정책
-- 게시판 이미지/파일 업로드를 위한 버킷. 추가만, DROP 없음.
-- =============================================================================

-- (1) 버킷 생성 (이미 존재하면 무시)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'board-images',
  'board-images',
  false,
  10485760,
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
    'application/octet-stream'
  ]
) ON CONFLICT (id) DO NOTHING;

-- (2) RLS 정책 — 인증된 사용자에게 board-images 버킷 접근 허용

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'board_images_insert'
  ) THEN
    EXECUTE $p$
      CREATE POLICY board_images_insert ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'board-images')
    $p$;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'board_images_select'
  ) THEN
    EXECUTE $p$
      CREATE POLICY board_images_select ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'board-images')
    $p$;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'board_images_update'
  ) THEN
    EXECUTE $p$
      CREATE POLICY board_images_update ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'board-images')
      WITH CHECK (bucket_id = 'board-images')
    $p$;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'board_images_delete'
  ) THEN
    EXECUTE $p$
      CREATE POLICY board_images_delete ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'board-images')
    $p$;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
