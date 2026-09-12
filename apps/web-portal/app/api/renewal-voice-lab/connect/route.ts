import { NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  getAuthenticatedProfile,
  getServerAccessToken,
  isAuthorizedProfile,
} from "@/lib/auth-server";
import {
  DEFAULT_RENEWAL_AGENT_TYPE,
  DEFAULT_RENEWAL_VOICE,
  getRenewalAgentSpeed,
  getRenewalAgentStyleInstructions,
  isRenewalAgentType,
  isRenewalVoice,
  type RenewalAgentType,
  type RenewalVoiceId,
} from "@/lib/renewal-voice-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE_RENEWAL_AGENT_INSTRUCTIONS = `You are INSUREIT's browser-test motor insurance renewal specialist.

This is a private role-play with an INSUREIT team member. You are not calling a real customer. The simulated prospect is Rajesh Sharma, vehicle Mahindra Scorpio N, registration MP20 AB 1234, current insurer ICICI Lombard, policy expiry 24 September 2026, previous IDV about INR 14.2 lakh, and last premium INR 19,450.

Conversation style:
- Sound like a skilled Indian renewal executive, not an IVR, announcer, narrator, or scripted bot.
- Speak natural Hindi, Hinglish, or English based on the customer's language, and switch naturally when they switch.
- Keep most turns to one or two short sentences and ask one question at a time.
- Let the customer interrupt immediately. Never insist on finishing a sentence or speech.
- Use short human acknowledgements only when natural; avoid repetitive filler.
- Be calm, respectful, persuasive, consultative, and never pushy.
- At the start, identify INSUREIT, mention the renewal purpose and expiry date, and ask permission to continue.

Voice, pronunciation and prosody:
- Speak in natural thought-groups. Pause because the meaning calls for it, not because the written transcript contains a comma or full stop.
- Never audibly over-punctuate, over-enunciate, or make a long pause at every comma, colon, slash, bracket, or sentence ending.
- Use a conversational Indian-English/Hinglish rhythm, with small natural pauses and varied emphasis. Avoid a newsreader or call-centre-IVR cadence.
- When speaking Hindi/Hinglish, pronounce English insurance terms the way an experienced Indian insurance executive naturally would.
- Say rupee amounts, dates, times, vehicle numbers, insurer names and abbreviations naturally instead of reading symbols or punctuation literally.
- Keep the energy steady. Do not add fake excitement, sing-song intonation, or dramatic emphasis.
- If the customer gives a very short answer, respond briefly instead of filling silence with a long explanation.

Sales behavior:
- First understand the customer's objective or objection before responding.
- Explore whether they care most about price, IDV, coverage, zero-dep, same insurer, or convenience.
- Handle common objections such as dealer quote, high premium, call later, already renewed, car sold, claim last year, WhatsApp request, and spouse/owner approval.
- If the customer asks for a callback, confirm the requested day/time but do not claim it has actually been scheduled in this sandbox.
- If they request a quote, explain that this sandbox has no live insurer quote connection yet.

Hard rules:
- Never invent a premium, quote, discount, insurer offer, IDV, NCB, coverage, add-on, claim acceptance, or policy term.
- Never pretend a payment link, WhatsApp message, CRM update, callback, or policy issuance happened.
- Do not ask for card details, OTPs, Aadhaar, PAN, bank details, passwords, or other sensitive credentials.
- If a live backend fact is unavailable, say you would check the insurer/INSUREIT system in the production version.

