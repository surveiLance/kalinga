-- Inserted AFTER the pre-existing migrations but BEFORE the two new ones, so the
-- backfill in 202609070002 has real history to convert.

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ana@example.com', '{"display_name":"Ana Reyes"}'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com', '{"display_name":"Ben Cruz"}'),
  ('33333333-3333-3333-3333-333333333333', 'carla@example.com', '{"display_name":"Carla Lim"}');

-- Ana asks a question; Ben replies to it; Carla replies mentioning Ana.
insert into public.teacher_discussions (id, author_id, author_name, title, body) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Teacher Ana Reyes', 'How do you group grade 3 and 4 for fractions?', 'Looking for a multigrade approach that works without printing.');

insert into public.teacher_replies (id, discussion_id, author_id, author_name, body) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Teacher Ben Cruz', 'I use bottle caps for both grades.'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Teacher Carla Lim', 'Agree with Ben. @ana_reyes_1111 try the market activity.');

-- Ana had already read Ben's reply under the old client-side scheme.
insert into public.notification_reads (teacher_id, notification_id) values
  ('11111111-1111-1111-1111-111111111111', 'reply:bbbbbbbb-0000-0000-0000-000000000001');
