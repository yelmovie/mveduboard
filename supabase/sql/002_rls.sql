alter table public.schools enable row level security;
alter table public.classes enable row level security;
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.post_images enable row level security;

-- Schools table policies
drop policy if exists "schools_authenticated_select" on public.schools;
create policy "schools_authenticated_select"
  on public.schools
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "schools_authenticated_insert" on public.schools;
create policy "schools_authenticated_insert"
  on public.schools
  for insert
  with check (auth.role() = 'authenticated');

create policy "profiles_owner_read"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "profiles_teacher_read_same_class"
  on public.profiles
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and p.role = 'teacher'
      and p.class_id = profiles.class_id
    )
  );

create policy "profiles_owner_write"
  on public.profiles
  for insert
  with check (auth.uid() = id);

create policy "classes_teacher_read"
  on public.classes
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and p.role = 'teacher'
      and p.school_id = classes.school_id
    )
  );

create policy "classes_student_read"
  on public.classes
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and p.class_id = classes.id
    )
  );

create policy "classes_teacher_write"
  on public.classes
  for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and p.role = 'teacher'
      and p.school_id = classes.school_id
    )
  );

-- Allow authenticated users to insert classes during signup (before profile exists)
drop policy if exists "classes_authenticated_insert" on public.classes;
create policy "classes_authenticated_insert"
  on public.classes
  for insert
  with check (auth.role() = 'authenticated');

create policy "posts_read_same_class"
  on public.posts
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and p.class_id = posts.class_id
    )
  );

create policy "posts_author_write"
  on public.posts
  for insert
  with check (auth.uid() = author_id);

create policy "posts_author_delete"
  on public.posts
  for delete
  using (
    auth.uid() = author_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
      and p.role = 'teacher'
      and p.class_id = posts.class_id
    )
  );

create policy "post_images_read_same_class"
  on public.post_images
  for select
  using (
    exists (
      select 1 from public.profiles p
      join public.posts po on po.id = post_images.post_id
      where p.id = auth.uid()
      and p.class_id = po.class_id
    )
  );

create policy "post_images_author_write"
  on public.post_images
  for insert
  with check (
    exists (
      select 1 from public.posts po
      where po.id = post_images.post_id
      and po.author_id = auth.uid()
    )
  );
