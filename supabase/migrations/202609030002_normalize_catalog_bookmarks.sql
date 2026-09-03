update public.resource_bookmarks
set resource_id = 'catalog-' || resource_id
where resource_id ~ '^[0-9]+$';
