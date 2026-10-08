import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { getCustomerWebSession } from "@/lib/customer-web";

export async function POST() {
  const session = await getCustomerWebSession();
  const supabase = await createServerSupabaseClient();

  const profileResult = await supabase.from("profiles").select("phone,email").eq("id", session.user.id).maybeSingle();
  const existing = await supabase
    .from("customer_onboarding_applications")
    .select("id,partner_type,status")
    .eq("profile_id", session.user.id)
    .not("status", "in", "(approved,rejected,cancelled)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.error) return NextResponse.json({ error: "KYC could not be opened." }, { status: 500 });
  if (existing.data) {
    if (["submitted", "under_review"].includes(existing.data.status)) {
      return NextResponse.json({ application: existing.data });
    }
    if (existing.data.partner_type && existing.data.partner_type !== "individual_proprietor") {
      return NextResponse.json({ error: "This KYC application uses a different onboarding type." }, { status: 409 });
    }
    const update = await supabase
      .from("customer_onboarding_applications")
      .update({ partner_type: "individual_proprietor", status: "in_progress" })
      .eq("id", existing.data.id)
      .eq("profile_id", session.user.id)
      .select("id,partner_type,status")
      .single();
    if (update.error || !update.data) return NextResponse.json({ error: "KYC could not be opened." }, { status: 500 });
    return NextResponse.json({ application: update.data });
  }

  const created = await supabase
    .from("customer_onboarding_applications")
    .insert({
      profile_id: session.user.id,
      initiated_by: session.user.id,
      source: "customer_app",
      partner_type: "individual_proprietor",
      status: "in_progress",
      current_step: 1,
      applicant_phone: profileResult.data?.phone ?? null,
      applicant_email: profileResult.data?.email ?? session.user.email ?? null,
      draft_data: {},
    })
    .select("id,partner_type,status")
    .single();

  if (created.error || !created.data) return NextResponse.json({ error: "KYC could not be started." }, { status: 500 });
  return NextResponse.json({ application: created.data });
}