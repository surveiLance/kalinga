create policy "Signed-in teachers can read deliberately shared resource files"
on storage.objects for select to authenticated
using (
  bucket_id = 'teacher-resources'
  and exists (
    select 1
    from public.resources
    where resources.storage_path = storage.objects.name
      and resources.visibility = 'shared'
  )
);

comment on policy "Signed-in teachers can read deliberately shared resource files" on storage.objects is
  'A teacher resource file becomes readable to other authenticated teachers only after its resource record is explicitly marked shared.';

do $$
begin
  alter publication supabase_realtime add table public.resources;
exception
  when duplicate_object then null;
end
$$;
