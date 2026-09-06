import { NextRequest, NextResponse } from "next/server";
import {
  recordPartnerExternalRenewalInteraction,
  type PartnerExternalRenewalInteractionType,
  type PartnerExternalRenewalOutcome,
} from "@/lib/partner-external-renewals";

const INTERACTION_TYPES = new Set<PartnerExternalRenewalInteractionType>(["call", "whatsapp", "note", "follow_up"]);
const OUTCOMES = new Set<PartnerExternalRenewalOutcome>([
  "contact_attempted",
  "connected",
  "interested",
  "quote_requested",
  "quote_shared",
  "follow_up",
  "renewed_elsewhere",
  "invalid_contact",
  "do_not_contact",
  "lost",
]);

function indiaLocalToIso(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) throw new Error("Invalid follow-up date.");
  const parsed = new Date(trimmed + ":00+05:30");
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid follow-up date.");
  return parsed.toISOString();
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await request.formData();
  const interactionType = String(form.get("interaction_type") ?? "") as PartnerExternalRenewalInteractionType;
  const outcome = String(form.get("outcome") ?? "") as PartnerExternalRenewalOutcome;
  const note = String(form.get("note") ?? "").trim();
  const followUpRaw = String(form.get("follow_up_at") ?? "");

  const target = new URL("/partner/renewals/external/" + encodeURIComponent(id), request.url);

  try {
    if (!INTERACTION_TYPES.has(interactionType)) throw new Error("Choose an interaction type.");
    if (!OUTCOMES.has(outcome)) throw new Error("Choose an outcome.");
    if (note.length > 4000) throw new Error("Notes must be 4,000 characters or less.");

    const followUpAt = indiaLocalToIso(followUpRaw);
    if (outcome === "follow_up" && !followUpAt) throw new Error("Choose the next follow-up date and time.");

    await recordPartnerExternalRenewalInteraction({
      opportunityId: id,
      interactionType,
      outcome,
      note,
      followUpAt,
    });
    target.searchParams.set("saved", "1");
  } catch (error) {
    target.searchParams.set("error", error instanceof Error ? error.message.slice(0, 180) : "Could not save the interaction.");
  }

  return NextResponse.redirect(target, 303);
}
