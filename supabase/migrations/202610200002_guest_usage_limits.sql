create table public.guest_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  window_start timestamptz not null,
  used integer not null default 0 check(used>=0),
  primary key(user_id,kind,window_start)
);
create table public.guest_ai_days (
  usage_date date primary key,
  used integer not null default 0 check(used>=0)
);
alter table public.guest_usage enable row level security;
alter table public.guest_ai_days enable row level security;
revoke all on public.guest_usage,public.guest_ai_days from anon,authenticated;

create function public.claim_guest_usage(usage_kind text,usage_limit integer,window_seconds integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare claimed integer; start_at timestamptz;
begin
  start_at := to_timestamp(floor(extract(epoch from now())/window_seconds)*window_seconds);
  insert into public.guest_usage(user_id,kind,window_start,used) values(auth.uid(),usage_kind,start_at,1)
    on conflict(user_id,kind,window_start) do update set used=public.guest_usage.used+1
    where public.guest_usage.used<usage_limit returning used into claimed;
  return claimed is not null;
end $$;
revoke all on function public.claim_guest_usage(text,integer,integer) from public;

create function public.enforce_guest_usage() returns trigger
language plpgsql security definer set search_path='' as $$
declare kind text; cap integer; seconds integer;
begin
  if not exists(select 1 from auth.users where id=auth.uid() and is_anonymous) then return new; end if;
  if not public.guest_has_access() then raise exception 'Guest setup is required'; end if;
  if tg_table_schema='storage' then
    if new.bucket_id<>'teacher-resources' then return new; end if;
    if (new.metadata->>'mimetype') is distinct from 'application/pdf' or
      not coalesce(new.metadata->>'size','') ~ '^[0-9]{1,10}$' then raise exception 'Choose a PDF up to 20 MB'; end if;
    if (new.metadata->>'size')::bigint>20971520 then raise exception 'The PDF must be 20 MB or smaller'; end if;
    kind := 'uploads'; cap := 10; seconds := 3600;
  elsif tg_table_name='teacher_discussions' then kind := 'questions'; cap := 5; seconds := 3600;
  else kind := 'replies'; cap := 20; seconds := 300;
  end if;
  if not public.claim_guest_usage(kind,cap,seconds) then raise exception 'Guest % limit reached. Please try later.',kind; end if;
  return new;
end $$;
revoke all on function public.enforce_guest_usage() from public;
create trigger guest_usage before insert on public.teacher_discussions for each row execute function public.enforce_guest_usage();
create trigger guest_usage before insert on public.teacher_replies for each row execute function public.enforce_guest_usage();
create trigger guest_usage before insert on public.resource_comments for each row execute function public.enforce_guest_usage();
create trigger guest_usage before insert on storage.objects for each row execute function public.enforce_guest_usage();
-- Updates cannot turn an accepted PDF into a different type or enlarge it.
create function public.validate_guest_file_update() returns trigger
language plpgsql security definer set search_path='' as $$ begin
  if exists(select 1 from auth.users where id=auth.uid() and is_anonymous) and new.bucket_id='teacher-resources' then
    if not public.guest_has_access() or new.metadata->>'mimetype' is distinct from 'application/pdf'
      or not coalesce(new.metadata->>'size','') ~ '^[0-9]{1,10}$' then raise exception 'Choose a PDF up to 20 MB'; end if;
    if (new.metadata->>'size')::bigint>20971520 then raise exception 'The PDF must be 20 MB or smaller'; end if;
  end if;
  return new;
end $$;
revoke all on function public.validate_guest_file_update() from public;
create trigger guest_file_update before update on storage.objects for each row execute function public.validate_guest_file_update();
do $$ begin
  if exists(select 1 from storage.buckets where id='teacher-resources' and public) then raise exception 'teacher-resources must be private before guest access is deployed'; end if;
end $$;
update storage.buckets set file_size_limit=20971520,allowed_mime_types=array['application/pdf'] where id='teacher-resources';

create function public.claim_guest_gabay_request() returns jsonb
language plpgsql security definer set search_path='' as $$
declare moment timestamptz:=now(); start_at timestamptz; day_at timestamptz; global_used integer; personal_day integer; personal_window integer; cap integer; retry integer;
begin
  if not public.guest_has_access() then raise exception 'Guest setup is required'; end if;
  if exists(select 1 from auth.users where id=auth.uid() and not is_anonymous) then return jsonb_build_object('allowed',true,'retry_after_seconds',0); end if;
  perform pg_advisory_xact_lock(hashtextextended('kalinga-guest-ai-quota',0));
  start_at := to_timestamp(floor(extract(epoch from moment)/300)*300);
  day_at := date_trunc('day',moment at time zone 'UTC') at time zone 'UTC';
  select used into global_used from public.guest_ai_days where usage_date=(moment at time zone 'UTC')::date;
  select used into personal_day from public.guest_usage where user_id=auth.uid() and kind='ai-day' and window_start=day_at;
  select used into personal_window from public.guest_usage where user_id=auth.uid() and kind='ai-window' and window_start=start_at;
  select daily_ai_limit into cap from public.guest_configuration where singleton;
  if cap is null then raise exception 'Guest AI is unavailable'; end if;
  if coalesce(global_used,0)>=cap or coalesce(personal_day,0)>=20 then retry := ceil(extract(epoch from day_at+interval '1 day'-moment));
  elsif coalesce(personal_window,0)>=5 then retry := ceil(extract(epoch from start_at+interval '300 seconds'-moment)); end if;
  if retry is not null then return jsonb_build_object('allowed',false,'retry_after_seconds',greatest(1,retry)); end if;
  insert into public.guest_ai_days(usage_date,used) values((moment at time zone 'UTC')::date,1)
    on conflict(usage_date) do update set used=public.guest_ai_days.used+1;
  insert into public.guest_usage(user_id,kind,window_start,used) values(auth.uid(),'ai-day',day_at,1),(auth.uid(),'ai-window',start_at,1)
    on conflict(user_id,kind,window_start) do update set used=public.guest_usage.used+1;
  return jsonb_build_object('allowed',true,'retry_after_seconds',0);
end $$;
revoke all on function public.claim_guest_gabay_request() from public;
grant execute on function public.claim_guest_gabay_request() to authenticated;
