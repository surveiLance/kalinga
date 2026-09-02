create table public.resource_bookmarks (
  teacher_id uuid not null references auth.users(id) on delete cascade,
  resource_id bigint not null,
  created_at timestamptz not null default now(),
  primary key (teacher_id, resource_id)
);

alter table public.resource_bookmarks enable row level security;

create policy "Teachers own their resource bookmarks"
on public.resource_bookmarks
for all
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

comment on table public.resource_bookmarks is
  'Per-teacher bookmarks for Kalinga''s curated resource catalog. Teacher uploads remain in public.resources.';
