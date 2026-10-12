# Customer Login Premium Insurance redesign — 2026-10-12

## User-approved direction
The approved reference image is the generated highway design `/mnt/data/insureit_highway_protection_login.png` (local ChatGPT session artifact, **not currently a public website asset**). Desktop: navy highway/trucks hero on left with welcome heading and three benefit cards; white OTP login card at right; fixed +91 input; navy Send OTP; mint signup panel and small trust-footer. Mobile: single column, readable hero and form.

## Implementation
Branch: `ui/customer-premium-login-20261012`.
Changed Customer Web login page presentation using Tailwind CSS, semantic components and Lucide icons. Reused the existing canonical CustomerLoginForm and BrandLockup. Authenticator behavior remains unchanged: signInWithOtp shouldCreateUser=false, verifyOtp SMS, customer-role and active-profile checks, secure Customer session API, then /customer/home. Signup points to /customer/signup. No migrations, RLS, APIs, native mobile code or build artifacts.

## Important artwork gap — blocks exact visual acceptance
The exact generated highway background PNG **is not in the repository**. The connected GitHub editing API supports UTF-8 source file writes and base64 blob upload, but the ChatGPT-generated local PNG cannot currently be transferred through that connector. The committed page uses the **CSS navy/sky gradient as a temporary background**, not a misleading replacement image. The user asked for the same image, therefore this work must **not** be called pixel-exact or fully completed until that asset is transferred into `apps/web-portal/public/assets/customer-login/` and the hero background is wired to it. Once available, the hero should use the approved PNG with responsive positioning and hide duplicate baked-in UI text where applicable; ideally supply a clean photo-only derivative of that reference for semantic HTML overlay.

## Testing, release, rollback
The new `customer-premium-login-regression.mjs` is integrated into Verify web portal GitHub Actions. Validate latest CI typecheck, lint, production build, and full regression workflow. Inspect real responsive browser layouts at desktop/tablet/mobile and verify an authenticated OTP journey using a safe account before release. No deployment or merge approved by merely preparing this branch. Revert PR to restore prior login; no DB rollback needed.
