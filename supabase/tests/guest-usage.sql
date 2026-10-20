\set ON_ERROR_STOP on
-- Helpers are session-local; this file also runs independently of guest-access.sql.
create or replace function pg_temp.assert_true(label text, condition boolean) returns void language plpgsql as $$ begin
 if condition is distinct from true then raise exception 'FAIL %',label; end if; raise notice 'ok %',label; end $$;
create or replace function pg_temp.assert_denied(label text, statement text) returns void language plpgsql as $$ declare denied boolean:=false; begin
 begin execute statement; exception when insufficient_privilege or check_violation or raise_exception then denied:=true; end;
 perform pg_temp.assert_true(label,denied); end $$;
select set_config('request.jwt.claim.sub','aaaa0000-0000-0000-0000-000000000003',false);
set role authenticated;
select pg_temp.assert_true('first guest AI call allowed',(public.claim_guest_gabay_request()->>'allowed')::boolean);
do $$ begin for i in 2..5 loop
 perform pg_temp.assert_true('AI window allows through cap',(public.claim_guest_gabay_request()->>'allowed')::boolean);
end loop; end $$;
select pg_temp.assert_true('sixth AI call denied',not (public.claim_guest_gabay_request()->>'allowed')::boolean);
select pg_temp.assert_true('denied call has retry delay',(public.claim_guest_gabay_request()->>'retry_after_seconds')::integer>0);
reset role;
update public.guest_usage set used=0 where kind='ai-window';
update public.guest_usage set used=20 where kind='ai-day' and user_id='aaaa0000-0000-0000-0000-000000000003';
set role authenticated;
select pg_temp.assert_true('daily personal AI cap enforced',not (public.claim_guest_gabay_request()->>'allowed')::boolean);
reset role;
update public.guest_usage set used=0 where kind='ai-day';
update public.guest_usage set window_start=window_start-interval '1 day',used=5 where kind='ai-window';
set role authenticated;
select pg_temp.assert_true('expired AI window resets',(public.claim_guest_gabay_request()->>'allowed')::boolean);
select set_config('request.jwt.claim.sub','aaaa0000-0000-0000-0000-000000000001',false);
select pg_temp.assert_true('another guest has a separate personal cap',(public.claim_guest_gabay_request()->>'allowed')::boolean);
reset role;
select set_config('request.jwt.claim.sub','aaaa0000-0000-0000-0000-000000000003',false);
update public.guest_ai_days set used=200;
set role authenticated;
select pg_temp.assert_true('global guest AI cap enforced',not (public.claim_guest_gabay_request()->>'allowed')::boolean);
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select pg_temp.assert_true('permanent users do not consume guest budget',(public.claim_guest_gabay_request()->>'allowed')::boolean);
select set_config('request.jwt.claim.sub','aaaa0000-0000-0000-0000-000000000002',false);
select pg_temp.assert_denied('revoked guest cannot claim AI',$$select public.claim_guest_gabay_request()$$);
select set_config('request.jwt.claim.sub','aaaa0000-0000-0000-0000-000000000003',false);
do $$ begin for i in 1..5 loop
 insert into public.teacher_discussions(author_id,author_name,title,body) values(auth.uid(),'Fake','Usage fixture','Body');
end loop; end $$;
select pg_temp.assert_denied('sixth question denied',$$insert into public.teacher_discussions(author_id,author_name,title,body) values(auth.uid(),'Fake','Too many questions','Body')$$);
do $$ declare discussion uuid; begin
 select id into discussion from public.teacher_discussions limit 1;
 for i in 1..20 loop insert into public.teacher_replies(discussion_id,author_id,author_name,body) values(discussion,auth.uid(),'Fake','Reply'); end loop;
end $$;
select pg_temp.assert_denied('twenty-first reply denied',$$insert into public.teacher_replies(discussion_id,author_id,author_name,body) values((select id from public.teacher_discussions limit 1),auth.uid(),'Fake','Reply')$$);
reset role;
create policy "Local upload fixture" on storage.objects for insert to authenticated with check(bucket_id='teacher-resources' and (storage.foldername(name))[1]=auth.uid()::text);
set role authenticated;
select pg_temp.assert_denied('guest cannot upload non-PDF',$$insert into storage.objects(bucket_id,name,metadata) values('teacher-resources',auth.uid()||'/bad.txt','{"mimetype":"text/plain","size":10}')$$);
select pg_temp.assert_denied('guest cannot upload over 20 MB',$$insert into storage.objects(bucket_id,name,metadata) values('teacher-resources',auth.uid()||'/large.pdf','{"mimetype":"application/pdf","size":20971521}')$$);
do $$ begin for i in 1..10 loop
 insert into storage.objects(bucket_id,name,metadata) values('teacher-resources',auth.uid()||'/'||i||'.pdf','{"mimetype":"application/pdf","size":100}');
end loop; end $$;
select pg_temp.assert_denied('eleventh upload denied',$$insert into storage.objects(bucket_id,name,metadata) values('teacher-resources',auth.uid()||'/extra.pdf','{"mimetype":"application/pdf","size":100}')$$);
reset role;
drop policy "Local upload fixture" on storage.objects;
-- Leave one shared AI slot for the concurrent test in verify-migrations.sh.
update public.guest_ai_days set used=199;
update public.guest_usage set used=0 where kind in ('ai-window','ai-day');
update public.guest_usage set used=4 where kind='questions' and user_id='aaaa0000-0000-0000-0000-000000000003';
update public.guest_usage set used=9 where kind='uploads' and user_id='aaaa0000-0000-0000-0000-000000000003';
create function public.test_guest_race(kind text) returns boolean language plpgsql security invoker as $$ begin
 if kind='question' then
  insert into public.teacher_discussions(author_id,author_name,title,body) values(auth.uid(),'Fake','Race question','Body');
 else
  insert into storage.objects(bucket_id,name,metadata) values('teacher-resources',auth.uid()||'/race-'||gen_random_uuid()||'.pdf','{"mimetype":"application/pdf","size":100}');
 end if;
 return true;
exception when raise_exception then return false;
end $$;
