import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { getCustomerWebSession } from "@/lib/customer-web";

type ServiceType = "insurance_quote" | "challan_assistance" | "support_ticket";
type QuoteNeed = "renewal" | "new_policy" | "change_insurer" | "other";
type SupportCategory = "claim" | "policy" | "documents" | "roadside" | "other";
type SupportPriority = "low" | "medium" | "high";

type Payload = {
  customerId?: string;
  serviceType?: ServiceType;
  vehicleId?: string | null;
  vehicleNo?: string | null;
  quoteNeed?: QuoteNeed;
  newVehicle?: boolean;
  vehicleDetails?: string | null;
  challanNo?: string | null;
  category?: SupportCategory;
  priority?: SupportPriority;
  claimId?: string | null;
  subject?: string;
  description?: string;
  note?: string | null;
  whatsappOptIn?: boolean;
  consentAccepted?: boolean;
};

const CONSENT_VERSION = "2026-09-02-v1";
const TERMS_VERSION = "2026-07-04";
const PRIVACY_VERSION = "2026-07-04";

type ServiceEnquiryInsertResult = {
  id: string;
  enquiry_no: string;
  status: string;
};

type ServiceEnquiryInsertTable = {
  insert(values: Record<string, unknown>): {
    select(columns: string): {
      single(): PromiseLike<{
        data: ServiceEnquiryInsertResult | null;
        error: { code?: string; message?: string } | null;
      }>;
    };
  };
};

function text(value: unknown, max = 2000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  let body: Payload;
  try {
    body = await request.json() as Payload;
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const session = await getCustomerWebSession();
  const customerId = text(body.customerId, 64);
  if (!customerId || !session.accounts.some((account) => account.id === customerId)) {
    return NextResponse.json({ error: "Customer account is not authorized." }, { status: 403 });
  }

  const serviceType = body.serviceType;
  if (!serviceType || !["insurance_quote", "challan_assistance", "support_ticket"].includes(serviceType)) {
    return NextResponse.json({ error: "Unsupported request type." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  let vehicleId = text(body.vehicleId, 64) || null;
  let vehicleNo = text(body.vehicleNo, 32).toUpperCase() || null;
  const claimId = text(body.claimId, 64) || null;
  let assignedTo: string | null = null;

  if (vehicleId) {
    const vehicle = await supabase
      .from("vehicles")
      .select("id,vehicle_no")
      .eq("id", vehicleId)
      .eq("customer_id", customerId)
      .maybeSingle();
    if (vehicle.error || !vehicle.data) {
      return NextResponse.json({ error: "Selected vehicle is not available for this Customer account." }, { status: 403 });
    }
    vehicleNo = vehicle.data.vehicle_no ?? vehicleNo;
  }

  if (claimId) {
    const claim = await supabase
      .from("claims")
      .select("id,vehicle_id,assigned_to,claim_no")
      .eq("id", claimId)
      .eq("customer_id", customerId)
      .maybeSingle();
    if (claim.error || !claim.data) {
      return NextResponse.json({ error: "Selected claim is not available for this Customer account." }, { status: 403 });
    }
    vehicleId = claim.data.vehicle_id ?? vehicleId;
    assignedTo = claim.data.assigned_to ?? null;
  }

  const subject = text(body.subject, 120);
  const description = text(body.description, 2000);
  if (subject.length < 3 || description.length < 10) {
    return NextResponse.json({ error: "Please provide a subject and enough detail." }, { status: 400 });
  }

  if (serviceType !== "support_ticket" && body.consentAccepted !== true) {
    return NextResponse.json({ error: "Please accept the terms to continue." }, { status: 400 });
  }

  const category = serviceType === "support_ticket" && body.category && ["claim", "policy", "documents", "roadside", "other"].includes(body.category)
    ? body.category
    : null;
  const priority = serviceType === "support_ticket" && body.priority && ["low", "medium", "high"].includes(body.priority)
    ? body.priority
    : null;

  if (serviceType === "support_ticket" && (category === "claim" || category === "documents") && !claimId) {
    return NextResponse.json({ error: "Select the related claim for this support category." }, { status: 400 });
  }

  const details = serviceType === "insurance_quote"
    ? {
        quoteNeed: body.quoteNeed ?? "renewal",
        newVehicle: Boolean(body.newVehicle),
        vehicleDetails: text(body.vehicleDetails, 250) || null,
        note: text(body.note, 1000) || null,
      }
    : serviceType === "challan_assistance"
      ? { challanNo: text(body.challanNo, 100) || null, note: text(body.note, 1000) || null }
      : { supportCategory: category, priority, note: text(body.note, 1000) || null };

  const serviceEnquiries = (supabase.from as unknown as (table: string) => ServiceEnquiryInsertTable)("service_enquiries");
  const { data, error } = await serviceEnquiries
    .insert({
      enquiry_no: "",
      service_type: serviceType,
      source: "customer_dashboard",
      customer_id: customerId,
      created_by: session.profile.id,
      guest_name: null,
      guest_phone: null,
      guest_email: null,
      vehicle_id: vehicleId,
      vehicle_no: vehicleNo,
      claim_id: claimId,
      assigned_to: assignedTo,
      category,
      priority,
      subject,
      description,
      details,
      consent_accepted: serviceType === "support_ticket" ? false : true,
      consent_accepted_at: serviceType === "support_ticket" ? null : new Date().toISOString(),
      consent_version: serviceType === "support_ticket" ? null : CONSENT_VERSION,
      terms_version: serviceType === "support_ticket" ? null : TERMS_VERSION,
      privacy_policy_version: serviceType === "support_ticket" ? null : PRIVACY_VERSION,
      whatsapp_opt_in: Boolean(body.whatsappOptIn),
      status: "open",
    })
    .select("id,enquiry_no,status")
    .single();

  if (error || !data) {
    console.error("customer_web_service_enquiry_failed", { code: error?.code ?? null, serviceType });
    return NextResponse.json({ error: "Your request could not be created right now." }, { status: 500 });
  }

  return NextResponse.json({ enquiry: data });
}