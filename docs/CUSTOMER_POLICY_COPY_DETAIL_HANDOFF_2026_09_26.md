# Customer Policy Copy Detail — 2026-09-26

## Feature state

- Feature PR: #2456
- Feature branch: `ui/customer-policy-copy-section`
- Feature merge commit: `554dc925c5d5478689d640d9d7d9f11d99ce99de`
- Canonical pre-merge verification: `Verify mobile app` #890 and `Verify web portal` #4747 both succeeded.
- Customer production OTA: workflow run #116 succeeded for merge commit `554dc925c5d5478689d640d9d7d9f11d99ce99de`.
- No APK/AAB was created.

## Implemented behavior

Customer App → Policy details now renders a compact **Policy copy** section between the policy-information card and Linked vehicle.

- Internal policies read `policy_documents` by `policy_id`.
- Customer-added external policies read `customer_documents` by `external_policy_id`.
- When a policy copy exists, the section shows its file name and size and exposes a View action.
- View uses a short-lived 10-minute signed URL against the existing private storage bucket.
- When no copy exists, the section shows `Policy copy not uploaded`.
- Customer scoping, existing table RLS, and private-storage policies remain authoritative.
- No database schema, migration, RLS, native dependency, or runtime-version change was introduced.

## Deployment evidence / continuation

The first post-merge `Deploy production to Vercel` run #2164 invoked Vercel and successfully aliased the deployment to `https://portal.insureit.in`, but the GitHub Actions run ended red in a later readiness assertion that expected public `/login` to stop returning HTTP 200. The current repository deployment workflow instead uses the guarded verified-PR provenance flow plus the Vercel production deploy hook. Treat run #2164 as **deployment requested/underlying Vercel deploy completed, GitHub workflow not green**; do not use the red run as final release evidence.

This documentation follow-up exists to preserve the exact state and provide a fresh verified merged-PR provenance point for the current production deployment workflow. After this follow-up is verified and merged, inspect the new `Deploy production to Vercel` run and only label the web deployment successful if that exact run completes successfully. Customer OTA #116 is already successful.
