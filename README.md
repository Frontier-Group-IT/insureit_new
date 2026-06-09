# ClaimBridge CV

ClaimBridge CV is the first version of a commercial vehicle insurance claim assistance platform. This release intentionally includes only the Supabase database foundation and the admin web portal shell. It does not include a customer mobile app.

## What is included

- `apps/web-portal` — Next.js, TypeScript, and Tailwind CSS admin portal.
- `supabase/migrations` — PostgreSQL schema, enums, indexes, RLS policies, and private storage bucket setup.
- `supabase/functions` — Reserved for future Supabase Edge Functions.
- `docs` — Business flow, database schema, and security notes.
- `.env.example` — Environment variable template.

## Local setup

1. Install Node.js 20 or newer.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy environment variables:

   ```bash
   cp .env.example .env.local
   ```

4. Fill in the browser-safe Supabase values:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
   ```

5. Run the portal:

   ```bash
   npm run dev
   ```

## Supabase setup

1. Create a Supabase project.
2. Install the Supabase CLI.
3. Link your project:

   ```bash
   supabase link --project-ref your-project-ref
   ```

4. Apply migrations:

   ```bash
   supabase db push
   ```

5. In Supabase Auth, create users and add an `app_role` claim or user metadata value matching one of:
   - `super_admin`
   - `admin`
   - `manager`
   - `claim_processor`
   - `field_executive`
   - `customer`

## Security principles

- The frontend may use `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Never put the Supabase `service_role` key in frontend code or a `NEXT_PUBLIC_` variable.
- Claim documents are stored in a private bucket named `claim-documents`.
- Access to sensitive tables is controlled with Supabase Row Level Security.
- Important system changes should be recorded in `audit_logs`.

## Deployment notes

- Deploy `apps/web-portal` to Vercel or another Next.js host.
- Configure production environment variables in the hosting provider.
- Run Supabase migrations against production before enabling production traffic.
- Add server-side actions or Supabase Edge Functions later for privileged workflows that require the service role key.
