create table public.gabay_rate_limits (
  teacher_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.gabay_rate_limits enable row level security;

create policy "Teachers can read their own Gabay usage"
on public.gabay_rate_limits for select to authenticated
using (teacher_id = auth.uid());

create trigger gabay_rate_limits_set_updated_at
before update on public.gabay_rate_limits
for each row execute function public.set_updated_at();

-- Counts one Gabay request against a fixed window and reports whether it is allowed.
-- Security definer so the counter cannot be edited from the browser: the only write
-- path is this function, and it always counts against the caller's own auth uid.
create or replace function public.claim_gabay_request(window_seconds integer, max_requests integer)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  window_start timestamptz;
  used integer;
begin
  if caller is null then
    raise exception 'Sign in is required';
  end if;
  if window_seconds <= 0 or max_requests <= 0 then
    raise exception 'Invalid rate limit configuration';
  end if;

  insert into public.gabay_rate_limits (teacher_id, window_started_at, request_count)
  values (caller, now(), 0)
  on conflict (teacher_id) do nothing;

  select gabay_rate_limits.window_started_at, gabay_rate_limits.request_count
    into window_start, used
  from public.gabay_rate_limits
  where gabay_rate_limits.teacher_id = caller
  for update;

  if window_start + make_interval(secs => window_seconds) <= now() then
    window_start := now();
    used := 0;
  end if;

  if used >= max_requests then
    return query select false, greatest(1, ceil(extract(epoch from (window_start + make_interval(secs => window_seconds)) - now()))::integer);
    return;
  end if;

  update public.gabay_rate_limits
  set window_started_at = window_start, request_count = used + 1
  where gabay_rate_limits.teacher_id = caller;

  return query select true, 0;
end;
$$;

revoke all on function public.claim_gabay_request(integer, integer) from public;
grant execute on function public.claim_gabay_request(integer, integer) to authenticated;

comment on table public.gabay_rate_limits is
  'Per-teacher Gabay request counter. Written only by public.claim_gabay_request so a browser cannot reset its own quota.';

comment on function public.claim_gabay_request(integer, integer) is
  'Counts one Gabay request against a fixed window for the calling teacher and returns whether it is allowed.';
