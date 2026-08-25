# Production Release Checkpoint — 2026-08-25

Purpose: establish a fresh, auditable production-release provenance checkpoint from the exact current `main` state after PR #631 and subsequent documentation-only commits.

- Base main at checkpoint creation: `a88cf596e4416db45c982f19076188c504ec071b`
- Intended release includes merged PR #631: **Compact Policy Intake queue header and KPI cards**.
- This checkpoint changes documentation only.
- No application behavior, database schema/data, permissions, OCR logic, onboarding workflow, mobile runtime, Expo publishing, or production configuration is changed by this checkpoint.
- Production deployment must still use the protected `.github/workflows/deploy-production.yml` workflow with a successful `Verify web portal` pull-request run for this checkpoint commit.
- A successful deploy-hook request is not proof of a successful Vercel deployment; final Vercel readiness must be verified separately.
