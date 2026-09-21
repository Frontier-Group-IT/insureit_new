import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { createVoiceCampaignFromWorkbook } from "@/lib/voice-campaigns";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedProfile(await getServerAccessToken());
  const viewer = auth.profile;

  if (
    !viewer?.id ||
    viewer.role !== "it_super_user" ||
    !(await hasEffectiveCapability(viewer, "manage_system", "approve"))
  ) {
    return NextResponse.redirect(new URL("/access-denied", request.url), 303);
  }

  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File) || !file.name) {
      throw new Error("Select the campaign Excel file.");
    }

    const result = await createVoiceCampaignFromWorkbook({
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
      fileName: file.name,
      fileBuffer: await file.arrayBuffer(),
      requestedByAuthUserId: viewer.id,
    });

    return NextResponse.redirect(
      new URL(
        "/system/voice-integration/campaigns/" + result.campaignId + "?auto_enrich=1",
        request.url,
      ),
      303,
    );
  } catch (error) {
    const target = new URL("/system/voice-integration/campaigns/new", request.url);
    target.searchParams.set(
      "error",
      error instanceof Error ? error.message.slice(0, 200) : "Could not create campaign.",
    );
    return NextResponse.redirect(target, 303);
  }
}
