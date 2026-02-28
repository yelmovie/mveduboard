create table if not exists public.schools (
  id uuid primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.classes (
  id uuid primary key,
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  join_code text not null unique,
  join_code_created_at timestamptz not null default now(),
  max_students int not null default 30,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('teacher','student')),
  school_id uuid references public.schools(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key,
  class_id uuid not null references public.classes(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.post_images (
  id uuid primary key,
  post_id uuid not null references public.posts(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days')
);
