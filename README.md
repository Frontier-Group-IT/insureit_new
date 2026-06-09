# ClaimBridge CV

ClaimBridge CV is the first version of a commercial vehicle insurance claim assistance platform. This release intentionally includes only the Supabase database foundation and the admin web portal. It does **not** include a customer mobile app.

## What is included

- `apps/web-portal` — Next.js, TypeScript, Tailwind CSS, and Supabase Auth admin portal.
- `supabase/migrations` — PostgreSQL schema, enums, indexes, RLS policies, Auth profile trigger, and private storage bucket setup.
- `supabase/functions` — Reserved for future Supabase Edge Functions.
- `docs` — Business flow, database schema, and security notes.
- `.env.example` — Environment variable template.

## Exact npm install command

Run this from the repository root:

```bash
npm install
```

## Exact command to run the admin portal locally

Run this from the repository root after installing dependencies and creating `.env.local`:

```bash
npm run dev
```

This starts the `apps/web-portal` workspace with Next.js. By default, the portal is available at `http://localhost:3000`.

## Environment variables

Create `apps/web-portal/.env.local` for local development, or configure the same variables in your hosting provider for deployment. You can start from `apps/web-portal/.env.example` or the root `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Only use the service role key in trusted server-side environments. Do not add it to `apps/web-portal/.env.local` unless you later implement server-only code that needs it, and never prefix it with `NEXT_PUBLIC_`:

```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-for-server-only-operations
```

## Exact Supabase setup steps

1. Create a Supabase project.
2. Install and authenticate the Supabase CLI:

   ```bash
   npm install -g supabase
   supabase login
   ```

3. Link this repository to your Supabase project:

   ```bash
   supabase link --project-ref your-project-ref
   ```

4. Apply the migration:

   ```bash
   supabase db push
   ```

5. Confirm that the private Storage bucket `claim-documents` exists in Supabase Storage.
6. Create admin users in Supabase Auth.
7. Set each user's `app_role` in `app_metadata` to one of:
   - `super_admin`
   - `admin`
   - `manager`
   - `claim_processor`
   - `field_executive`
   - `customer`
8. Sign in at `http://localhost:3000/login` with a Supabase Auth user.

## Security principles

- The frontend may use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Never put the Supabase `service_role` key in frontend code or a `NEXT_PUBLIC_` variable.
- Claim documents are stored in a private bucket named `claim-documents`.
- Access to sensitive tables is controlled with Supabase Row Level Security.
- Important system changes should be recorded in `audit_logs`.

## Deployment notes

- Deploy `apps/web-portal` to Vercel or another Next.js host.
- Configure production environment variables in the hosting provider.
- Run Supabase migrations against production before enabling production traffic.
- Add server-side actions or Supabase Edge Functions later for privileged workflows that require the service role key.
