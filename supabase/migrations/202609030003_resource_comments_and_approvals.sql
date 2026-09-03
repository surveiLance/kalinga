create table public.resource_comments (
  id uuid primary key default gen_random_uuid(),
  resource_id text not null,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  teacher_name text not null check (char_length(teacher_name) between 1 and 120),
  body text not null check (char_length(body) between 1 and 1500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.resource_approvals (
  resource_id text not null,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (resource_id, teacher_id)
);

create index resource_comments_resource_id_idx on public.resource_comments(resource_id, created_at);
create index resource_comments_teacher_id_idx on public.resource_comments(teacher_id);
create index resource_approvals_resource_id_idx on public.resource_approvals(resource_id);

alter table public.resource_comments enable row level security;
alter table public.resource_approvals enable row level security;

create policy "Signed-in teachers can read resource comments"
on public.resource_comments for select to authenticated
using (true);

create policy "Teachers can add resource comments"
on public.resource_comments for insert to authenticated
with check (teacher_id = auth.uid());

create policy "Teachers can edit their resource comments"
on public.resource_comments for update to authenticated
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

create policy "Teachers can delete their resource comments"
on public.resource_comments for delete to authenticated
using (teacher_id = auth.uid());

create policy "Signed-in teachers can read resource approvals"
on public.resource_approvals for select to authenticated
using (true);

create policy "Teachers can approve resources"
on public.resource_approvals for insert to authenticated
with check (teacher_id = auth.uid());

create policy "Teachers can remove their resource approval"
on public.resource_approvals for delete to authenticated
using (teacher_id = auth.uid());

create trigger resource_comments_set_updated_at
before update on public.resource_comments
for each row execute function public.set_updated_at();

do $$
begin
  alter publication supabase_realtime add table public.resource_comments;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.resource_approvals;
exception
  when duplicate_object then null;
end
$$;

comment on table public.resource_comments is
  'Teacher discussion attached to a resource. Never include learner names or private classroom records.';

comment on table public.resource_approvals is
  'One teacher approval per resource, similar to an endorsement rather than an official curriculum verification.';
