# Operations Business Performance reference layout — 2026-10-13

Status: implemented in separate branch; PR/CI/merge/deployment/live visual verification pending.

- Target: Operations Dashboard Business Performance card in `apps/web-portal/app/dashboard-v2/dashboard-view.tsx`.
- User reference: four KPI columns on a single horizontal row; KPI headings at the top-left; values below; Policies MTD total on left and four business-line counts on right; subtle dividers; compact height.
- Change: replaced outer CSS grid with a non-wrapping flex row using explicit 25% widths for the four commercial KPI columns, preserving horizontal overflow for smaller viewports. For non-commercial data, the two existing KPI columns each use 50% width.
- Preserved: all existing policy and financial calculations, filter, Business reports link, business mix/details section, existing policy-breakdown counts.
- Verification required: CI typecheck/lint/build and browser check on Cloudflare after separately approved merge/deployment. No production/database/mobile changes; no APK/AAB.
