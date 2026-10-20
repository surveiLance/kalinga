\set ON_ERROR_STOP on
create or replace function pg_temp.assert_true(label text, condition boolean)
returns void language plpgsql as $$ begin
  if condition is distinct from true then raise exception 'FAIL %', label; end if;
  raise notice 'ok %', label;
end $$;
create or replace function pg_temp.assert_denied(label text, statement text)
returns void language plpgsql as $$ declare denied boolean := false; begin
  begin execute statement; exception when insufficient_privilege or check_violation or raise_exception then denied := true; end;
  perform pg_temp.assert_true(label, denied);
end $$;

select set_config('request.jwt.claim.sub','',false);
select pg_temp.assert_true('guest access starts disabled', not (public.guest_access_capabilities()->>'enabled')::boolean);
select pg_temp.assert_denied('no session cannot enroll', $$select public.complete_guest_setup('Ana')$$);
update public.guest_configuration set enabled = true;
insert into auth.users(id, is_anonymous, raw_user_meta_data) values
 ('aaaa0000-0000-0000-0000-000000000001', true, '{"is_anonymous":false,"display_name":"Ana"}'),
 ('aaaa0000-0000-0000-0000-000000000002', true, '{"display_name":"Ana"}'),
 ('aaaa0000-0000-0000-0000-000000000003', true, '{}'),
 ('cccc0000-0000-0000-0000-000000000001', false, '{}');
alter table public.profiles disable trigger profiles_set_mention_tag;
update public.profiles set mention_tag='@guest_aaaa0000000000000000000000000003' where id='cccc0000-0000-0000-0000-000000000001';
alter table public.profiles enable trigger profiles_set_mention_tag;
insert into public.teacher_discussions(author_id,author_name,title,body) values
 ('11111111-1111-1111-1111-111111111111','Teacher Ana','Public fixture','Discussion body');
insert into public.classes(id,teacher_id,name) values
 ('bbbb0000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Private class');
insert into public.learners(class_id,teacher_id,display_name,grade_level) values('bbbb0000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Fictional learner','3');
insert into public.lesson_plans(class_id,teacher_id,title) values('bbbb0000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Private lesson');
insert into storage.buckets(id,name) values('teacher-resources','teacher-resources') on conflict(id) do nothing;
insert into storage.objects(bucket_id,name) values('teacher-resources','11111111-1111-1111-1111-111111111111/shared.pdf');
insert into public.resources(owner_id,title,visibility,storage_path) values('11111111-1111-1111-1111-111111111111','Shared PDF','shared','11111111-1111-1111-1111-111111111111/shared.pdf');
grant usage on schema public, auth, storage to authenticated, anon;
grant select, insert, update, delete on all tables in schema public, storage to authenticated;
grant select on public.resources to anon;
set role authenticated;
select set_config('request.jwt.claim.sub','aaaa0000-0000-0000-0000-000000000001',false);
select pg_temp.assert_true('forged metadata does not approve a guest', not public.guest_has_access());
select pg_temp.assert_true('unenrolled guest cannot read discussions', (select count(*) from public.teacher_discussions)=0);
select pg_temp.assert_true('unenrolled guest cannot read own profile', (select count(*) from public.profiles)=0);
select pg_temp.assert_true('unenrolled guest cannot read shared resource or file', (select count(*) from public.resources)=0 and (select count(*) from storage.objects)=0);
select pg_temp.assert_denied('cannot self-grant membership', $$insert into public.guest_memberships(user_id,display_name,mention_tag) values(auth.uid(),'Fake','@guest_fake')$$);
select pg_temp.assert_denied('blank name rejected', $$select public.complete_guest_setup('   ')$$);
select public.complete_guest_setup('  Ana   Reyes  ');
select pg_temp.assert_true('guest setup normalizes name', public.guest_session_status()->>'display_name'='Ana Reyes');
select pg_temp.assert_true('enrolled guest has access', public.guest_has_access());
select pg_temp.assert_true('guest can see shared discussions', (select count(*) from public.teacher_discussions)>0);
select pg_temp.assert_true('enrolled guest can read shared PDF', (select count(*) from storage.objects)=1);
insert into public.teacher_discussions(author_id,author_name,title,body) values(auth.uid(),'Impersonation','First guest question','Question body');
select pg_temp.assert_true('guest author name is canonical', (select author_name='Teacher Ana Reyes' from public.teacher_discussions where author_id=auth.uid()));
select pg_temp.assert_true('private classes remain isolated', (select count(*) from public.classes)=0);
select public.complete_guest_setup('Other name');
select pg_temp.assert_true('retry preserves canonical name', public.guest_session_status()->>'display_name'='Ana Reyes');
update public.profiles set display_name='Impersonation', mention_tag='@ana_reyes_1111' where id=auth.uid();
select pg_temp.assert_true('profile edits cannot replace guest identity', (select display_name='Ana Reyes' and mention_tag like '@guest_%' from public.profiles where id=auth.uid()));
select set_config('request.jwt.claim.sub','aaaa0000-0000-0000-0000-000000000002',false);
select public.complete_guest_setup('Ana Reyes');
insert into public.teacher_discussions(author_id,author_name,title,body) values(auth.uid(),'Fake author','Guest fixture','Body for mention directory');
select pg_temp.assert_true('same-name guest has a distinct handle', (select count(distinct mention_tag) from public.community_teacher_tags(array['aaaa0000-0000-0000-0000-000000000001'::uuid,auth.uid()]))=2);
select pg_temp.assert_true('private learners remain isolated', (select count(*) from public.learners)=0);
select pg_temp.assert_true('private plans remain isolated', (select count(*) from public.lesson_plans)=0);
select set_config('request.jwt.claim.sub','aaaa0000-0000-0000-0000-000000000003',false);
select public.complete_guest_setup('Ana');
select pg_temp.assert_true('forced handle collision resolves safely', public.guest_session_status()->>'mention_tag'<>'@guest_aaaa0000000000000000000000000003');
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select pg_temp.assert_true('permanent access preserved', public.guest_has_access() and (select count(*) from public.classes)=1);
select pg_temp.assert_denied('permanent user cannot claim guest namespace', $$update public.profiles set mention_tag='@guest_ffffffffffffffffffffffffffffffff' where id=auth.uid()$$);
reset role;
update public.guest_memberships set active=false where user_id='aaaa0000-0000-0000-0000-000000000002';
set role authenticated;
select set_config('request.jwt.claim.sub','aaaa0000-0000-0000-0000-000000000002',false);
select pg_temp.assert_true('revocation blocks data access', not public.guest_has_access() and (select count(*) from public.teacher_discussions)=0);
select pg_temp.assert_denied('retry cannot undo revocation', $$select public.complete_guest_setup('Ana')$$);
reset role;
select set_config('request.jwt.claim.sub','',false);
set role anon;
select pg_temp.assert_true('unauthenticated users cannot read shared resources', (select count(*) from public.resources)=0);
reset role;
