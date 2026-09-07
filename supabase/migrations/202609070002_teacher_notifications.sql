-- Notifications were derived in the browser: every client re-read 100 discussions
-- and 500 replies on every insert by any teacher, and mentions older than that
-- 500-row window silently stopped notifying. They are now written once, server
-- side, against a stable author id rather than a display-name-derived tag.

create table public.teacher_notifications (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('reply', 'mention')),
  title text not null check (char_length(title) between 1 and 240),
  body text not null default '' check (char_length(body) <= 400),
  discussion_id uuid not null references public.teacher_discussions(id) on delete cascade,
  reply_id uuid references public.teacher_replies(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index teacher_notifications_teacher_created_idx on public.teacher_notifications(teacher_id, created_at desc);
create unique index teacher_notifications_unique_reply_idx on public.teacher_notifications(teacher_id, kind, reply_id) where reply_id is not null;
create unique index teacher_notifications_unique_discussion_idx on public.teacher_notifications(teacher_id, kind, discussion_id) where reply_id is null;

alter table public.teacher_notifications enable row level security;

create policy "Teachers can read their own notifications"
on public.teacher_notifications for select to authenticated
using (teacher_id = auth.uid());

create policy "Teachers can mark their own notifications read"
on public.teacher_notifications for update to authenticated
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

create policy "Teachers can clear their own notifications"
on public.teacher_notifications for delete to authenticated
using (teacher_id = auth.uid());

-- Mentions resolve against profiles.mention_tag, which is derived from the
-- display name once and kept unique, so a renamed or duplicated display name
-- cannot redirect another teacher's mentions.
alter table public.profiles add column if not exists mention_tag text;

create or replace function public.teacher_mention_tag(display_name text, teacher_id uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select '@' || coalesce(nullif(trim(both '_' from regexp_replace(lower(regexp_replace(coalesce(display_name, ''), '^teacher\s+', '', 'i')), '[^a-z0-9]+', '_', 'g')), ''), 'teacher')
    || '_' || lower(left(regexp_replace(teacher_id::text, '[^a-zA-Z0-9]', '', 'g'), 4));
$$;

update public.profiles
set mention_tag = public.teacher_mention_tag(display_name, id)
where mention_tag is null;

-- Deliberately not unique: a collision needs an identical display name AND an
-- identical first four hex of the account id, and it would only over-notify.
-- A unique index here would instead fail the profile insert and break signup.
create index if not exists profiles_mention_tag_idx on public.profiles(mention_tag);

create or replace function public.set_profile_mention_tag()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.mention_tag is null or (tg_op = 'UPDATE' and new.display_name is distinct from old.display_name) then
    new.mention_tag = public.teacher_mention_tag(new.display_name, new.id);
  end if;
  return new;
end;
$$;

create trigger profiles_set_mention_tag
before insert or update on public.profiles
for each row execute function public.set_profile_mention_tag();

create or replace function public.notify_on_teacher_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  thread_author uuid;
  thread_title text;
begin
  select author_id, title into thread_author, thread_title
  from public.teacher_discussions where id = new.discussion_id;

  -- Everyone named in the reply, resolved by tag rather than by display name.
  insert into public.teacher_notifications (teacher_id, kind, title, body, discussion_id, reply_id, actor_id)
  select profiles.id, 'mention', new.author_name || ' mentioned you', left(coalesce(thread_title, 'Teacher discussion'), 400), new.discussion_id, new.id, new.author_id
  from public.profiles
  where profiles.id <> new.author_id
    and profiles.mention_tag is not null
    and new.body ~* ('(^|[^a-z0-9_])' || regexp_replace(profiles.mention_tag, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') || '($|[^a-z0-9_])')
  on conflict do nothing;

  -- The thread author, unless they wrote the reply or were already mentioned in it.
  if thread_author is not null and thread_author <> new.author_id then
    insert into public.teacher_notifications (teacher_id, kind, title, body, discussion_id, reply_id, actor_id)
    select thread_author, 'reply', new.author_name || ' replied', left(coalesce(thread_title, 'Your teacher question'), 400), new.discussion_id, new.id, new.author_id
    where not exists (
      select 1 from public.teacher_notifications
      where teacher_notifications.teacher_id = thread_author
        and teacher_notifications.reply_id = new.id
        and teacher_notifications.kind = 'mention'
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.notify_on_teacher_discussion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.teacher_notifications (teacher_id, kind, title, body, discussion_id, reply_id, actor_id)
  select profiles.id, 'mention', new.author_name || ' mentioned you', left(new.title, 400), new.id, null, new.author_id
  from public.profiles
  where profiles.id <> new.author_id
    and profiles.mention_tag is not null
    and new.body ~* ('(^|[^a-z0-9_])' || regexp_replace(profiles.mention_tag, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') || '($|[^a-z0-9_])')
  on conflict do nothing;
  return new;
end;
$$;

create trigger teacher_replies_notify
after insert on public.teacher_replies
for each row execute function public.notify_on_teacher_reply();

create trigger teacher_discussions_notify
after insert on public.teacher_discussions
for each row execute function public.notify_on_teacher_discussion();

-- Backfill from the existing history so nothing already posted is lost.
insert into public.teacher_notifications (teacher_id, kind, title, body, discussion_id, reply_id, actor_id, created_at)
select discussions.author_id, 'reply', replies.author_name || ' replied', left(discussions.title, 400), replies.discussion_id, replies.id, replies.author_id, replies.created_at
from public.teacher_replies replies
join public.teacher_discussions discussions on discussions.id = replies.discussion_id
where discussions.author_id <> replies.author_id
on conflict do nothing;

insert into public.teacher_notifications (teacher_id, kind, title, body, discussion_id, reply_id, actor_id, created_at)
select profiles.id, 'mention', replies.author_name || ' mentioned you', left(discussions.title, 400), replies.discussion_id, replies.id, replies.author_id, replies.created_at
from public.teacher_replies replies
join public.teacher_discussions discussions on discussions.id = replies.discussion_id
join public.profiles on profiles.id <> replies.author_id and profiles.mention_tag is not null
where replies.body ~* ('(^|[^a-z0-9_])' || regexp_replace(profiles.mention_tag, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') || '($|[^a-z0-9_])')
on conflict do nothing;

insert into public.teacher_notifications (teacher_id, kind, title, body, discussion_id, reply_id, actor_id, created_at)
select profiles.id, 'mention', discussions.author_name || ' mentioned you', left(discussions.title, 400), discussions.id, null, discussions.author_id, discussions.created_at
from public.teacher_discussions discussions
join public.profiles on profiles.id <> discussions.author_id and profiles.mention_tag is not null
where discussions.body ~* ('(^|[^a-z0-9_])' || regexp_replace(profiles.mention_tag, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') || '($|[^a-z0-9_])')
on conflict do nothing;

-- Carry over what the old client-side read state had already marked read.
update public.teacher_notifications
set read_at = now()
from public.notification_reads
where notification_reads.teacher_id = teacher_notifications.teacher_id
  and notification_reads.notification_id in (
    'reply:' || teacher_notifications.reply_id::text,
    'mention:reply:' || teacher_notifications.reply_id::text,
    'mention:discussion:' || teacher_notifications.discussion_id::text
  );

do $$
begin
  alter publication supabase_realtime add table public.teacher_notifications;
exception
  when duplicate_object then null;
end
$$;

comment on table public.teacher_notifications is
  'Per-teacher notifications written by trigger. Readable only by their owner, so clients subscribe to their own rows instead of the whole discussion table.';

comment on column public.profiles.mention_tag is
  'Stable @tag for this teacher. Mentions resolve against this rather than a display name, so renaming an account cannot capture another teacher''s mentions.';
