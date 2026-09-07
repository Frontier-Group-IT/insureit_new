-- Allow customer incident voice notes in the existing private claim-documents bucket.
-- Preserve the current 50 MB ceiling and all existing claim document/video MIME types.
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
    'video/x-msvideo',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a'
  ]
where id = 'claim-documents';
