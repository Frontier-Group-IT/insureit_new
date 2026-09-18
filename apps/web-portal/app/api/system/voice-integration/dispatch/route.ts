import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { assertSarvamRenewalCampaignDispatchable } from "@/lib/sarvam-campaign-lifecycle";
import { startItSuperUserExternalRenewalVoiceAttempt } from "@/lib/sarvam-it-dispatch";
import {
  markExternalRenewalVoiceSubmissionFailed,
  markExternalRenewalVoiceSubmitted,
} from "@/lib/partner-external-renewal-voice";
import { assertSarvamRenewalCallingWindow } from "@/lib/sarvam-renewal-operational-policy";
import {
  isSarvamRenewalCallingEnabled,
  SarvamRenewalSubmissionError,
  streamExternalRenewalToSarvam,
} from "@/lib/sarvam-renewal-call";

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedProfile(await getServerAccessToken());
  const viewer = auth.profile;

  if (!viewer?.id || viewer.role !== "it_super_user" || !(await hasEffectiveCapability(viewer, "manage_system", "approve"))) {
    return NextResponse.redirect(new URL("/access-denied", request.url), 303);
  }

  const form = await request.formData();
  const opportunityId = String(form.get("opportunity_id") ?? "").trim();
  const target = new URL("/system/voice-integration", request.url);

  if (!opportunityId) {
    target.searchParams.set("dispatch", "failed");
    target.searchParams.set("dispatch_error", "Opportunity is required.");
    return NextResponse.redirect(target, 303);
  }

  if (!isSarvamRenewalCallingEnabled()) {
    target.searchParams.set("dispatch", "failed");
    target.searchParams.set("dispatch_error", "AI calling is disabled.");
    return NextResponse.redirect(target, 303);
  }

  let localAttemptId: string | null = null;
  let providerRequestStarted = false;

  try {
    assertSarvamRenewalCallingWindow();
    await assertSarvamRenewalCampaignDispatchable();

    const context = await startItSuperUserExternalRenewalVoiceAttempt({
      opportunityId,
      requestedByAuthUserId: viewer.auth_user_id ?? viewer.id,
    });
    localAttemptId = context.attempt_id;

    providerRequestStarted = true;
    const submission = await streamExternalRenewalToSarvam(context);

    await markExternalRenewalVoiceSubmitted({
      attemptId: context.attempt_id,
      campaignId: submission.campaignId,
      cohortId: submission.response.cohort_id,
      appId: process.env.SARVAM_RENEWAL_APP_ID?.trim() || null,
    });

    target.searchParams.set("dispatch", "queued");
    return NextResponse.redirect(target, 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI call could not be queued.";

    if (
      localAttemptId &&
      (!providerRequestStarted || (error instanceof SarvamRenewalSubmissionError && error.definitelyRejected))
    ) {
      try {
        await markExternalRenewalVoiceSubmissionFailed(localAttemptId, message);
      } catch {
        // Preserve the original operator-facing error. A later reconciliation can
        // repair the attempt if provider submission bookkeeping itself fails.
      }
    }

    target.searchParams.set("dispatch", "failed");
    target.searchParams.set("dispatch_error", message.slice(0, 180));
    return NextResponse.redirect(target, 303);
  }
}
