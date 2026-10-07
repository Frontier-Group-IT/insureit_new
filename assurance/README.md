# INSUREIT Internal Production Assurance

This directory is the evidence index for INSUREIT's internal production-certification program.

The objective is to discover weaknesses, remediate them, retest them, freeze a certification release, run full internal security/reliability/performance assurance, then submit that exact release to independent third-party testing.

## Evidence principles
- Never store secrets, auth tokens, raw KYC/customer PII, real document contents or exploit payloads here.
- Merge is not deployment; migration commit is not migration application; OTA publish is not installed-device verification.
- A planned test is not a PASS.
- A finding closes only after remediation and direct retest.
- Production mutation is not used merely to prove a weakness when configuration/source evidence is sufficient.

## Current files
- `findings/WEAKNESS_REGISTER.md` — evidence-backed weaknesses and remediation/retest status.
- `tests/MASTER_TEST_REGISTER.md` — each executed test and its result.

## Current audit state
Stage 1 — Internal Weakness Discovery: **IN PROGRESS**.
