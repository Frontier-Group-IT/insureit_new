import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { freezeApprovedDataset } from "@/lib/private-voice/training-governance";

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedProfile(await getServerAccessToken());
  const viewer = auth.profile;
  if (!viewer?.id || viewer.role !== "it_super_user" || !(await hasEffectiveCapability(viewer, "manage_system", "approve"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await request.formData();
  const notes = String(form.get("notes") ?? "").trim().slice(0, 500);

  try {
    const dataset = await freezeApprovedDataset({ reviewerId: viewer.id, notes });
    return NextResponse.redirect(new URL(`/system/voice-integration/insureit-agent?freeze_state=success&dataset_version=${encodeURIComponent(dataset.version)}`, request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dataset freeze failed.";
    return NextResponse.redirect(new URL(`/system/voice-integration/insureit-agent?freeze_state=failed&freeze_error=${encodeURIComponent(message)}`, request.url), 303);
  }
}
