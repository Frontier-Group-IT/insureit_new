import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { getCustomerWebSession } from "@/lib/customer-web";

const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GST = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const FLEET = new Set(["less_than_5", "5_to_20", "20_to_50", "more_than_50"]);

function clean(value: unknown, max = 500) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }

type RpcError = { message?: string } | null;
type UntypedRpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: RpcError }>;

export async function POST(request: Request) {
  const session = await getCustomerWebSession();
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request payload." }, { status: 400 }); }

  const applicationId = clean(body.applicationId, 64);
  const contactName = clean(body.contactName, 120);
  const email = clean(body.email, 160).toLowerCase();
  const panNumber = clean(body.panNumber, 10).toUpperCase();
  const aadhaarNumber = clean(body.aadhaarNumber, 12).replace(/\D/g, "");
  const addressStreet = clean(body.addressStreet, 300);
  const addressLocality = clean(body.addressLocality, 200);
  const indiaLocationId = clean(body.indiaLocationId, 64);
  const city = clean(body.city, 120);
  const state = clean(body.state, 120);
  const postalCode = clean(body.postalCode, 6).replace(/\D/g, "");
  const legalTradeName = clean(body.legalTradeName, 180);
  const isGstRegistered = body.isGstRegistered === true;
  const gstNumber = clean(body.gstNumber, 15).toUpperCase();
  const fleetSizeBand = clean(body.fleetSizeBand, 32);

  if (contactName.length < 2) return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (!PAN.test(panNumber)) return NextResponse.json({ error: "Enter a valid PAN number." }, { status: 400 });
  if (!/^\d{12}$/.test(aadhaarNumber)) return NextResponse.json({ error: "Enter a valid 12-digit Aadhaar number." }, { status: 400 });
  if (!addressStreet || !indiaLocationId || postalCode.length !== 6 || !city || !state) return NextResponse.json({ error: "Complete your address and select a valid PIN location." }, { status: 400 });
  if (!FLEET.has(fleetSizeBand)) return NextResponse.json({ error: "Select your fleet size." }, { status: 400 });
  if (isGstRegistered && (!legalTradeName || !GST.test(gstNumber))) return NextResponse.json({ error: "Enter valid GST registration details." }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const application = await supabase
    .from("customer_onboarding_applications")
    .select("id,status,partner_type")
    .eq("id", applicationId)
    .eq("profile_id", session.user.id)
    .maybeSingle();
  if (application.error || !application.data) return NextResponse.json({ error: "KYC application is not available." }, { status: 403 });
  if (["submitted", "under_review", "approved"].includes(application.data.status)) return NextResponse.json({ error: "This KYC application cannot be submitted again right now." }, { status: 409 });
  if (application.data.partner_type !== "individual_proprietor") return NextResponse.json({ error: "This submission is only for Individual KYC." }, { status: 409 });

  const location = await supabase.from("india_locations").select("id,pincode,city_name,state_name").eq("id", indiaLocationId).eq("pincode", postalCode).maybeSingle();
  if (location.error || !location.data || location.data.city_name !== city || location.data.state_name !== state) {
    return NextResponse.json({ error: "Selected PIN location could not be verified." }, { status: 400 });
  }

  const docs = await supabase
    .from("customer_onboarding_documents")
    .select("document_type,verification_status")
    .eq("application_id", applicationId);
  if (docs.error) return NextResponse.json({ error: "KYC documents could not be verified." }, { status: 500 });
  const validTypes = new Set<string>((docs.data ?? []).filter((doc) => doc.verification_status !== "rejected").map((doc) => doc.document_type));
  const required = ["pan_copy", "aadhaar_front", "aadhaar_back", ...(isGstRegistered ? ["gst_copy"] : [])];
  const missing = required.find((type) => !validTypes.has(type));
  if (missing) return NextResponse.json({ error: "Upload all required KYC documents before submitting." }, { status: 400 });

  const draftData = {
    contact_name: contactName,
    email,
    pan_number: panNumber,
    address_street: addressStreet,
    address_locality: addressLocality || null,
    india_location_id: indiaLocationId,
    city,
    state,
    postal_code: postalCode,
    legal_trade_name: legalTradeName || null,
    is_gst_registered: isGstRegistered,
    gst_number: isGstRegistered ? gstNumber : null,
    fleet_size_band: fleetSizeBand,
  };

  const draft = await supabase
    .from("customer_onboarding_applications")
    .update({ status: "in_progress", current_step: 3, draft_data: draftData })
    .eq("id", applicationId)
    .eq("profile_id", session.user.id);
  if (draft.error) return NextResponse.json({ error: "KYC draft could not be saved." }, { status: 500 });

  const rpc = supabase.rpc as unknown as UntypedRpc;
  const { data, error } = await rpc("submit_individual_onboarding_application", {
    p_application_id: applicationId,
    p_contact_name: contactName,
    p_email: email,
    p_pan_number: panNumber,
    p_aadhaar_number: aadhaarNumber,
    p_address_street: addressStreet,
    p_address_locality: addressLocality || null,
    p_india_location_id: indiaLocationId,
    p_city: city,
    p_state: state,
    p_postal_code: postalCode,
    p_legal_trade_name: legalTradeName || null,
    p_is_gst_registered: isGstRegistered,
    p_gst_number: isGstRegistered ? gstNumber : null,
    p_fleet_size_band: fleetSizeBand,
  });

  if (error || !data) return NextResponse.json({ error: error?.message || "Your KYC could not be submitted." }, { status: 500 });
  return NextResponse.json({ application: Array.isArray(data) ? data[0] : data });
}