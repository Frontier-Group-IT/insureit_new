# Renewal Voice Agent Handoff

> Updated: 2026-09-13 IST
>
> Source of truth for the internal browser Renewal Voice Lab, interaction-learning database, selectable voices/personas, and rollout state. Never store API keys, raw microphone recordings, customer credentials, OTPs, Aadhaar/PAN/bank data, or production customer transcripts in this file.

## Current baseline

The authenticated browser lab is available at `/partner/renewals/voice-lab`. It uses server-side `OPENAI_API_KEY`, OpenAI Realtime WebRTC calls, a route-scoped `Permissions-Policy` allowing `microphone=(self)`, and sample prospect data only. The lab has already been tested far enough to establish that route auth, microphone access, server API routing and OpenAI Realtime connectivity work after API credits are available.

## Voice-quality learning feature

**MERGED / SCHEMA APPLIED + VERIFIED / WEB PRODUCTION DEPLOYMENT STILL PENDING FINAL VERIFICATION.**

Feature PR: **#1756**  
Feature head: `e153fa436326ac5a291b3e9e4dfb83e5a3364709`  
Canonical Verify web portal run: **34711959071 — success**  
Merge commit: `fbd3f2e458ab663646b7ae01282d011d134322c6`

Schema-verification follow-up PR: **#1757**  
Schema-verification head: `cd0e817d71afdac753a44e376532190548e35bd0`  
Canonical Verify web portal run: **34712406344 — success**  
Merge commit: `42b1591703621a7b5629978f361ae89b81da539c`  
Schema verification run: **34712577685 — success**

The feature adds:

- selectable Realtime voices before each session;
- selectable agent persona/type before each session;
- stronger voice/prosody instructions so punctuation is not performed as exaggerated spoken pauses;
- explicit `gpt-transcribe` input transcription for English/Hindi code-switching;
- transcript-turn persistence for both tester and agent;
- session metadata including model, selected voice/persona, duration and status;
- post-session ratings for naturalness, pronunciation and pacing plus free-text feedback;
- controlled learning context for later sessions: high-rated agent turns may be used as positive style examples, while low-rated written feedback is supplied as behavior to avoid;
- no raw audio recording storage in this phase.

### Supported lab voices

The UI intentionally exposes a quality-focused subset of the current Realtime built-in voices: `marin`, `cedar`, `coral`, `sage`, `verse`, and `alloy`. `marin` is the default. OpenAI's current Realtime schema also documents other built-in voices, but keeping the first selector compact makes comparison easier.

### Agent types

- `natural_sales` — warm, confident, consultative renewal executive;
- `calm_advisor` — slower, patient, reassurance-first advisor;
- `relationship_manager` — familiar Indian Hinglish relationship style;
- `concise_professional` — crisp, polished, efficient specialist.

Voice and persona are fixed for an active Realtime session and may be changed before starting the next test.

## Interaction database

Migration: `supabase/migrations/20260912235900_renewal_voice_agent_learning.sql`

Tables:

- `renewal_voice_agent_sessions`
- `renewal_voice_agent_turns`

**APPLIED + VERIFIED in production Supabase.** The tables and required grants were verified by workflow run **34712577685**, and migration version `20260912235900` is recorded in `supabase_migrations.schema_migrations`. RLS restricts session/turn access to the authenticated active non-customer profile that created the lab session. Raw audio is intentionally not persisted.

Deployment-learning note: PR #1756 initially reached `main` before this migration had a repository-owned schema verification workflow, so the protective production deployment gate correctly blocked Vercel release. PR #1757 added the schema verification/repair workflow. Do not bypass this protection; schema application, migration-history parity and Vercel deployment are separate evidence states.

## What “training” means here

Current OpenAI Realtime models do not support model fine-tuning. Therefore this implementation does **not** claim to fine-tune OpenAI weights. INSUREIT's first learning loop is database-backed interaction memory plus reviewed feedback/in-context examples. Every completed transcript can be retained as evidence, but only interactions marked for learning influence future prompts; high-rated agent turns are positive examples and written low-rated feedback is negative guidance. This avoids blindly reinforcing a bad conversation.

## Main files

- `apps/web-portal/app/partner/renewals/voice-lab/renewal-voice-lab.tsx`
- `apps/web-portal/app/api/renewal-voice-lab/connect/route.ts`
- `apps/web-portal/app/api/renewal-voice-lab/interactions/route.ts`
- `apps/web-portal/lib/renewal-voice-agent.ts`
- `supabase/migrations/20260912235900_renewal_voice_agent_learning.sql`
- `.github/workflows/verify-renewal-voice-learning-schema.yml`

## Safety boundaries

- Browser lab remains sample-data role-play only.
- No live customer call is placed.
- No CRM/customer/policy table is updated.
- No quote, premium, IDV, insurer offer or coverage term may be invented.
- Do not collect payment credentials, OTPs, Aadhaar/PAN/bank credentials or passwords.
- Do not retain raw microphone audio in this phase.
- When real-customer telephony is introduced, consent/disclosure, transcript/recording retention, opt-out/DND and authorized insurance handoff requirements must be reviewed separately.

## Continuation checklist

1. Complete and verify the exact Vercel production deployment containing PR #1756/#1757 before describing the new learning controls as production-live.
2. Run several controlled browser tests across at least two voices/personas; submit ratings and concrete pronunciation/pacing feedback.
3. Confirm a subsequent session receives learning context without copying prospect-specific facts.
4. Compare voice/persona combinations using the stored ratings rather than relying on one subjective call.
5. Only after the browser voice quality is acceptable should this learning architecture be connected to real renewal opportunities or telephony.
