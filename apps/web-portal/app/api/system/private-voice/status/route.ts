import { NextResponse } from "next/server";

import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { getPrivateVoiceRuntimeConfig, privateVoiceOutboundAllowed } from "@/lib/private-voice/config";

export async function GET() {
  const auth = await getAuthenticatedProfile(await getServerAccessToken());
  const viewer = auth.profile;

  if (!viewer?.id || viewer.role !== "it_super_user" || !(await hasEffectiveCapability(viewer, "manage_system", "approve"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = getPrivateVoiceRuntimeConfig();

  return NextResponse.json({
    phase: 1,
    workspace_enabled: config.workspaceEnabled,
    outbound_enabled: config.outboundEnabled,
    shadow_enabled: config.shadowEnabled,
    outbound_allowed: privateVoiceOutboundAllowed(config),
    providers: {
      telephony: config.telephonyProvider,
      stt: config.sttProvider,
      llm: config.llmProvider,
      tts: config.ttsProvider,
    },
    live_calling_implemented: false,
    sarvam_fallback_isolated: true,
  });
}
