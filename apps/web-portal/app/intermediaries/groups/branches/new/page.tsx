import Link from "next/link";
import { ArrowLeft, Building2, GitBranch } from "lucide-react";
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
      <div className="mx-auto max-w-5xl space-y-4 pb-20">
        <section className="rounded-[22px] border border-[#DCE5F1] bg-white p-5 shadow-[0_18px_50px_rgba(24,59,102,.08)]">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#EEF3FF] text-[#315FEA] ring-1 ring-[#D9E4FF]">
              <GitBranch className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-[18px] font-bold tracking-[-0.02em] text-[#142B4A]">Branch Onboarding</h1>
                  <p className="mt-1 text-[9px] leading-5 text-[#61738A]">Create a Branch profile and tag it to an existing root Partner. The relationship remains reversible.</p>
                </div>
                <Link href="/intermediaries/groups" className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#D7E0EA] bg-white px-4 text-[8.5px] font-bold text-[#526A83] hover:bg-[#F6F8FB]">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Groups
                </Link>
              </div>
            </div>
          </div>
        </section>

        {query.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[9px] font-semibold text-red-800">{decodeURIComponent(query.error)}</div>
        ) : null}

        <section className="rounded-[22px] border border-[#DCE5F1] bg-white p-5 shadow-[0_14px_40px_rgba(24,59,102,.06)]">
          <form action={createBranchProfile} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Branch Name"><input name="branch_name" required maxLength={120} className={inputClass} placeholder="e.g. Damoh Branch" /></Field>
              <Field label="Phone Number"><input name="phone" required maxLength={20} className={inputClass} placeholder="e.g. 9876543210" /></Field>
              <Field label="Email"><input name="email" type="email" required maxLength={160} className={inputClass} placeholder="branch@example.com" /></Field>
              <Field label="Contact Name"><input name="contact_name" required maxLength={120} className={inputClass} placeholder="Contact person" /></Field>
            </div>

            <Field label="Address"><textarea name="address" required maxLength={500} rows={4} className={`${inputClass} h-auto min-h-24 py-3`} placeholder="Complete Branch address" /></Field>

            <Field label="Tag to a Partner">
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8292A5]" />
                <select name="parent_partner_id" required defaultValue="" className={`${inputClass} pl-10`}>
                  <option value="">Select Partner</option>
                  {parents.map((partner) => <option key={partner.id} value={partner.id}>{partner.display_name} · {partner.partner_code}</option>)}
                </select>
              </div>
            </Field>

            {!parents.length ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[8px] text-amber-900">No eligible root Partner is available in your permitted hierarchy.</p> : null}

            <div className="flex justify-end gap-2 border-t border-[#E8EDF3] pt-4">
              <Link href="/intermediaries/groups" className="inline-flex h-10 items-center rounded-xl border border-[#D7E0EA] bg-white px-5 text-[9px] font-bold text-[#5D6F82]">Cancel</Link>
              <FormSubmitButton disabled={!parents.length} label="Save" pendingLabel="Saving…" className="inline-flex h-10 items-center rounded-xl bg-[#315FEA] px-6 text-[9px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-45" />
            </div>
          </form>
        </section>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[8px] font-bold uppercase tracking-[0.04em] text-[#718198]">{label}</span>{children}</label>;
}

const inputClass = "h-10 w-full rounded-xl border border-[#D7E0EA] bg-white px-3 text-[9px] text-[#30465F] outline-none focus:border-[#7892E8] focus:ring-2 focus:ring-[#E9EEFF]";
