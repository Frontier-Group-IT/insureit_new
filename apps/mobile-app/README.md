# InsureIt Mobile App

`apps/mobile-app` contains the first Android-focused InsureIt mobile app built with Expo React Native, TypeScript, Expo Router, Supabase Auth, and the Supabase JavaScript client.

## Required environment variables

Create `apps/mobile-app/.env` from `.env.example` and set these browser-safe values:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
```

Never add `SUPABASE_SERVICE_ROLE_KEY` to this app. Mobile clients must use the public anon key and rely on Supabase Auth plus Row Level Security.

## Run locally

From the repository root:

```bash
npm install
npm run dev:mobile
```

Then open the app on an Android emulator or the Expo Go Android app.

## Authentication and role routing

The app signs users in with email and password. After sign in, it reads the logged-in user's `profiles` row and routes by `profiles.role`:

- `customer` → customer home
- `field_executive` → staff dashboard
- `claim_processor` → staff dashboard
- `manager`, `admin`, `super_admin` → staff dashboard

If the profile is missing, inactive, or has an unsupported role, the app shows the access unavailable screen.

## Customer features

The customer flow includes profile review, vehicles, policies, accident reporting, claim document uploads, claim lists, claim detail, status timeline, and support contact information.

## Staff features

The staff flow includes a dashboard, claims list, claim detail, claim status updates, document review, follow-up tasks, customer search, and vehicle search.

## Android testing notes

- Use an Android emulator or physical Android device for the first test pass.
- Verify that email/password sign in works for each supported role.
- Verify that selecting photos and documents prompts for permissions and uploads to the private `claim-documents` bucket.
- Confirm the Supabase project has policies that permit the expected authenticated customer and staff actions.

## APK/AAB next step

When the first app flow is validated, configure EAS Build and run an Android production build:

```bash
npx eas build --platform android
```
