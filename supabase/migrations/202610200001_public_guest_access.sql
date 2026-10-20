create table public.guest_configuration (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  daily_ai_limit integer not null default 200 check (daily_ai_limit between 1 and 10000)
);
insert into public.guest_configuration(singleton) values(true);
alter table public.guest_configuration enable row level security;

create table public.guest_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  mention_tag text not null unique check (mention_tag ~ '^@guest_[a-f0-9]{32}$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.guest_memberships enable row level security;

create function public.guest_has_access() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from auth.users u where u.id=auth.uid() and
    (not u.is_anonymous or exists(select 1 from public.guest_memberships g where g.user_id=u.id and g.active)));
$$;
revoke all on function public.guest_has_access() from public;
grant execute on function public.guest_has_access() to anon, authenticated;

create function public.guest_access_capabilities() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('version',1,'enabled',coalesce((select enabled from public.guest_configuration where singleton),false));
$$;
revoke all on function public.guest_access_capabilities() from public;
grant execute on function public.guest_access_capabilities() to anon, authenticated;

create function public.guest_session_status() returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce((select jsonb_build_object('enrolled',true,'user_id',user_id,'display_name',display_name,'mention_tag',mention_tag,'active',active)
    from public.guest_memberships where user_id=auth.uid()),jsonb_build_object('enrolled',false,'active',false));
$$;
revoke all on function public.guest_session_status() from public;
grant execute on function public.guest_session_status() to authenticated;

create or replace function public.set_profile_mention_tag() returns trigger
language plpgsql security definer set search_path='' as $$
declare member public.guest_memberships;
begin
  select * into member from public.guest_memberships where user_id=new.id;
  if found then
    new.display_name := member.display_name;
    new.mention_tag := member.mention_tag;
  else
    if new.mention_tag ~ '^@guest_[a-f0-9]{32}$' then
      if tg_op='INSERT' or new.mention_tag is distinct from old.mention_tag then raise exception 'Guest handles are reserved'; end if;
    elsif new.mention_tag is null or (tg_op='UPDATE' and new.display_name is distinct from old.display_name) then
      new.mention_tag := public.teacher_mention_tag(new.display_name,new.id);
    end if;
  end if;
  return new;
end $$;

create function public.complete_guest_setup(display_name text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare member public.guest_memberships; clean_name text; tag text;
begin
  if not exists(select 1 from auth.users where id=auth.uid() and is_anonymous) then raise exception 'A guest session is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  select * into member from public.guest_memberships where user_id=auth.uid();
  if found then
    if not member.active then raise exception 'Guest access is unavailable'; end if;
    return public.guest_session_status();
  end if;
  if not coalesce((select enabled from public.guest_configuration where singleton),false) then raise exception 'Guest testing is not available yet'; end if;
  if display_name is null or display_name ~ '[[:cntrl:]]' then raise exception 'Enter a name without control characters'; end if;
  clean_name := btrim(regexp_replace(display_name,'[[:space:]]+',' ','g'));
  if char_length(clean_name) not between 1 and 80 then raise exception 'Enter a name of 1 to 80 characters'; end if;
  -- Serialize handle allocation against other enrollments, including forced collisions.
  perform pg_advisory_xact_lock(hashtextextended('kalinga-guest-handle',0));
  tag := '@guest_' || replace(auth.uid()::text,'-','');
  while exists(select 1 from public.profiles where mention_tag=tag) or exists(select 1 from public.guest_memberships where mention_tag=tag) loop
    tag := '@guest_' || replace(gen_random_uuid()::text,'-','');
  end loop;
  insert into public.guest_memberships(user_id,display_name,mention_tag) values(auth.uid(),clean_name,tag);
  insert into public.profiles(id,display_name,mention_tag) values(auth.uid(),clean_name,tag)
    on conflict(id) do update set display_name=excluded.display_name,mention_tag=excluded.mention_tag;
  return public.guest_session_status();
end $$;
revoke all on function public.complete_guest_setup(text) from public;
grant execute on function public.complete_guest_setup(text) to authenticated;

create function public.community_teacher_tags(teacher_ids uuid[])
returns table(id uuid,display_name text,mention_tag text,is_guest boolean)
language sql stable security definer set search_path='' as $$
  select p.id,p.display_name,p.mention_tag,u.is_anonymous
  from public.profiles p join auth.users u on u.id=p.id
  where public.guest_has_access() and cardinality(teacher_ids)<=100 and p.id=any(teacher_ids)
    and (not u.is_anonymous or exists(select 1 from public.guest_memberships g where g.user_id=p.id and g.active))
    and (p.id=auth.uid() or exists(select 1 from public.teacher_discussions d where d.author_id=p.id)
      or exists(select 1 from public.teacher_replies r where r.author_id=p.id)
      or exists(select 1 from public.resource_comments c where c.teacher_id=p.id));
$$;
revoke all on function public.community_teacher_tags(uuid[]) from public;
grant execute on function public.community_teacher_tags(uuid[]) to authenticated;

create function public.canonical_guest_author() returns trigger
language plpgsql security definer set search_path='' as $$
declare member public.guest_memberships;
begin
  if exists(select 1 from auth.users where id=auth.uid() and is_anonymous) then
    select * into member from public.guest_memberships where user_id=auth.uid() and active;
    if not found then raise exception 'Guest setup is required'; end if;
    if tg_table_name='resource_comments' then new.teacher_name := 'Teacher ' || member.display_name;
    else new.author_name := 'Teacher ' || member.display_name; end if;
  end if;
  return new;
end $$;
create trigger guest_author before insert or update on public.teacher_discussions for each row execute function public.canonical_guest_author();
create trigger guest_author before insert or update on public.teacher_replies for each row execute function public.canonical_guest_author();
create trigger guest_author before insert or update on public.resource_comments for each row execute function public.canonical_guest_author();

do $$ declare relation text; begin
  foreach relation in array array['profiles','classes','learners','lesson_plans','attendance_records','resources','resource_bookmarks',
    'gabay_conversations','gabay_messages','teacher_discussions','teacher_replies','resource_comments','resource_approvals',
    'notification_reads','teacher_notifications','gabay_rate_limits'] loop
    execute format('create policy "Guest setup is required" on public.%I as restrictive for all to public using ((select public.guest_has_access())) with check ((select public.guest_has_access()))',relation);
  end loop;
end $$;
create policy "Guest setup is required for teacher files" on storage.objects as restrictive for all to public
using (bucket_id<>'teacher-resources' or (select public.guest_has_access()))
with check (bucket_id<>'teacher-resources' or (select public.guest_has_access()));

revoke all on function public.canonical_guest_author() from public;
revoke all on table public.guest_configuration, public.guest_memberships from anon,authenticated;
