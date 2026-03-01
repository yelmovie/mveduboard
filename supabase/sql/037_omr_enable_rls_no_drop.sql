-- =============================================================================
-- OMR assignments: RLS 활성화만 (기존 정책 유지, DROP 없음)
-- 학급/명부 패치(036, 038)와 분리하여 OMR 전용.
-- =============================================================================

-- OMR assignments: enable RLS so existing policies take effect
ALTER TABLE public.omr_assignments ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
