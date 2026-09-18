import "server-only";

import { getSarvamRenewalCampaignState } from "@/lib/sarvam-campaign-lifecycle";
import { getSarvamRenewalOperationalPolicy } from "@/lib/sarvam-renewal-operational-policy";
import { isSarvamRenewalCallingEnabled } from "@/lib/sarvam-renewal-call";

export type SarvamPartnerDispatchReadiness = {
  ready: boolean;
  reason:
    | "ready"
    | "disabled"
    | "outside_calling_window"
    | "campaign_paused"
    | "campaign_terminal"
    | "campaign_unavailable";
  message: string;
  campaignState: "scheduled" | "active" | "paused" | "ended" | "cancelled" | "unknown";
};

export async function getSarvamPartnerDispatchReadiness(): Promise<SarvamPartnerDispatchReadiness> {
  if (!isSarvamRenewalCallingEnabled()) {
    return {
      ready: false,
      reason: "disabled",
      message: "AI renewal calling is disabled by INSUREIT administration.",
      campaignState: "unknown",
    };
  }

  const policy = getSarvamRenewalOperationalPolicy();
  if (!policy.withinCallingWindow) {
    return {
      ready: false,
      reason: "outside_calling_window",
      message: `AI calling is available between ${policy.start} and ${policy.end} (${policy.timeZone}).`,
      campaignState: "unknown",
    };
  }

  const campaign = await getSarvamRenewalCampaignState();
  if (!campaign.ok) {
    return {
      ready: false,
      reason: "campaign_unavailable",
      message: "AI calling is temporarily unavailable while INSUREIT verifies the approved voice campaign.",
      campaignState: campaign.status,
    };
  }

  if (campaign.status === "paused") {
    return {
      ready: false,
      reason: "campaign_paused",
      message: "AI calling is temporarily paused by INSUREIT administration.",
      campaignState: campaign.status,
    };
  }

  if (campaign.status === "ended" || campaign.status === "cancelled") {
    return {
      ready: false,
      reason: "campaign_terminal",
      message: "The approved AI renewal campaign is no longer available for new calls.",
      campaignState: campaign.status,
    };
  }

  if (campaign.status !== "active" && campaign.status !== "scheduled") {
    return {
      ready: false,
      reason: "campaign_unavailable",
      message: "AI calling is temporarily unavailable while the approved voice campaign is being prepared.",
      campaignState: campaign.status,
    };
  }

  return {
    ready: true,
    reason: "ready",
    message: campaign.status === "active" ? "AI calling is available." : "AI calling is ready and scheduled for the approved campaign window.",
    campaignState: campaign.status,
  };
}
