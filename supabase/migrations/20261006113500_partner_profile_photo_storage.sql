begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'partner-profile-photos',
  'partner-profile-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Partner users can read own profile photo" on storage.objects;
create policy "Partner users can read own profile photo"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'partner-profile-photos'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "Partner users can upload own profile photo" on storage.objects;
create policy "Partner users can upload own profile photo"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'partner-profile-photos'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "Partner users can update own profile photo" on storage.objects;
create policy "Partner users can update own profile photo"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'partner-profile-photos'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'partner-profile-photos'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "Partner users can delete own profile photo" on storage.objects;
create policy "Partner users can delete own profile photo"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'partner-profile-photos'
  and split_part(name, '/', 1) = auth.uid()::text
);

commit;
