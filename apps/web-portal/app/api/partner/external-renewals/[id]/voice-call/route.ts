import { NextRequest, NextResponse } from "next/server";

import {
  markExternalRenewalVoiceSubmissionFailed,
  markExternalRenewalVoiceSubmitted,
  startPartnerExternalRenewalVoiceAttempt,
} from "@/lib/partner-external-renewal-voice";
import { assertSarvamRenewalCallingWindow } from "@/lib/sarvam-renewal-operational-policy";
import {
  isSarvamRenewalCallingEnabled,
  normalizeIndiaPhoneForSarvam,
  SarvamRenewalSubmissionError,
  streamExternalRenewalToSarvam,
} from "@/lib/sarvam-renewal-call";

function redirectTarget(request: NextRequest, opportunityId: string) {
  return new URL(`/partner/renewals/external/${encodeURIComponent(opportunityId)}`, request.url);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const target = redirectTarget(request, id);

  if (!isSarvamRenewalCallingEnabled()) {
    target.searchParams.set("voice_error", "AI renewal calling is currently disabled by INSUREIT administration.");
    return NextResponse.redirect(target, 303);
  }

  let localAttemptId: string | null = null;
  let providerRequestStarted = false;

  try {
    assertSarvamRenewalCallingWindow();
    const context = await startPartnerExternalRenewalVoiceAttempt(id);
    localAttemptId = context.attempt_id;

    // Validate before the provider request so malformed imported phone values do not
    // consume a Sarvam cohort record. The provider client performs the same check.
    normalizeIndiaPhoneForSarvam(context.mobile);

    providerRequestStarted = true;
    const streamed = await streamExternalRenewalToSarvam(context);

    await markExternalRenewalVoiceSubmitted({
      attemptId: context.attempt_id,
      campaignId: streamed.campaignId,
      cohortId: streamed.response.cohort_id,
      appId: process.env.SARVAM_RENEWAL_APP_ID?.trim() || null,
    });

    target.searchParams.set("voice_queued", "1");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start the AI renewal call.";
    const providerDefinitelyRejected =
      error instanceof SarvamRenewalSubmissionError && error.definitelyRejected;

    // Release the local active-attempt guard only when the request never reached
    // Sarvam or Sarvam explicitly returned a definitive rejection. Timeout/network/
    // malformed-success responses remain active because the provider may already
    // have accepted the cohort and a second click could create a duplicate call.
    if (localAttemptId && (!providerRequestStarted || providerDefinitelyRejected)) {
      try {
        await markExternalRenewalVoiceSubmissionFailed(localAttemptId, "AI call request was not accepted by the provider.");
      } catch {
        // Preserve the original operator-facing failure. The active-attempt guard
        // prevents duplicate calls if database cleanup itself is unavailable.
      }
    }

    target.searchParams.set("voice_error", message.slice(0, 180));
  }

  return NextResponse.redirect(target, 303);
}
