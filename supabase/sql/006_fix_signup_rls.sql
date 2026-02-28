-- Fix RLS policies for teacher signup flow
-- This script is idempotent (can be run multiple times safely)
-- Run this in Supabase SQL Editor after running 001_init.sql and 002_rls.sql

-- Problem: During signup, user is authenticated but profile doesn't exist yet.
-- Existing policies require profile existence, causing 401 errors.

-- 1. Ensure schools table allows authenticated users to insert (for signup)
-- This policy should already exist in 002_rls.sql, but ensure it's correct
drop policy if exists "schools_authenticated_insert" on public.schools;
create policy "schools_authenticated_insert"
  on public.schools
  for insert
  with check (auth.role() = 'authenticated');

-- 2. Add classes insert policy for authenticated users (for signup)
-- The existing "classes_teacher_write" requires profile, so we need an additional policy
drop policy if exists "classes_authenticated_insert" on public.classes;
create policy "classes_authenticated_insert"
  on public.classes
  for insert
  with check (auth.role() = 'authenticated');

-- 3. Ensure profiles can be created by authenticated user
-- This should already exist, but ensure it's there
-- Note: The policy checks auth.uid() = id, which works during signup
-- No change needed if profiles_owner_write already exists in 002_rls.sql

-- Summary:
-- - schools: authenticated users can insert (for new school creation during signup)
-- - classes: authenticated users can insert (via classes_authenticated_insert, for signup)
--   AND teachers with profiles can insert (via classes_teacher_write, for normal operations)
-- - profiles: users can insert their own profile (auth.uid() = id, from 002_rls.sql)
-- 
-- Both policies exist for classes insert:
-- - classes_authenticated_insert: Allows any authenticated user (for signup)
-- - classes_teacher_write: Allows teachers with profile (for normal operations)
