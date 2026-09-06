import { NextRequest, NextResponse } from "next/server";
import { linkPartnerExternalRenewalPolicyIntake } from "@/lib/partner-external-renewals";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let intakeId = "";
  try {
    const body = await request.json() as { intake_id?: string };
    intakeId = String(body.intake_id ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  if (!intakeId) {
    return NextResponse.json({ ok: false, error: "Policy Intake is required." }, { status: 400 });
  }

  try {
    const link = await linkPartnerExternalRenewalPolicyIntake({ opportunityId: id, intakeId });
    return NextResponse.json({ ok: true, link }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not link the Policy Intake.";
    return NextResponse.json({ ok: false, error: message.slice(0, 180) }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
