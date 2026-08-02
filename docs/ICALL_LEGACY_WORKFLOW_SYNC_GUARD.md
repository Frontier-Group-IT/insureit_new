# iCall Legacy Workflow Synchronization Guard

> Added: 2026-08-02

This note records the required behavior for synchronizing iCall training/exam status into INSUREIT without corrupting manually imported legacy POSP/MISP history.

## Business rule

Legacy/existing POSP and MISP onboarding captures five manually selected historical facts:

1. Training status
2. Exam status
3. Agreement status
4. IIB file-upload status
5. IIB registration status

These selections are not required to form a strictly linear combination. They describe the source record as entered by the user. The effective account position is always calculated from the earliest unfinished required stage.

Examples:

- Training completed + Exam in progress + Agreement sent + IIB uploaded = `exam_in_progress`.
- Training pending + IIB registered remains at Training and must not become active.
- Full activation requires Training completed, Exam passed, Agreement signed, IIB file uploaded, and IIB registration registered.

## iCall synchronization rule

For legacy child applications:

- Manual legacy selections remain the baseline and are not deleted or overwritten in `draft_data` or `raw_data`.
- Existing stored progress is retained.
- iCall may advance Training or Exam when it provides stronger evidence.
- iCall must not move the imported account backward.
- Agreement and IIB history must not be erased by Training/Exam synchronization.
- Legacy child application status remains `approved`; `registration_status` represents the effective workflow position.
- Fully registered accounts remain completed and cannot regress.

For new onboarding:

- Live iCall Training/Exam status continues to drive the normal workflow.
- New Partner/POSP and Partner/MISP identity-generation rules are unchanged.

## Authorization rule

Every iCall launch, registration, and status-sync action must validate both:

- the user's intermediary-management capability; and
- access to the specific intermediary application ID.

The implementation is in:

- `apps/web-portal/app/intermediaries/applications/icall-training-actions.ts`

Primary implementation commit:

- `c80b3b3b39009707de524f6a85e99dfbcdc2a8ef`

## Verification case discovered

Fresh legacy Business Partner/MISP test:

- Partner ID: `PT00006`
- MISP ID: `SIB/2026/05/0006`
- Manual Training: completed
- Manual Exam: in progress
- Manual Agreement: sent
- Manual IIB upload: uploaded
- Manual IIB registration: submission in progress

Expected effective registration status: `exam_in_progress`.

A status sync must preserve that outcome even when iCall currently reports Training in progress and no Exam result.

## Verification status

The source change is committed. No claim is made here that it has been deployed or verified against the live Supabase/Vercel environment. After deployment, rerun iCall sync on the fresh legacy MISP and verify application, profile, assignment, and registration records remain aligned.