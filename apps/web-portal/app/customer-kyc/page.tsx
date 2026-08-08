import { AppShell } from "@/components/shell";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { CustomerKycWorkspace } from "./customer-kyc-workspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type Application = {
  id: string;
  partner_type: string | null;
  source: string;
  status: string;
  applicant_phone: string | null;
  applicant_email: string | null;
  customer_id: string | null;
  draft_data: Record<string, unknown> | null;
  updated_at: string;
};

export default async function CustomerKycPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requireCapability("review_kyc", "edit");
  const query = await searchParams;
  const search = query.q?.trim().slice(0, 80) ?? "";
  const status = ["submitted", "under_review", "changes_requested", "approved", "rejected"].includes(query.status ?? "") ? query.status : null;
  const admin = createSupabaseAdminClient();

  const request = admin.from("customer_onboarding_applications")
    .select("id, partner_type, source, status, applicant_phone, applicant_email, customer_id, draft_data, updated_at")
    .not("partner_type", "in", "(posp,misp)")
    .order("updated_at", { ascending: false })
    .limit(250);
  const { data, error } = await request.returns<Application[]>();
  const applications = data ?? [];
  const ids = applications.map((row) => row.id);
  const { data: documents } = ids.length ? await admin.from("customer_onboarding_documents").select("application_id").in("application_id", ids).returns<Array<{ application_id: string }>>() : { data: [] as Array<{ application_id: string }> };
  const documentCounts = new Map<string, number>();
  for (const document of documents ?? []) documentCounts.set(document.application_id, (documentCounts.get(document.application_id) ?? 0) + 1);

  return <AppShell title="Customer KYC"><CustomerKycWorkspace applications={applications} documentCounts={Object.fromEntries(documentCounts)} initialSearch={search} initialStatus={status ?? ""} loadError={Boolean(error)} /></AppShell>;
}
