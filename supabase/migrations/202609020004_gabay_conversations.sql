create table public.gabay_conversations (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation' check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.gabay_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.gabay_conversations(id) on delete cascade,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('teacher', 'gabay')),
  content text not null check (char_length(content) between 1 and 4000),
  page_view text not null default 'home' check (char_length(page_view) between 1 and 40),
  created_at timestamptz not null default now()
);

create index gabay_conversations_teacher_updated_idx on public.gabay_conversations(teacher_id, updated_at desc);
create index gabay_messages_conversation_created_idx on public.gabay_messages(conversation_id, created_at);
create index gabay_messages_teacher_id_idx on public.gabay_messages(teacher_id);

alter table public.gabay_conversations enable row level security;
alter table public.gabay_messages enable row level security;

create policy "Teachers own their Gabay conversations"
on public.gabay_conversations
for all
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

create policy "Teachers own their Gabay messages"
on public.gabay_messages
for all
using (
  teacher_id = auth.uid()
  and exists (
    select 1 from public.gabay_conversations
    where gabay_conversations.id = gabay_messages.conversation_id
      and gabay_conversations.teacher_id = auth.uid()
  )
)
with check (
  teacher_id = auth.uid()
  and exists (
    select 1 from public.gabay_conversations
    where gabay_conversations.id = gabay_messages.conversation_id
      and gabay_conversations.teacher_id = auth.uid()
  )
);

create trigger gabay_conversations_set_updated_at
before update on public.gabay_conversations
for each row execute function public.set_updated_at();

comment on table public.gabay_conversations is
  'Private, teacher-owned Gabay threads. Classroom page context is not stored here.';

comment on table public.gabay_messages is
  'Private teacher and Gabay messages. Do not store learner names, reference numbers, attendance notes, or health details.';
