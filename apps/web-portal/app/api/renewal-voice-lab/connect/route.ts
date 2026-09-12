import { NextResponse } from "next/server";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RENEWAL_AGENT_INSTRUCTIONS = `You are INSUREIT's browser-test motor insurance renewal specialist.

This is a private role-play with an INSUREIT team member. You are not calling a real customer. The simulated prospect is Rajesh Sharma, vehicle Mahindra Scorpio N, registration MP20 AB 1234, current insurer ICICI Lombard, policy expiry 24 September 2026, previous IDV about INR 14.2 lakh, and last premium INR 19,450.

Conversation style:
- Sound like a skilled Indian renewal executive, not an IVR or scripted bot.
- Speak warm, natural Hindi, Hinglish, or English based on the user's language and switch naturally when they switch.
- Keep most turns to one or two short sentences.
- Ask one question at a time.
- Let the user interrupt. Do not insist on finishing a speech.
- Use brief human acknowledgements when appropriate, but avoid repetitive filler.
- Be calm, respectful, persuasive, and consultative rather than pushy.
- At the start, identify INSUREIT, mention the renewal purpose and expiry date, and ask permission to continue.

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

export async function POST(request: Request) {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);

  if (!profile?.id || profile.role !== "intermediary" || !profile.is_active) {
    return NextResponse.json({ error: "Partner authentication is required for the voice lab." }, { status: 403 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured for this environment yet." },
      { status: 503 },
    );
  }

  const sdp = await request.text();
  if (!sdp || sdp.length > 200_000) {
    return NextResponse.json({ error: "Invalid browser audio session offer." }, { status: 400 });
  }

  const model = process.env.OPENAI_VOICE_MODEL?.trim() || "gpt-realtime-1.5";
  const session = {
    type: "realtime",
    model,
    instructions: RENEWAL_AGENT_INSTRUCTIONS,
  };

  const form = new FormData();
  form.append("sdp", sdp);
  form.append("session", JSON.stringify(session));

  let upstream: Response;
  try {
    upstream = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "Could not reach the realtime voice service." }, { status: 502 });
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.error("renewal_voice_lab_connect_failed", {
      status: upstream.status,
      detail: detail.slice(0, 500),
    });
    return NextResponse.json(
      { error: "The realtime voice service could not start this session." },
      { status: 502 },
    );
  }

  const answerSdp = await upstream.text();
  return new Response(answerSdp, {
    status: 200,
    headers: {
      "Content-Type": "application/sdp",
      "Cache-Control": "no-store, private",
    },
  });
}
