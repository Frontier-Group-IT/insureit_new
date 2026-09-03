-- Keep the claim-documents bucket aligned with the claim upload workflows.
update storage.buckets
set
  file_size_limit = 52428800,
  allowed_mime_types = array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/x-matroska',
    'video/x-msvideo'
  ]
where id = 'claim-documents';
