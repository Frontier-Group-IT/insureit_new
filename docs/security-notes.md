# Security Notes

## Supabase keys

The admin portal can use these browser-safe values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The Supabase `service_role` key bypasses RLS and must never be used in frontend code, committed to Git, or exposed through any `NEXT_PUBLIC_` environment variable. Use it only in trusted server environments such as server-side routes or Supabase Edge Functions.

## Row Level Security

All sensitive tables have RLS enabled. Policies use the `app_role` claim or user metadata value from the authenticated Supabase user. Configure roles carefully during user creation and updates.

## Private claim documents

Claim documents contain sensitive personal, vehicle, accident, and financial information. They must be stored in the private `claim-documents` bucket. Public buckets and public URLs should not be used for claim files.

Use short-lived signed URLs or authenticated download routes when document previews are needed.

## Audit logs

Important changes should create an `audit_logs` row with actor, action, table name, record ID, and before/after JSON. This first migration creates the table; application-level audit insertion should be added as workflows become active.

## Deployment checklist

1. Configure Supabase Auth and role metadata.
2. Run database migrations in staging first.
3. Confirm RLS behavior with test users for each role.
4. Configure production environment variables in the hosting provider.
5. Keep service role usage server-side only.
6. Review storage policies before enabling real document uploads.
