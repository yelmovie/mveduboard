-- 사용자 데이터 유실 방지: app 데이터 jsonb 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'point_data') THEN
    ALTER TABLE public.classes ADD COLUMN point_data jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'role_data') THEN
    ALTER TABLE public.classes ADD COLUMN role_data jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'seat_data') THEN
    ALTER TABLE public.classes ADD COLUMN seat_data jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'message_data') THEN
    ALTER TABLE public.classes ADD COLUMN message_data jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'meeting_data') THEN
    ALTER TABLE public.classes ADD COLUMN meeting_data jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'coupon_data') THEN
    ALTER TABLE public.classes ADD COLUMN coupon_data jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'notice_data') THEN
    ALTER TABLE public.classes ADD COLUMN notice_data jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'occasion_data') THEN
    ALTER TABLE public.classes ADD COLUMN occasion_data jsonb;
  END IF;
END $$;
NOTIFY pgrst, 'reload schema';
