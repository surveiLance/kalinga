create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  school_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  grade_levels text[] not null default '{}',
  subjects text[] not null default '{}',
  schedule jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.learners (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 160),
  grade_level text not null,
  sex text not null default 'Not specified' check (sex in ('Female', 'Male', 'Not specified')),
  learner_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lesson_plans (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled lesson',
  subject text,
  grade_levels text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'ready', 'archived')),
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  attendance_date date not null,
  status text not null check (status in ('present', 'late', 'absent', 'excused', 'leave')),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (learner_id, attendance_date)
);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  storage_path text,
  visibility text not null default 'private' check (visibility in ('private', 'school', 'shared')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index classes_teacher_id_idx on public.classes(teacher_id);
create index learners_class_id_idx on public.learners(class_id);
create index learners_teacher_id_idx on public.learners(teacher_id);
create index lesson_plans_class_id_idx on public.lesson_plans(class_id);
create index lesson_plans_teacher_id_idx on public.lesson_plans(teacher_id);
create index attendance_class_date_idx on public.attendance_records(class_id, attendance_date);
create index attendance_teacher_id_idx on public.attendance_records(teacher_id);
create index resources_owner_id_idx on public.resources(owner_id);

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.learners enable row level security;
alter table public.lesson_plans enable row level security;
alter table public.attendance_records enable row level security;
alter table public.resources enable row level security;

create policy "Teachers can read their profile" on public.profiles for select using (id = auth.uid());
create policy "Teachers can create their profile" on public.profiles for insert with check (id = auth.uid());
create policy "Teachers can update their profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "Teachers own their classes" on public.classes for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy "Teachers own their learners" on public.learners for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy "Teachers own their lesson plans" on public.lesson_plans for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy "Teachers own their attendance" on public.attendance_records for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy "Teachers manage their resources" on public.resources for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Teachers can read shared resources" on public.resources for select using (visibility = 'shared' or owner_id = auth.uid());

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger classes_set_updated_at before update on public.classes for each row execute function public.set_updated_at();
create trigger learners_set_updated_at before update on public.learners for each row execute function public.set_updated_at();
create trigger lesson_plans_set_updated_at before update on public.lesson_plans for each row execute function public.set_updated_at();
create trigger attendance_set_updated_at before update on public.attendance_records for each row execute function public.set_updated_at();
create trigger resources_set_updated_at before update on public.resources for each row execute function public.set_updated_at();

create or replace function public.handle_new_teacher()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name'));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_teacher();

insert into storage.buckets (id, name, public, file_size_limit)
values ('teacher-resources', 'teacher-resources', false, 52428800)
on conflict (id) do nothing;

create policy "Teachers upload to their resource folder"
on storage.objects for insert to authenticated
with check (bucket_id = 'teacher-resources' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Teachers read their resource files"
on storage.objects for select to authenticated
using (bucket_id = 'teacher-resources' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Teachers update their resource files"
on storage.objects for update to authenticated
using (bucket_id = 'teacher-resources' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'teacher-resources' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Teachers delete their resource files"
on storage.objects for delete to authenticated
using (bucket_id = 'teacher-resources' and (storage.foldername(name))[1] = auth.uid()::text);

comment on table public.learners is 'Teacher-owned learner roster. Never send learner names or reference numbers to Gabay.';
comment on table public.attendance_records is 'Date-specific attendance. Late learners attended but remain a distinct status.';
