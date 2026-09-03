alter table public.resource_bookmarks
  drop constraint if exists resource_bookmarks_pkey;

alter table public.resource_bookmarks
  alter column resource_id type text using resource_id::text;

alter table public.resource_bookmarks
  add primary key (teacher_id, resource_id);

comment on table public.resource_bookmarks is
  'Per-teacher bookmarks for both UUID-backed teacher resources and Kalinga catalog resources.';

create table public.teacher_discussions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 120),
  school_name text,
  title text not null check (char_length(title) between 4 and 180),
  body text not null check (char_length(body) between 4 and 3000),
  subject text,
  grade_levels text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teacher_replies (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references public.teacher_discussions(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 120),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index teacher_discussions_created_at_idx on public.teacher_discussions(created_at desc);
create index teacher_discussions_author_id_idx on public.teacher_discussions(author_id);
create index teacher_replies_discussion_id_idx on public.teacher_replies(discussion_id, created_at);
create index teacher_replies_author_id_idx on public.teacher_replies(author_id);

alter table public.teacher_discussions enable row level security;
alter table public.teacher_replies enable row level security;

create policy "Signed-in teachers can read discussions"
on public.teacher_discussions for select to authenticated
using (true);

create policy "Teachers can start discussions"
on public.teacher_discussions for insert to authenticated
with check (author_id = auth.uid());

create policy "Teachers can update their discussions"
on public.teacher_discussions for update to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

create policy "Teachers can delete their discussions"
on public.teacher_discussions for delete to authenticated
using (author_id = auth.uid());

create policy "Signed-in teachers can read replies"
on public.teacher_replies for select to authenticated
using (true);

create policy "Teachers can add replies"
on public.teacher_replies for insert to authenticated
with check (author_id = auth.uid());

create policy "Teachers can update their replies"
on public.teacher_replies for update to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

create policy "Teachers can delete their replies"
on public.teacher_replies for delete to authenticated
using (author_id = auth.uid());

create trigger teacher_discussions_set_updated_at
before update on public.teacher_discussions
for each row execute function public.set_updated_at();

create trigger teacher_replies_set_updated_at
before update on public.teacher_replies
for each row execute function public.set_updated_at();

do $$
begin
  alter publication supabase_realtime add table public.teacher_discussions;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.teacher_replies;
exception
  when duplicate_object then null;
end
$$;

comment on table public.teacher_discussions is
  'Shared teacher-to-teacher questions. Never include learner names, records, or other sensitive details.';

comment on table public.teacher_replies is
  'Replies visible to authenticated Kalinga teachers and linked to a shared discussion.';
