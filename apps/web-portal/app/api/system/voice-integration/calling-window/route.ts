import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import {
  SARVAM_CALLING_WINDOW_CLOCK_RE,
  SARVAM_CALLING_WINDOW_SETTINGS_ID,
} from "@/lib/sarvam-renewal-operational-policy";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const TIME_ZONE = "Asia/Kolkata";

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedProfile(await getServerAccessToken());
  const viewer = auth.profile;

  if (!viewer?.id || viewer.role !== "it_super_user" || !(await hasEffectiveCapability(viewer, "manage_system", "approve"))) {
    return NextResponse.redirect(new URL("/access-denied", request.url), 303);
  }

  const form = await request.formData();
  const start = String(form.get("window_start") ?? "").trim();
  const end = String(form.get("window_end") ?? "").trim();
  const target = new URL("/system/voice-integration", request.url);

  if (!SARVAM_CALLING_WINDOW_CLOCK_RE.test(start) || !SARVAM_CALLING_WINDOW_CLOCK_RE.test(end)) {
    target.searchParams.set("window_update", "failed");
    target.searchParams.set("window_error", "Enter a valid start and end time.");
    target.searchParams.set("edit_window", "1");
    return NextResponse.redirect(target, 303);
  }

  if (start === end) {
    target.searchParams.set("window_update", "failed");
    target.searchParams.set("window_error", "Start and end time must be different.");
    target.searchParams.set("edit_window", "1");
    return NextResponse.redirect(target, 303);
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("sarvam_voice_operational_settings")
    .upsert(
      {
        id: SARVAM_CALLING_WINDOW_SETTINGS_ID,
        window_start: start,
        window_end: end,
        time_zone: TIME_ZONE,
        updated_by_auth_user_id: viewer.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

  if (error) {
    target.searchParams.set("window_update", "failed");
    target.searchParams.set("window_error", "Calling window could not be saved.");
    target.searchParams.set("edit_window", "1");
    return NextResponse.redirect(target, 303);
  }

  target.searchParams.set("window_update", "saved");
  return NextResponse.redirect(target, 303);
}
