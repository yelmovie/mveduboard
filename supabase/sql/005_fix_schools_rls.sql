-- Fix: Add RLS policies for schools table
-- This script is rerunnable (uses drop policy if exists)

-- Enable RLS on schools (idempotent)
alter table public.schools enable row level security;

-- Drop existing policies if they exist (for rerun safety)
drop policy if exists "schools_authenticated_select" on public.schools;
drop policy if exists "schools_authenticated_insert" on public.schools;

-- Create policies: authenticated users can select and insert schools
create policy "schools_authenticated_select"
  on public.schools
  for select
  using (auth.role() = 'authenticated');

create policy "schools_authenticated_insert"
  on public.schools
  for insert
  with check (auth.role() = 'authenticated');
