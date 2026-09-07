\set ON_ERROR_STOP on
\pset pager off

create or replace function pg_temp.check(label text, condition boolean, detail text default '')
returns text language sql as $$
  select case when condition then 'ok   ' else 'FAIL ' end || label || case when condition or detail = '' then '' else '  [' || detail || ']' end;
$$;

\echo ''
\echo '=== mention tags ==='
select pg_temp.check('display name becomes a stable @tag on profile insert',
  (select mention_tag from public.profiles where id = '11111111-1111-1111-1111-111111111111') = '@ana_reyes_1111',
  coalesce((select mention_tag from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 'null'));

select pg_temp.check('tag matches the JS teacherMention format',
  public.teacher_mention_tag('Ana Reyes', '9f2c1d4e-0000-0000-0000-000000000000') = '@ana_reyes_9f2c',
  public.teacher_mention_tag('Ana Reyes', '9f2c1d4e-0000-0000-0000-000000000000'));

select pg_temp.check('a Teacher prefix is not doubled',
  public.teacher_mention_tag('Teacher Ana', '11111111-1111-1111-1111-111111111111') = '@ana_1111');

select pg_temp.check('punctuation and spacing collapse the same way as the client',
  public.teacher_mention_tag('Ma. Cristina  Dela-Cruz', '12ab0000-0000-0000-0000-000000000000') = '@ma_cristina_dela_cruz_12ab',
  public.teacher_mention_tag('Ma. Cristina  Dela-Cruz', '12ab0000-0000-0000-0000-000000000000'));

select pg_temp.check('an unusable name still yields a tag',
  public.teacher_mention_tag('!!!', 'abcd0000-0000-0000-0000-000000000000') = '@teacher_abcd');

\echo ''
\echo '=== backfill from existing history ==='
select pg_temp.check('Ben''s reply to Ana''s thread produced a reply notification',
  exists (select 1 from public.teacher_notifications where teacher_id = '11111111-1111-1111-1111-111111111111' and kind = 'reply' and reply_id = 'bbbbbbbb-0000-0000-0000-000000000001'));

select pg_temp.check('Carla''s mention of Ana produced a mention notification',
  exists (select 1 from public.teacher_notifications where teacher_id = '11111111-1111-1111-1111-111111111111' and kind = 'mention' and reply_id = 'bbbbbbbb-0000-0000-0000-000000000002'));

select pg_temp.check('Ana was not notified about her own discussion',
  not exists (select 1 from public.teacher_notifications where teacher_id = '11111111-1111-1111-1111-111111111111' and actor_id = '11111111-1111-1111-1111-111111111111'));

select pg_temp.check('prior read state carried over',
  (select read_at is not null from public.teacher_notifications where reply_id = 'bbbbbbbb-0000-0000-0000-000000000001' and kind = 'reply'));

select pg_temp.check('the unread mention stayed unread',
  (select read_at is null from public.teacher_notifications where reply_id = 'bbbbbbbb-0000-0000-0000-000000000002' and kind = 'mention'));

\echo ''
\echo '=== live triggers ==='
insert into public.teacher_replies (id, discussion_id, author_id, author_name, body)
values ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Teacher Ben Cruz', 'One more idea for you.');

select pg_temp.check('a new reply notifies the thread author',
  exists (select 1 from public.teacher_notifications where teacher_id = '11111111-1111-1111-1111-111111111111' and reply_id = 'bbbbbbbb-0000-0000-0000-000000000003' and kind = 'reply'));

insert into public.teacher_replies (id, discussion_id, author_id, author_name, body)
values ('bbbbbbbb-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Teacher Ben Cruz', 'Also @carla_lim_3333 knows this one.');

select pg_temp.check('a mention notifies the mentioned teacher',
  exists (select 1 from public.teacher_notifications where teacher_id = '33333333-3333-3333-3333-333333333333' and reply_id = 'bbbbbbbb-0000-0000-0000-000000000004' and kind = 'mention'));

insert into public.teacher_replies (id, discussion_id, author_id, author_name, body)
values ('bbbbbbbb-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Teacher Ben Cruz', 'What do you think @ana_reyes_1111 ?');

select pg_temp.check('a reply that also mentions the thread author sends one notification, not two',
  (select count(*) from public.teacher_notifications where teacher_id = '11111111-1111-1111-1111-111111111111' and reply_id = 'bbbbbbbb-0000-0000-0000-000000000005') = 1,
  (select string_agg(kind, ',') from public.teacher_notifications where teacher_id = '11111111-1111-1111-1111-111111111111' and reply_id = 'bbbbbbbb-0000-0000-0000-000000000005'));

insert into public.teacher_replies (id, discussion_id, author_id, author_name, body)
values ('bbbbbbbb-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Teacher Ana Reyes', 'Thanks everyone!');

select pg_temp.check('replying to your own thread notifies nobody',
  not exists (select 1 from public.teacher_notifications where reply_id = 'bbbbbbbb-0000-0000-0000-000000000006'));

insert into public.teacher_replies (id, discussion_id, author_id, author_name, body)
values ('bbbbbbbb-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Teacher Ben Cruz', 'Not tagging @ana_reyes_1111_extra here.');

select pg_temp.check('a longer tag that merely starts with yours does not mention you',
  not exists (select 1 from public.teacher_notifications where teacher_id = '11111111-1111-1111-1111-111111111111' and reply_id = 'bbbbbbbb-0000-0000-0000-000000000007' and kind = 'mention'),
  coalesce((select string_agg(kind, ',') from public.teacher_notifications where reply_id = 'bbbbbbbb-0000-0000-0000-000000000007'), 'none'));

insert into public.teacher_discussions (id, author_id, author_name, title, body)
values ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Teacher Ben Cruz', 'Reading groups for multigrade', 'Curious what @ana_reyes_1111 does for reading.');

select pg_temp.check('a mention in a new discussion notifies',
  exists (select 1 from public.teacher_notifications where teacher_id = '11111111-1111-1111-1111-111111111111' and discussion_id = 'aaaaaaaa-0000-0000-0000-000000000002' and kind = 'mention'));

\echo ''
\echo '=== renaming cannot capture another teacher''s mentions ==='
update public.profiles set display_name = 'Ana Bautista' where id = '11111111-1111-1111-1111-111111111111';
select pg_temp.check('renaming recomputes the tag',
  (select mention_tag from public.profiles where id = '11111111-1111-1111-1111-111111111111') = '@ana_bautista_1111');

update public.profiles set display_name = 'Ana Reyes' where id = '22222222-2222-2222-2222-222222222222';
select pg_temp.check('another teacher taking the old display name gets a different tag',
  (select mention_tag from public.profiles where id = '22222222-2222-2222-2222-222222222222') = '@ana_reyes_2222');

\echo ''
\echo '=== gabay rate limit ==='
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

select pg_temp.check('the first request in a window is allowed',
  (select allowed from public.claim_gabay_request(300, 3)));

select pg_temp.check('requests are allowed up to the cap',
  (select bool_and(allowed) from (select (public.claim_gabay_request(300, 3)).allowed from generate_series(1, 2)) t));

select pg_temp.check('the request past the cap is refused',
  (select allowed from public.claim_gabay_request(300, 3)) = false);

select pg_temp.check('a refusal reports a positive retry delay',
  (select retry_after_seconds from public.claim_gabay_request(300, 3)) > 0,
  (select retry_after_seconds::text from public.claim_gabay_request(300, 3)));

select pg_temp.check('the counter is per teacher, not global',
  (select allowed from (select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false)) s, public.claim_gabay_request(300, 3)));

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
update public.gabay_rate_limits set window_started_at = now() - interval '10 minutes'
where teacher_id = '11111111-1111-1111-1111-111111111111';
select pg_temp.check('an expired window resets the counter',
  (select allowed from public.claim_gabay_request(300, 3)));

select set_config('request.jwt.claim.sub', '', false);
do $$
begin
  perform public.claim_gabay_request(300, 3);
  raise exception 'expected an unauthenticated caller to be rejected';
exception
  when sqlstate 'P0001' then
    if sqlerrm <> 'Sign in is required' then raise; end if;
end $$;
select pg_temp.check('an unauthenticated caller is rejected', true);

\echo ''
\echo '=== row level security still isolates teachers ==='
select pg_temp.check('notifications are readable only by their owner',
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'teacher_notifications' and cmd = 'SELECT' and qual like '%auth.uid()%') = 1);

select pg_temp.check('the rate limit table has no insert or update policy for teachers',
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'gabay_rate_limits' and cmd in ('INSERT', 'UPDATE')) = 0);

select pg_temp.check('claim_gabay_request is executable by authenticated only',
  has_function_privilege('authenticated', 'public.claim_gabay_request(integer, integer)', 'execute')
  and not has_function_privilege('anon', 'public.claim_gabay_request(integer, integer)', 'execute'));
