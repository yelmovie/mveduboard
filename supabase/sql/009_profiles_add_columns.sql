-- Add school_id/class_id columns to profiles (uuid)
-- Rerunnable, safe for existing DB

alter table public.profiles
  add column if not exists school_id uuid,
  add column if not exists class_id uuid;

-- Optional FK constraints (uncomment if desired)
-- alter table public.profiles
--   add constraint profiles_school_id_fkey foreign key (school_id) references public.schools(id) on delete set null;
-- alter table public.profiles
--   add constraint profiles_class_id_fkey foreign key (class_id) references public.classes(id) on delete set null;
