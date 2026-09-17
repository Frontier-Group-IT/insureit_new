# Sarvam production readiness success — 2026-09-17

This record supplements `docs/SARVAM_VOICE_WORKFLOW_CURRENT_STATE_2026_09_15.md` and `docs/SARVAM_DIAGNOSTIC_EVIDENCE_2026_09_16.md`.

## Production result

After PR #1970 (`Use Sarvam stream validation for readiness`) was merged and deployed to production, the IT Super User ran the normal `/system/voice-integration` **Test Sarvam connection** action against the currently configured production renewal campaign.

Observed result:

- query result: `sarvam_test=ok`;
- provider status: HTTP **422**;
- portal banner: **Sarvam connection verified**;
- readiness state: **Technically ready for controlled test**.

The readiness probe uses the Voice Agents scheduling stream endpoint with `X-API-Key` and deliberately submits an empty `users` array. HTTP 422 is the expected validation rejection and proves the provider accepted authentication, resolved the configured organization/workspace/campaign, and reached normal stream request validation without creating a callable contact.

## What is now proven

1. `X-API-Key` is the working authentication header for the Voice Agents `cohorts/stream` endpoint in this production workspace.
2. The production `SARVAM_ORG_ID`, `SARVAM_WORKSPACE_ID`, and configured `SARVAM_RENEWAL_CAMPAIGN_ID` resolve correctly on the stream API path.
3. The earlier webhook-delivery-list HTTP 500 is isolated to Sarvam's webhook-list backend and is not a blocker for CRM cohort streaming.
4. The older `api-subscription-key` and Bearer auth forms must not be used for real Voice Agents stream submission because they returned HTTP 401 during diagnostics.
5. No phone number, customer identity, or callable contact was submitted by the successful readiness test.

## Next controlled implementation step

The actual Partner `Call with AI` dispatch path may now be changed from the legacy subscription-key/Bearer fallback to the proven `X-API-Key` header for `cohorts/stream`.

Keep the existing safeguards unchanged:

- server-side API key only;
- single-opportunity flow only;
- `user_identifier = local attempt UUID`;
- external-renewal isolation only;
- kill switch `SARVAM_RENEWAL_CALLING_ENABLED`;
- ambiguous provider outcomes remain non-retryable until reconciled;
- no verified Customer/Vehicle/Policy writes;
- campaigns remain PAUSED until the controlled queue-submission verification is complete.

## Security gate before live webhook processing

A webhook token was previously visible in a screenshot during diagnosis. Treat that value as compromised. Rotate `SARVAM_RENEWAL_WEBHOOK_SECRET` in production and update the campaign webhook URL before any live webhook processing or resumed telephony test.

Do not store the secret value in repository files, screenshots, support tickets, or chat messages.
