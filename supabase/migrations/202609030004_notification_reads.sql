create table public.notification_reads (
  teacher_id uuid not null references auth.users(id) on delete cascade,
  notification_id text not null check (char_length(notification_id) between 1 and 240),
  read_at timestamptz not null default now(),
  primary key (teacher_id, notification_id)
);

alter table public.notification_reads enable row level security;

create policy "Teachers can read their notification state"
on public.notification_reads for select to authenticated
using (teacher_id = auth.uid());

create policy "Teachers can mark their notifications read"
on public.notification_reads for insert to authenticated
with check (teacher_id = auth.uid());

create policy "Teachers can update their notification state"
on public.notification_reads for update to authenticated
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

create policy "Teachers can clear their notification state"
on public.notification_reads for delete to authenticated
using (teacher_id = auth.uid());

comment on table public.notification_reads is
  'Per-teacher read state for useful Kalinga alerts such as replies and class-matched resources.';
