import Link from "next/link";
import { AppShell } from "@/components/shell";
import { DataError } from "@/components/record-list";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { requireMasterDataManager } from "@/lib/master-data-server";

type ApplicationRow = {
  id: string;
  partner_type: string | null;
  source: string;
  status: string;
  current_step: number;
  applicant_phone: string | null;
  applicant_email: string | null;
  draft_data: Record<string, unknown> | null;
  customer_id: string | null;
  created_at: string;
  updated_at: string;
};

const partnerLabels: Record<string, string> = {
  individual_proprietor: "Individual / Proprietor",
  dealership: "Dealership",
  corporate: "Corporate",
  group: "Group"
};

const statusLabels: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
  under_review: "Under review",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled"
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerApplicationsPage() {
  await requireMasterDataManager();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("customer_onboarding_applications")
    .select("id, partner_type, source, status, current_step, applicant_phone, applicant_email, draft_data, customer_id, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .returns<ApplicationRow[]>();

  const applicationIds = (data ?? []).map((application) => application.id);
  const { data: documentRows } = applicationIds.length
    ? await supabase.from("customer_onboarding_documents").select("application_id").in("application_id", applicationIds).returns<Array<{ application_id: string }>>()
    : { data: [] as Array<{ application_id: string }> };
  const documentCounts = new Map<string, number>();
  for (const document of documentRows ?? []) documentCounts.set(document.application_id, (documentCounts.get(document.application_id) ?? 0) + 1);

  return (
    <AppShell title="KYC Applications">
      <div className="mx-auto max-w-[1440px] pb-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] text-[#64748B]">Mobile and manager onboarding records appear here before becoming customers.</p>
          <Link href="/customers" className="rounded-md border border-[#CBD5E1] bg-white px-3 py-2 text-[10.5px] font-semibold text-[#334155]">Customers</Link>
        </div>
        {error ? <DataError message={error.message} /> : (
          <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-left text-[11px]">
                <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[9.5px] uppercase tracking-[0.04em] text-[#64748B]">
                  <tr><th className="px-3 py-2.5">Applicant</th><th className="px-3 py-2.5">Partner Type</th><th className="px-3 py-2.5">Location</th><th className="px-3 py-2.5">Documents</th><th className="px-3 py-2.5">Source</th><th className="px-3 py-2.5">Progress</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Updated</th><th className="px-3 py-2.5">Customer</th></tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F6]">
                  {(data ?? []).map((application) => {
                    const draft = application.draft_data ?? {};
                    const name = applicationName(application.partner_type, draft);
                    const city = textValue(draft.city);
                    const state = textValue(draft.state);
                    const totalSteps = stepTotal(application.partner_type);
                    return (
                      <tr key={application.id} className="hover:bg-[#FAFCFF]">
                        <td className="px-3 py-3"><p className="font-semibold text-[#0F172A]">{name ?? application.applicant_phone ?? "-"}</p><p className="mt-0.5 text-[9.5px] text-[#64748B]">{application.applicant_phone ?? application.applicant_email ?? "-"}</p></td>
                        <td className="px-3 py-3">{application.partner_type ? partnerLabels[application.partner_type] ?? application.partner_type : "Not selected"}</td>
                        <td className="px-3 py-3">{[city, state].filter(Boolean).join(", ") || "-"}</td>
                        <td className="px-3 py-3">{documentCounts.get(application.id) ?? 0}</td>
                        <td className="px-3 py-3">{application.source === "customer_app" ? "Mobile app" : "Manager portal"}</td>
                        <td className="px-3 py-3">Step {application.current_step} of {totalSteps}</td>
                        <td className="px-3 py-3"><StatusPill status={application.status} /></td>
                        <td className="px-3 py-3 text-[#64748B]">{new Date(application.updated_at).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-3">{application.customer_id ? <Link href={`/customers/${application.customer_id}/edit`} className="font-semibold text-[#4F46E5] hover:underline">Open customer</Link> : <Link href={`/customers/applications/${application.id}`} className="font-semibold text-[#4F46E5] hover:underline">Review</Link>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!data?.length ? <div className="px-4 py-14 text-center text-[11px] text-[#64748B]">No KYC applications yet.</div> : null}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function textValue(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function applicationName(partnerType: string | null, draft: Record<string, unknown>) {
  if (partnerType === "dealership") return textValue(draft.dealership_name) ?? textValue(draft.owner_name);
  if (partnerType === "corporate") return textValue(draft.company_name);
  if (partnerType === "group") return textValue(draft.group_name) ?? textValue(draft.owner_name);
  return textValue(draft.contact_name);
}
function stepTotal(partnerType: string | null) {
  if (partnerType === "dealership") return 7;
  if (partnerType === "individual_proprietor") return 5;
  return 4;
}

function StatusPill({ status }: { status: string }) {
  const complete = status === "approved";
  const attention = status === "changes_requested" || status === "rejected";
  const className = complete ? "border-emerald-200 bg-emerald-50 text-emerald-700" : attention ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700";
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9.5px] font-semibold ${className}`}>{statusLabels[status] ?? status}</span>;
}
