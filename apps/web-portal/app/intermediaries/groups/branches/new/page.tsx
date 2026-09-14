import Link from "next/link";
import { AppShell } from "@/components/shell";
import { FormSubmitButton } from "@/components/form-submit-button";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  getIntermediaryGroupEmployeeScope,
  requireIntermediaryGroupManager,
} from "@/lib/intermediary-group-access";
import { createBranchProfile } from "./actions";

type Query = { error?: string };
type PartnerRow = {
  id: string;
  partner_code: string;
  display_name: string;
  source_application_id: string | null;
};
type OwnerRow = { application_id: string | null; associate_employee_id: string | null };
type BranchProfileRow = { partner_id: string };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewBranchPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const profile = await requireIntermediaryGroupManager();
  const scope = await getIntermediaryGroupEmployeeScope(profile);
  const admin = createSupabaseAdminClient();

  const [{ data: partnerRows }, { data: branchProfiles }, { data: intermediaryOwners }, { data: onboardingOwners }] = await Promise.all([
    admin
      .from("partners")
      .select("id,partner_code,display_name,source_application_id")
      .eq("partner_status", "active_partner")
      .is("parent_partner_id", null)
      .order("display_name")
      .returns<PartnerRow[]>(),
    admin.from("partner_branch_profiles").select("partner_id").returns<BranchProfileRow[]>(),
    admin
      .from("intermediaries")
      .select("application_id,associate_employee_id")
      .eq("intermediary_type", "partner")
      .returns<OwnerRow[]>(),
    admin
      .from("posp_misp_onboarding_profiles")
      .select("application_id,associate_employee_id")
      .returns<OwnerRow[]>(),
  ]);

  const branchIds = new Set((branchProfiles ?? []).map((row) => row.partner_id));
  const ownerByApplication = new Map<string, string | null>();
  for (const row of intermediaryOwners ?? []) if (row.application_id) ownerByApplication.set(row.application_id, row.associate_employee_id);
  for (const row of onboardingOwners ?? []) if (row.application_id && !ownerByApplication.has(row.application_id)) ownerByApplication.set(row.application_id, row.associate_employee_id);
  const allowedEmployees = new Set(scope.employeeIds);

  const parents = (partnerRows ?? []).filter((partner) => {
    if (branchIds.has(partner.id)) return false;
    if (scope.mode === "organization") return true;
    const ownerId = partner.source_application_id ? ownerByApplication.get(partner.source_application_id) ?? null : null;
    return Boolean(ownerId && allowedEmployees.has(ownerId));
  });

  return (
    <AppShell title="Branch Onboarding" backHref="/intermediaries/groups">
      <div className="mx-auto max-w-[1240px] space-y-2 pb-20">
        <div className="flex items-center justify-between">
          <span className="rounded-full border border-[#D8DEE8] bg-white px-2.5 py-1 text-[10.5px] font-semibold text-[#475569]">Branch</span>
          <Link href="/intermediaries/groups" className="text-[10.5px] font-semibold text-[#4F46E5] hover:underline">Back to Groups</Link>
        </div>

        {query.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10.5px] font-semibold text-red-800">{decodeURIComponent(query.error)}</div>
        ) : null}

        <form action={createBranchProfile} className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <FormSection title="Branch Information">
            <Field label="Branch Name" name="branch_name" required maxLength={120} placeholder="Enter branch name" />
            <Field label="Phone Number" name="phone" required maxLength={20} inputMode="tel" placeholder="10-digit mobile number" />
            <Field label="Email ID" name="email" type="email" required maxLength={160} placeholder="Enter email address" />
            <Field label="Contact Name" name="contact_name" required maxLength={120} placeholder="Enter contact person" />
          </FormSection>

          <section className="border-b border-[#E2E8F0] px-5 py-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-[13px] font-semibold text-[#0F172A]">Address Details</h3>
            </div>
            <div>
              <label className={labelClass} htmlFor="address">Address *</label>
              <textarea
                id="address"
                name="address"
                required
                maxLength={500}
                rows={3}
                className={`${inputClass} min-h-[84px] resize-y py-2.5`}
                placeholder="Enter complete branch address"
              />
            </div>
          </section>

          <section className="border-b border-[#E2E8F0] px-5 py-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-[13px] font-semibold text-[#0F172A]">Partner Mapping</h3>
            </div>
            <div>
              <label className={labelClass} htmlFor="parent_partner_id">Tag to a Partner *</label>
              <select id="parent_partner_id" name="parent_partner_id" required defaultValue="" className={inputClass}>
                <option value="">Select Partner</option>
                {parents.map((partner) => (
                  <option key={partner.id} value={partner.id}>{partner.display_name} · {partner.partner_code}</option>
                ))}
              </select>
              {!parents.length ? (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-900">No eligible root Partner is available in your permitted hierarchy.</p>
              ) : null}
            </div>
          </section>

          <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-[#E2E8F0] bg-white/95 px-5 py-3 backdrop-blur">
            <Link href="/intermediaries/groups" className="rounded-md border border-[#CBD5E1] px-4 py-2 text-[11px] font-semibold text-[#334155] hover:bg-[#F8FAFC]">Cancel</Link>
            <FormSubmitButton disabled={!parents.length} label="Save" pendingLabel="Saving…" />
          </div>
        </form>
      </div>
    </AppShell>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-[#E2E8F0] px-5 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-semibold text-[#0F172A]">{title}</h3>
      </div>
      <div className="grid gap-x-3 gap-y-3 md:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}

function Field({ label, name, required = false, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  return (
    <div>
      <label className={labelClass} htmlFor={name}>{label}{required ? " *" : ""}</label>
      <input id={name} name={name} required={required} className={inputClass} {...props} />
    </div>
  );
}

const inputClass = "h-9 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#17203A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]";
const labelClass = "mb-1 block text-[10.5px] font-semibold text-[#344054]";
