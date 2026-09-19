import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { enrichExternalRenewalOpportunity } from "@/lib/external-renewal-authbridge";
import { hasEffectiveCapability } from "@/lib/effective-permissions";

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
    target.searchParams.set("rc_enrichment", "failed");
    target.searchParams.set("rc_enrichment_error", "Opportunity is required.");
    return NextResponse.redirect(target, 303);
  }

  try {
    const result = await enrichExternalRenewalOpportunity(opportunityId);
    target.searchParams.set("rc_enrichment", result.status === "ready" ? "ready" : "no_data");
  } catch (error) {
    target.searchParams.set("rc_enrichment", "failed");
    target.searchParams.set("rc_enrichment_error", error instanceof Error ? error.message.slice(0, 160) : "RC enrichment failed.");
  }

  return NextResponse.redirect(target, 303);
}
