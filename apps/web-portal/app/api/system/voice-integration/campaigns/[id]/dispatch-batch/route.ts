import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { assertSarvamRenewalCampaignDispatchable } from "@/lib/sarvam-campaign-lifecycle";
import { startItSuperUserExternalRenewalVoiceAttempt } from "@/lib/sarvam-it-dispatch";
import {
  markExternalRenewalVoiceSubmissionFailed,
  markExternalRenewalVoiceSubmitted,
} from "@/lib/partner-external-renewal-voice";
import { assertConfiguredSarvamRenewalCallingWindow } from "@/lib/sarvam-renewal-operational-policy";
import {
  isSarvamRenewalCallingEnabled,
  SarvamRenewalSubmissionError,
  streamExternalRenewalToSarvam,
} from "@/lib/sarvam-renewal-call";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await getAuthenticatedProfile(await getServerAccessToken());
  const viewer = auth.profile;

  if (
    !viewer?.id ||
    viewer.role !== "it_super_user" ||
    !(await hasEffectiveCapability(viewer, "manage_system", "approve"))
  ) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const { id: campaignId } = await context.params;
  const admin = createSupabaseAdminClient();

  try {
    const { data: campaign } = await admin
      .from("voice_campaigns")
      .select("id,status")
      .eq("id", campaignId)
      .maybeSingle<{ id: string; status: string }>();

    if (!campaign || campaign.status !== "running") throw new Error("Campaign is not running.");
    if (!isSarvamRenewalCallingEnabled()) throw new Error("AI calling is disabled.");

    await assertConfiguredSarvamRenewalCallingWindow();
    await assertSarvamRenewalCampaignDispatchable();

    const { data: members, error: memberError } = await admin
      .from("voice_campaign_members")
      .select("id,opportunity_id")
      .eq("campaign_id", campaignId)
      .eq("import_status", "accepted")
      .eq("enrichment_status", "ready")
      .eq("dispatch_status", "pending")
      .order("source_row_number", { ascending: true })
      .limit(3)
      .returns<Array<{ id: string; opportunity_id: string }>>();

    if (memberError) throw new Error("Could not read the campaign dispatch queue.");

    let queued = 0;
    let failed = 0;

    for (const member of members ?? []) {
      let localAttemptId: string | null = null;
      let providerRequestStarted = false;

      try {
        const callContext = await startItSuperUserExternalRenewalVoiceAttempt({
          opportunityId: member.opportunity_id,
          requestedByAuthUserId: viewer.id,
          voiceCampaignId: campaignId,
        });

        localAttemptId = callContext.attempt_id;
        providerRequestStarted = true;

        const submission = await streamExternalRenewalToSarvam(callContext);

        await markExternalRenewalVoiceSubmitted({
          attemptId: callContext.attempt_id,
          campaignId: submission.campaignId,
          cohortId: submission.response.cohort_id,
          appId: process.env.SARVAM_RENEWAL_APP_ID?.trim() || null,
        });

        await admin
          .from("voice_campaign_members")
          .update({
            dispatch_status: "queued",
            dispatch_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", member.id);

        queued += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "AI call could not be queued.";

        if (
          localAttemptId &&
          (!providerRequestStarted ||
            (error instanceof SarvamRenewalSubmissionError && error.definitelyRejected))
        ) {
          try {
            await markExternalRenewalVoiceSubmissionFailed(localAttemptId, message);
          } catch {
            // Preserve the primary failure and let normal reconciliation handle bookkeeping ambiguity.
          }
        }

        await admin
          .from("voice_campaign_members")
          .update({
            dispatch_status: "failed",
            dispatch_error: message.slice(0, 180),
            updated_at: new Date().toISOString(),
          })
          .eq("id", member.id);

        failed += 1;
      }
    }

    const { count: remaining } = await admin
      .from("voice_campaign_members")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("import_status", "accepted")
      .eq("enrichment_status", "ready")
      .eq("dispatch_status", "pending");

    const { count: queuedTotal } = await admin
      .from("voice_campaign_members")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("dispatch_status", "queued");

    const done = (remaining ?? 0) === 0;

    if (done) {
      await admin
        .from("voice_campaigns")
        .update({
          dispatch_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaignId);
    }

    return NextResponse.json({
      processed: (members ?? []).length,
      queued,
      failed,
      remaining: remaining ?? 0,
      queuedTotal: queuedTotal ?? 0,
      done,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Campaign dispatch stopped." },
      { status: 400 },
    );
  }
}
