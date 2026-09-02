drop policy if exists "Teachers own their learners" on public.learners;
create policy "Teachers own their learners"
on public.learners
for all
using (
  teacher_id = auth.uid()
  and exists (
    select 1 from public.classes
    where classes.id = learners.class_id
      and classes.teacher_id = auth.uid()
  )
)
with check (
  teacher_id = auth.uid()
  and exists (
    select 1 from public.classes
    where classes.id = learners.class_id
      and classes.teacher_id = auth.uid()
  )
);

drop policy if exists "Teachers own their lesson plans" on public.lesson_plans;
create policy "Teachers own their lesson plans"
on public.lesson_plans
for all
using (
  teacher_id = auth.uid()
  and exists (
    select 1 from public.classes
    where classes.id = lesson_plans.class_id
      and classes.teacher_id = auth.uid()
  )
)
with check (
  teacher_id = auth.uid()
  and exists (
    select 1 from public.classes
    where classes.id = lesson_plans.class_id
      and classes.teacher_id = auth.uid()
  )
);

drop policy if exists "Teachers own their attendance" on public.attendance_records;
create policy "Teachers own their attendance"
on public.attendance_records
for all
using (
  teacher_id = auth.uid()
  and exists (
    select 1 from public.classes
    where classes.id = attendance_records.class_id
      and classes.teacher_id = auth.uid()
  )
  and exists (
    select 1 from public.learners
    where learners.id = attendance_records.learner_id
      and learners.class_id = attendance_records.class_id
      and learners.teacher_id = auth.uid()
  )
)
with check (
  teacher_id = auth.uid()
  and exists (
    select 1 from public.classes
    where classes.id = attendance_records.class_id
      and classes.teacher_id = auth.uid()
  )
  and exists (
    select 1 from public.learners
    where learners.id = attendance_records.learner_id
      and learners.class_id = attendance_records.class_id
      and learners.teacher_id = auth.uid()
  )
);

comment on policy "Teachers own their classes" on public.classes is
  'Authenticated teachers can only read and mutate rows carrying their own auth user id.';

comment on policy "Teachers own their lesson plans" on public.lesson_plans is
  'A plan must belong to both the authenticated teacher and one of that teacher''s classes.';
