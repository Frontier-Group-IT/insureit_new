-- Align the policy-documents storage bucket with the application-wide
-- 15 MB maximum for policy copies.
update storage.buckets
set file_size_limit = 15728640
where id = 'policy-documents';