Goal for this test:
Create a highly natural, interruption-friendly renewal conversation and demonstrate strong discovery and objection handling without fabricating insurance facts.`;

type OpenAIErrorPayload = {
  error?: {
    type?: string;
    code?: string;
    message?: string;
  };
};

type ConnectBody = {
  sdp?: unknown;
  voice?: unknown;
  agentType?: unknown;
};

type LearningSession = {
  id: string;
  naturalness_rating: number | null;
  pronunciation_rating: number | null;
  pacing_rating: number | null;
  tester_feedback: string | null;
};

type LearningTurn = {
  session_id: string;
  transcript: string;
};

function parseOpenAIError(detail: string): OpenAIErrorPayload["error"] | undefined {
  try {
    return (JSON.parse(detail) as OpenAIErrorPayload).error;
  } catch {
    return undefined;
  }
}

function mapOpenAIError(status: number, detail: string) {
  const error = parseOpenAIError(detail);
  const code = error?.code ?? "";
  const type = error?.type ?? "";

  if (code === "credit_balance_exhausted" || type === "insufficient_quota") {
    return { status: 402, message: "OpenAI API credits are exhausted. Add API billing credits and retry." };
  }
  if (status === 401 || code === "invalid_api_key") {
    return { status: 503, message: "OpenAI API credentials were rejected. Check the server-side OPENAI_API_KEY configuration." };
  }
  if (status === 429) {
    return { status: 429, message: "The realtime voice service is temporarily rate-limited. Wait a moment and retry." };
  }
  if (code === "model_not_found") {
    return { status: 503, message: "The configured realtime voice model is unavailable. Check OPENAI_VOICE_MODEL and retry." };
  }
  return { status: 502, message: "The realtime voice service could not start this session." };
}

function averageRating(session: LearningSession) {
  const ratings = [session.naturalness_rating, session.pronunciation_rating, session.pacing_rating].filter(
    (value): value is number => typeof value === "number",
  );
  if (!ratings.length) return null;
  return ratings.reduce((sum, value) => sum + value, 0) / ratings.length;
}

async function buildLearningContext() {
  const supabase = await createServerSupabaseClient();
  const { data: sessions } = await supabase
    .from("renewal_voice_agent_sessions")
    .select("id,naturalness_rating,pronunciation_rating,pacing_rating,tester_feedback")
    .eq("status", "completed")
    .eq("use_for_learning", true)
    .order("ended_at", { ascending: false })
    .limit(6)
    .returns<LearningSession[]>();

  if (!sessions?.length) return "";

  const positiveIds = sessions
    .filter((session) => (averageRating(session) ?? 0) >= 4)
    .map((session) => session.id);

  let turns: LearningTurn[] = [];
  if (positiveIds.length) {
    const { data } = await supabase
      .from("renewal_voice_agent_turns")
      .select("session_id,transcript")
      .in("session_id", positiveIds)
      .eq("role", "agent")
      .order("created_at", { ascending: false })
      .limit(12)
      .returns<LearningTurn[]>();
    turns = data ?? [];
  }

  const notes = sessions
    .filter((session) => session.tester_feedback?.trim())
    .slice(0, 5)
    .map((session) => {
      const rating = averageRating(session);
      const prefix = rating === null ? "Tester note" : rating >= 4 ? "Positive tester note" : "Improvement note";
      return `- ${prefix} (${rating === null ? "unrated" : `${rating.toFixed(1)}/5`}): ${session.tester_feedback!.trim().slice(0, 350)}`;
    });

  const examples = turns.slice(0, 8).map((turn) => `- ${turn.transcript.trim().slice(0, 300)}`);
  if (!notes.length && !examples.length) return "";

  return `\n\nLearning from previous internal tests:\nUse these only as style evidence. Never copy customer-specific facts and never override the hard insurance rules above. Low-rated feedback describes behavior to avoid.\n${notes.join("\n")}${examples.length ? `\nHigh-rated agent examples:\n${examples.join("\n")}` : ""}`;
}

export async function POST(request: Request) {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  const profileId = profile?.id;

  if (!isAuthorizedProfile(profile) || !profileId) {
    return NextResponse.json({ error: "An active INSUREIT staff or Partner login is required for the voice lab." }, { status: 403 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured for this environment yet." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as ConnectBody | null;
  const sdp = typeof body?.sdp === "string" ? body.sdp : "";
  const voice: RenewalVoiceId = isRenewalVoice(body?.voice) ? body.voice : DEFAULT_RENEWAL_VOICE;
  const agentType: RenewalAgentType = isRenewalAgentType(body?.agentType) ? body.agentType : DEFAULT_RENEWAL_AGENT_TYPE;

  if (!sdp || sdp.length > 200_000) {
    return NextResponse.json({ error: "Invalid browser audio session offer." }, { status: 400 });
  }

  const model = process.env.OPENAI_VOICE_MODEL?.trim() || "gpt-realtime-1.5";
  const supabase = await createServerSupabaseClient();
  const { data: labSession, error: sessionError } = await supabase
    .from("renewal_voice_agent_sessions")
    .insert({
      created_by: profileId,
      model,
      voice,
      agent_type: agentType,
      language_mode: "auto",
      status: "active",
    })
    .select("id")
    .single<{ id: string }>();

  if (sessionError || !labSession) {
    console.error("renewal_voice_lab_session_create_failed", { code: sessionError?.code ?? null });
    return NextResponse.json({ error: "Could not create the interaction log for this voice test." }, { status: 500 });
  }

  const learningContext = await buildLearningContext().catch(() => "");
  const instructions = `${BASE_RENEWAL_AGENT_INSTRUCTIONS}\n\nSelected agent style:\n${getRenewalAgentStyleInstructions(agentType)}${learningContext}`;
  const session = {
    type: "realtime",
    model,
    output_modalities: ["audio"],
    instructions,
    audio: {
      input: {
        noise_reduction: { type: "near_field" },
        transcription: {
          model: "gpt-transcribe",
          languages: ["en", "hi"],
          keywords: ["INSUREIT", "Scorpio N", "ICICI Lombard", "zero dep", "IDV", "NCB"],
        },
      },
      output: {
        voice,
        speed: getRenewalAgentSpeed(agentType),
      },
    },
  };

  const form = new FormData();
  form.append("sdp", sdp);
  form.append("session", JSON.stringify(session));

  let upstream: Response;
  try {
    upstream = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      cache: "no-store",
    });
  } catch {
    await supabase
      .from("renewal_voice_agent_sessions")
      .update({ status: "failed", ended_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", labSession.id);
    return NextResponse.json({ error: "Could not reach the realtime voice service." }, { status: 502 });
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    const mapped = mapOpenAIError(upstream.status, detail);
    const parsed = parseOpenAIError(detail);

    await supabase
      .from("renewal_voice_agent_sessions")
      .update({ status: "failed", ended_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", labSession.id);

    console.error("renewal_voice_lab_connect_failed", {
      status: upstream.status,
      type: parsed?.type ?? null,
      code: parsed?.code ?? null,
    });
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  const answerSdp = await upstream.text();
  return new Response(answerSdp, {
    status: 200,
    headers: {
      "Content-Type": "application/sdp",
      "Cache-Control": "no-store, private",
      "X-Renewal-Voice-Session-Id": labSession.id,
    },
  });
}
