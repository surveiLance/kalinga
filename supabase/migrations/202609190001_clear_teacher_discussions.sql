-- One-time reset requested after prototype testing exposed unsuitable community posts.
-- Replies and discussion notifications are removed by their existing cascade rules.
delete from public.teacher_discussions;
