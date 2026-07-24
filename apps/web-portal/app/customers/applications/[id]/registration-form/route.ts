import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { canManageMasterData } from "@/lib/roles";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { formatIndianDate } from "@/lib/indian-date";
import { decryptSensitiveValue } from "@/lib/sensitive-data";

const FORM_VERSION = "POSP-MISP-2026.1";

type Application = {
  id: string;
  partner_type: "posp" | "misp";
  applicant_phone: string | null;
  applicant_email: string | null;
};

type Profile = {
  associate_name: string | null;
  associate_id: string | null;
  external_onboarding_id: string | null;
  document_received_at: string | null;
  pos_name: string | null;
  misp_name: string | null;
  applicant_phone: string | null;
  applicant_email: string | null;
  date_of_birth: string | null;
  pan_number: string | null;
  aadhaar_last_four: string | null;
  aadhaar_number_encrypted: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  gst_number: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc_code: string | null;
  oem_name: string | null;
  dp_name: string | null;
  dp_phone: string | null;
  dp_email: string | null;
  dp_pan_number: string | null;
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const accessToken = await getServerAccessToken();
  const { profile: actor } = await getAuthenticatedProfile(accessToken);
  if (!actor?.id || !canManageMasterData(actor.role)) {
    return new Response("You are not authorized to download this form.", { status: 403 });
  }

  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const [{ data: application }, { data: onboarding }] = await Promise.all([
    admin
      .from("customer_onboarding_applications")
      .select("id, partner_type, applicant_phone, applicant_email")
      .eq("id", id)
      .in("partner_type", ["posp", "misp"])
      .maybeSingle<Application>(),
    admin
      .from("posp_misp_onboarding_profiles")
      .select("associate_name, associate_id, external_onboarding_id, document_received_at, pos_name, misp_name, applicant_phone, applicant_email, date_of_birth, pan_number, aadhaar_last_four, aadhaar_number_encrypted, address, city, state, postal_code, gst_number, bank_name, bank_account_number, bank_ifsc_code, oem_name, dp_name, dp_phone, dp_email, dp_pan_number")
      .eq("application_id", id)
      .maybeSingle<Profile>()
  ]);

  if (!application || !onboarding) return new Response("POSP/MISP application not found.", { status: 404 });

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.03, 0.11, 0.29);
  const muted = rgb(0.34, 0.4, 0.49);
  const line = rgb(0.84, 0.88, 0.93);
  const partnerName = onboarding.pos_name ?? onboarding.misp_name ?? "Unnamed applicant";

  page.drawRectangle({ x: 0, y: 756, width: 595.28, height: 85, color: navy });
  page.drawText("INSUREIT", { x: 40, y: 800, size: 20, font: bold, color: rgb(1, 1, 1) });
  page.drawText(`${application.partner_type.toUpperCase()} REGISTRATION FORM`, { x: 40, y: 778, size: 12, font: bold, color: rgb(0.88, 0.92, 1) });
  page.drawText(`Form version ${FORM_VERSION}`, { x: 430, y: 778, size: 8, font: regular, color: rgb(0.88, 0.92, 1) });

  let y = 724;
  const sections: Array<[string, Array<[string, string | null | undefined]>]> = [
    ["Application", [
      [application.partner_type === "posp" ? "POS Name" : "MISP Name", partnerName],
      [application.partner_type === "posp" ? "Onboarding ID" : "MISP ID", onboarding.external_onboarding_id],
      ["Associate", [onboarding.associate_name, onboarding.associate_id].filter(Boolean).join(" - ")],
      ["Document Received Date", formatIndianDate(onboarding.document_received_at)]
    ]],
    ["Applicant", [
      ["Mobile Number", onboarding.applicant_phone ?? application.applicant_phone],
      ["Email", onboarding.applicant_email ?? application.applicant_email],
      ["Date of Birth", formatIndianDate(onboarding.date_of_birth)],
      ["PAN Number", onboarding.pan_number],
      ["Aadhaar", decryptSensitiveValue(onboarding.aadhaar_number_encrypted) ?? (onboarding.aadhaar_last_four ? `Ending ${onboarding.aadhaar_last_four}` : null)],
      ["GST Number", onboarding.gst_number],
      ["Address", [onboarding.address, onboarding.city, onboarding.state, onboarding.postal_code].filter(Boolean).join(", ")]
    ]],
    ["Bank Details", [
      ["Bank Name", onboarding.bank_name],
      ["Account Number", onboarding.bank_account_number],
      ["IFSC Code", onboarding.bank_ifsc_code]
    ]],
    ...(application.partner_type === "misp" ? [["MISP / DP Details", [
      ["OEM Name", onboarding.oem_name],
      ["DP Name", onboarding.dp_name],
      ["DP Mobile", onboarding.dp_phone],
      ["DP Email", onboarding.dp_email],
      ["DP PAN", onboarding.dp_pan_number]
    ]] as [string, Array<[string, string | null | undefined]>]] : [])
  ];

  for (const [title, rows] of sections) {
    page.drawText(ascii(title), { x: 40, y, size: 11, font: bold, color: navy });
    y -= 12;
    page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 1, color: line });
    y -= 19;
    for (const [label, value] of rows) {
      page.drawText(ascii(label), { x: 48, y, size: 8.5, font: bold, color: muted });
      page.drawText(ascii(value || "-").slice(0, 78), { x: 205, y, size: 9.5, font: regular, color: navy });
      y -= 19;
    }
    y -= 9;
  }

  page.drawLine({ start: { x: 40, y: 84 }, end: { x: 230, y: 84 }, thickness: 1, color: muted });
  page.drawLine({ start: { x: 365, y: 84 }, end: { x: 555, y: 84 }, thickness: 1, color: muted });
  page.drawText("Applicant signature", { x: 40, y: 68, size: 8.5, font: regular, color: muted });
  page.drawText("Authorized verification", { x: 365, y: 68, size: 8.5, font: regular, color: muted });
  page.drawText("Generated from the InsureIT onboarding record.", { x: 40, y: 34, size: 7.5, font: regular, color: muted });

  await admin
    .from("posp_misp_onboarding_profiles")
    .update({ registration_form_generated_at: new Date().toISOString(), registration_form_version: FORM_VERSION, updated_by: actor.id })
    .eq("application_id", id);

  const bytes = await pdf.save();
  const safeName = partnerName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || application.partner_type;
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}-registration-form.pdf"`,
      "Cache-Control": "private, no-store"
    }
  });
}

function ascii(value: string) {
  return value.normalize("NFKD").replace(/[^\x20-\x7E]/g, "");
}
