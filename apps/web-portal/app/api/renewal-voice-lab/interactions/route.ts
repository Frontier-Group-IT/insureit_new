import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  getAuthenticatedProfile,
  getServerAccessToken,
  isAuthorizedProfile,
} from "@/lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InteractionBody = {
  action?: unknown;
  sessionId?: unknown;
  sequenceNo?: unknown;
  role?: unknown;
  transcript?: unknown;
  eventType?: unknown;
  durationSeconds?: unknown;
  naturalnessRating?: unknown;
  pronunciationRating?: unknown;
  pacingRating?: unknown;
  feedback?: unknown;
  useForLearning?: unknown;
};

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function rating(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5 ? Number(value) : null;
}

export async function POST(request: Request) {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!isAuthorizedProfile(profile)) {
    return NextResponse.json({ error: "Active INSUREIT access is required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as InteractionBody | null;
  if (!body || !isUuid(body.sessionId)) {
    return NextResponse.json({ error: "Invalid voice-lab session." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: session, error: sessionError } = await supabase
    .from("renewal_voice_agent_sessions")
    .select("id,status")
    .eq("id", body.sessionId)
    .eq("created_by", profile.id)
    .maybeSingle<{ id: string; status: string }>();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Voice-lab session was not found." }, { status: 404 });
  }

  if (body.action === "turn") {
    const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
    const role = body.role === "agent" || body.role === "customer" ? body.role : null;
    const sequenceNo = Number(body.sequenceNo);
    if (!role || !transcript || transcript.length > 8000 || !Number.isInteger(sequenceNo) || sequenceNo < 1 || sequenceNo > 1000) {
      return NextResponse.json({ error: "Invalid transcript turn." }, { status: 400 });
    }
    if (session.status !== "active") {
      return NextResponse.json({ error: "This voice-lab session is already closed." }, { status: 409 });
    }

    const { error } = await supabase.from("renewal_voice_agent_turns").insert({
      session_id: session.id,
      sequence_no: sequenceNo,
      role,
      transcript,
      event_type: typeof body.eventType === "string" ? body.eventType.slice(0, 120) : null,
    });
    if (error && error.code !== "23505") {
      console.error("renewal_voice_lab_turn_save_failed", { code: error.code });
      return NextResponse.json({ error: "Could not save this transcript turn." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "complete") {
    const durationSeconds = Math.max(0, Math.min(14400, Math.round(Number(body.durationSeconds) || 0)));
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("renewal_voice_agent_sessions")
      .update({ status: "completed", ended_at: now, duration_seconds: durationSeconds, updated_at: now })
      .eq("id", session.id);
    if (error) {
      console.error("renewal_voice_lab_complete_failed", { code: error.code });
      return NextResponse.json({ error: "Could not close the interaction log." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "feedback") {
    const naturalnessRating = rating(body.naturalnessRating);
    const pronunciationRating = rating(body.pronunciationRating);
    const pacingRating = rating(body.pacingRating);
    const feedback = typeof body.feedback === "string" ? body.feedback.trim().slice(0, 2000) : "";
    if (!naturalnessRating || !pronunciationRating || !pacingRating) {
      return NextResponse.json({ error: "Please rate naturalness, pronunciation and pacing from 1 to 5." }, { status: 400 });
    }

    const { error } = await supabase
      .from("renewal_voice_agent_sessions")
      .update({
        naturalness_rating: naturalnessRating,
        pronunciation_rating: pronunciationRating,
        pacing_rating: pacingRating,
        tester_feedback: feedback || null,
        use_for_learning: body.useForLearning !== false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.id);
    if (error) {
      console.error("renewal_voice_lab_feedback_save_failed", { code: error.code });
      return NextResponse.json({ error: "Could not save the voice-quality feedback." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported interaction action." }, { status: 400 });
}
