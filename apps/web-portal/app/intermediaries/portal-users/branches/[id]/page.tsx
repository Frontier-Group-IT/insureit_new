import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getIntermediaryGroupEmployeeScope, requireIntermediaryGroupViewer } from "@/lib/intermediary-group-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type BranchProfile = {
  partner_id: string;
  phone?: string | null;
  email?: string | null;
  contact_name?: string | null;
  address?: string | null;
  created_by?: string | null;
};
type Partner = {
  id: string;
  display_name: string;
  partner_code: string;
  partner_status: string;
  parent_partner_id: string | null;
};
type Identity = { login_email: string | null; status: string | null };

export default async function BranchAccountReview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireIntermediaryGroupViewer();
  const scope = await getIntermediaryGroupEmployeeScope(viewer);
  const admin = createSupabaseAdminClient();

  const [{ data: branch, error: branchError }, { data: profile, error: profileError }, { data: identity, error: identityError }] = await Promise.all([
    admin.from("partners").select("id,display_name,partner_code,partner_status,parent_partner_id").eq("id", id).maybeSingle<Partner>(),
    admin.from("partner_branch_profiles").select("*").eq("partner_id", id).maybeSingle<BranchProfile>(),
    admin.from("portal_access_identities").select("login_email,status").eq("entity_type", "branch").eq("entity_id", id).maybeSingle<Identity>(),
  ]);
  if (branchError || profileError || identityError) throw new Error("Branch details could not be loaded.");
  if (!branch || !profile) notFound();

  // Keep the same hierarchy boundary as the organization-level Portal Users branch register.
  // Non-organization viewers can only open a branch they directly created.
  if (scope.mode !== "organization" && profile.created_by !== viewer.id) notFound();

  const parentResult = branch.parent_partner_id
    ? await admin.from("partners").select("id,display_name,partner_code,partner_status,parent_partner_id").eq("id", branch.parent_partner_id).maybeSingle<Partner>()
    : null;
  if (parentResult?.error) throw new Error("Parent partner could not be loaded.");
  const parent = parentResult?.data ?? null;
  const field = (value: string | null | undefined) => value?.trim() || "—";

  return (
    <AppShell title="Branch Account Review" backHref="/intermediaries/portal-users?type=Branch">
      <div className="mx-auto max-w-[1480px] space-y-5 pb-12">
        <section className="overflow-hidden rounded-[20px] bg-[#0D2B60] text-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-6">
            <div>
              <div className="text-[11px] font-semibold text-blue-200">Branch Account Review</div>
              <h1 className="mt-2 text-[24px] font-bold">{branch.display_name}</h1>
              <span className="mt-2 inline-flex rounded-lg border border-white/25 bg-white/10 px-3 py-1 text-[12px] font-semibold">{branch.partner_code}</span>
            </div>
            <Link href="/intermediaries/portal-users?type=Branch" className="rounded-lg border border-white/40 px-4 py-2 text-[12px] font-semibold hover:bg-white/10">Back to Portal Users</Link>
          </div>
          <div className="grid gap-px bg-white/20 sm:grid-cols-3">
            <HeaderMetric label="Account type" value="Branch" />
            <HeaderMetric label="Portal access" value={identity?.status || "Not Created"} />
            <HeaderMetric label="Branch status" value={branch.partner_status} />
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-[20px] border border-[#E0E6F1] bg-white p-6">
            <h2 className="mb-5 text-[15px] font-bold text-[#122A50]">Identity and contact</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Branch name" value={branch.display_name} />
              <Field label="Branch code" value={branch.partner_code} />
              <Field label="Contact name" value={field(profile.contact_name)} />
              <Field label="Mobile" value={field(profile.phone)} />
              <Field label="Email" value={field(profile.email)} />
              <Field label="Portal login email" value={field(identity?.login_email)} />
            </div>
          </section>
          <section className="rounded-[20px] border border-[#E0E6F1] bg-white p-6">
            <h2 className="mb-5 text-[15px] font-bold text-[#122A50]">Address and partner mapping</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Address" value={field(profile.address)} />
              <Field label="Parent partner" value={parent ? parent.display_name : "—"} />
              <Field label="Parent partner code" value={parent ? parent.partner_code : "—"} />
              <Field label="Account status" value={field(identity?.status)} />
            </div>
          </section>
        </div>
        <section className="rounded-[20px] border border-[#E0E6F1] bg-white px-6 py-5">
          <h2 className="text-[15px] font-bold text-[#122A50]">Documents</h2>
          <p className="mt-2 text-[12px] text-[#64748B]">This Branch profile does not have a separate application-document register. Documents from the parent Partner application are not shown as Branch documents.</p>
        </section>
      </div>
    </AppShell>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return <div className="bg-[#123975] px-6 py-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-blue-200">{label}</p><p className="mt-1 text-[13px] font-bold">{value}</p></div>;
}
function Field({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-[11px] font-semibold text-[#7283A0]">{label}</p><p className="mt-1 break-words text-[12px] font-semibold text-[#172A4C]">{value}</p></div>;
}
