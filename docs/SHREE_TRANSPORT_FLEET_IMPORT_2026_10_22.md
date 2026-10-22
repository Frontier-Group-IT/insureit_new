# Shree Transport external fleet import — Phase 1 (2026-10-22)

- Target customer: CUST-20260918045120352 (existing Shree Transport master).
- Source: four-page customer fleet PDF, 202 chassis; 192 with registration numbers and 10 unregistered.
- Compared against live master fleet 104 vehicles by normalized chassis: **101 already linked**, **101 new candidates**.
- Global vehicles-table chassis check for the 101 candidates: **no matches belonging to other customers**.
- All 10 unregistered vehicles in source are already included in the 101 master-linked records.
- **Not yet done:** compare RC numbers against ALL vehicles globally, and obtain AuthBridge Detailed RC responses for the 101 candidates.
- Never import all 202 or modify the 101 existing vehicles by default.
- Import stage must insist on successful Detailed RC 372, with source-vs-provider chassis/engine/owner mismatch review. Failures queued for review, not saved automatically.
- Preserve AuthBridge transaction ID and fetch timestamp. Reuse server-only gateway and vehicle_rc_lookup_cache, not browser secrets.
- Full field preview includes vehicle technical, permit, fitness, PUC, road tax, insurer where supplied.
- Store as external/customer-fleet vehicles; don't create an internal insurance policy from provider RC data.
- Existing repository bulk endpoint only supports one RC per request. Limit concurrency, stagger calls and checkpoint progress.
- No API calls have been made and no vehicle database records have been inserted in this phase.
- The new utility external-fleet-import-preflight.ts is a pure, read-only reusable gate; next phase builds persistent staged batch and controlled review/save workflow.
