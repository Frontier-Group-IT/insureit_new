import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { FormSubmitButton } from "@/components/form-submit-button";
import { requirePospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { importExistingLinkedIntermediary } from "../legacy-import-actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Application = { id:string; requested_type:"posp"|"misp"; partner_status:string|null; partner_record_id:string|null; draft_data:Record<string,unknown>|null };
type Profile = { partner_id:string|null; partner_type:"posp"|"misp"; pos_name:string|null; misp_name:string|null; associate_name:string|null };

const inputClass = "mt-1.5 h-11 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-[10.5px] text-[#0F172A] outline-none focus:border-[#635BFF] focus:ring-2 focus:ring-[#E7E5FF]";
const labelClass = "block text-[9px] font-semibold uppercase tracking-[.05em] text-[#526178]";

export default async function LegacyImportPage({ params, searchParams }: { params:Promise<{id:string}>; searchParams:Promise<{error?:string}> }) {
  await requirePospMispManager();
  const { id } = await params;
  const query = await searchParams;
  const admin = createSupabaseAdminClient();
  const { data: application } = await admin.from("intermediary_onboarding_applications").select("id,requested_type,partner_status,partner_record_id,draft_data").eq("id", id).maybeSingle<Application>();
  if (!application) notFound();
  const [{ data: profile }, { data: linked }] = await Promise.all([
    admin.from("posp_misp_onboarding_profiles").select("partner_id,partner_type,pos_name,misp_name,associate_name").eq("application_id", id).maybeSingle<Profile>(),
    admin.from("intermediary_onboarding_applications").select("id,draft_data").eq("partner_record_id", application.partner_record_id ?? "00000000-0000-0000-0000-000000000000").neq("id", id),
  ]);
  if (!profile) notFound();
  const context = application.draft_data?.account_context;
  if (context === "posp" || context === "misp" || application.partner_status !== "active_partner" || !application.partner_record_id) redirect(`/intermediaries/applications/${id}`);
  const alreadyLinked = (linked ?? []).some((row) => { const c = row.draft_data?.account_context; return c === "posp" || c === "misp"; });
  if (alreadyLinked) redirect(`/intermediaries/applications/${id}?error=${encodeURIComponent("This Partner already has a linked account.")}`);

  const type = profile.partner_type === "misp" ? "misp" : "posp";
  const name = (type === "misp" ? profile.misp_name : profile.pos_name) ?? "Existing intermediary";
  const draft = application.draft_data ?? {};
  const reservedPartnerCode = text(draft.legacy_partner_code) ?? (profile.partner_id?.startsWith("PENDING-") ? "" : profile.partner_id ?? "");
  const reservedRegistrationCode = text(draft.legacy_registration_code) ?? "";
  const reservedOnboardingDate = dateInput(draft.legacy_original_onboarding_date);
  const reservedActivationDate = dateInput(draft.legacy_original_activation_date);
  const reservedRemarks = text(draft.legacy_migration_remarks) ?? "";

  return <AppShell title={`Import Existing ${type.toUpperCase()}`}>
    <div className="mx-auto max-w-[980px] space-y-4 pb-8">
      <section className="rounded-2xl border border-[#DCE5EF] bg-white/85 p-5 shadow-sm">
        <Link href={`/intermediaries/applications/${id}`} className="text-[10px] font-semibold text-[#4F46E5]">← Back to Partner review</Link>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><p className="text-[9px] font-semibold uppercase tracking-[.08em] text-[#64748B]">Controlled legacy migration</p><h1 className="mt-1 text-xl font-semibold text-[#0F172A]">{name}</h1><p className="mt-1 text-[10px] text-[#64748B]">Import the already-issued Partner and {type.toUpperCase()} IDs without running the live onboarding sequence again.</p></div>
          <span className="rounded-full bg-amber-100 px-3 py-1.5 text-[9px] font-semibold text-amber-800">Admin action</span>
        </div>
      </section>

      {query.error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10px] font-medium text-red-700">{decodeURIComponent(query.error)}</div> : null}

      <form action={importExistingLinkedIntermediary} className="space-y-4">
        <input type="hidden" name="application_id" value={id}/>
        <input type="hidden" name="registration_type" value={type}/>

        <Section title="Permanent identifiers" note="These values will replace generated IDs and must exactly match the identifiers already used in your existing records.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Existing Partner ID" name="partner_code" defaultValue={reservedPartnerCode} placeholder="PART-2024-00127" required />
            <Field label={`Existing ${type.toUpperCase()} ID`} name="registration_code" defaultValue={reservedRegistrationCode} placeholder={type === "posp" ? "POSP-2024-00481" : "MISP-2023-00018"} required />
          </div>
        </Section>

        <Section title="Historical dates" note="Enter the original dates from the physical or previous-system records, not today's date.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Original onboarding date" name="original_onboarding_date" type="date" defaultValue={reservedOnboardingDate} required />
            <Field label="Active since" name="original_activation_date" type="date" defaultValue={reservedActivationDate} required />
            <Field label="Agreement signed date" name="agreement_date" type="date" required />
            {type === "posp" ? <><Field label="Training completed date" name="training_completed_date" type="date" required /><Field label="Exam passed date" name="exam_passed_date" type="date" required /><Field label="Exam score (optional)" name="exam_score" type="number" min="0" max="100" step="0.01" /></> : null}
          </div>
          {type === "misp" ? <p className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-[9.5px] text-blue-800">Training and examination will be recorded as not applicable for MISP. Agreement and IIB registration will be recorded as completed.</p> : null}
        </Section>

        <Section title="Verification and audit" note="This remark will remain with the imported account as an audit reference.">
          <label className={labelClass}>Migration remarks *</label>
          <textarea name="migration_remarks" required minLength={10} defaultValue={reservedRemarks} className="mt-1.5 min-h-28 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2.5 text-[10.5px] outline-none focus:border-[#635BFF] focus:ring-2 focus:ring-[#E7E5FF]" placeholder="State where the original IDs, agreement and IIB registration were verified." />
          <label className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-[10px] leading-5 text-amber-950">
            <input type="checkbox" name="confirmation" value="yes" required className="mt-1 h-4 w-4 shrink-0" />
            <span>I confirm that the Partner ID and {type.toUpperCase()} ID were already issued, the historical stages were verified, and these identifiers should be stored as permanent IDs.</span>
          </label>
        </Section>

        <div className="flex flex-col-reverse gap-2 rounded-2xl border border-[#DCE5EF] bg-white/85 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-[9px] leading-4 text-[#64748B]">The operation validates duplicate IDs and rolls back newly created linked records when any database step fails.</p>
          <FormSubmitButton label={`Import existing ${type.toUpperCase()}`} pendingLabel="Validating and importing" className="h-11 rounded-xl bg-[#071D49] px-5 text-[10px] font-semibold text-white disabled:opacity-60" />
        </div>
      </form>
    </div>
  </AppShell>;
}

function Section({ title, note, children }: { title:string; note:string; children:React.ReactNode }) { return <section className="rounded-2xl border border-[#DCE5EF] bg-white/85 p-5 shadow-sm"><h2 className="text-[13px] font-semibold text-[#0F172A]">{title}</h2><p className="mt-1 text-[9.5px] leading-4 text-[#64748B]">{note}</p><div className="mt-5">{children}</div></section>; }
function Field({ label, name, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label:string; name:string }) { return <label><span className={labelClass}>{label}{props.required ? " *" : ""}</span><input name={name} className={inputClass} {...props}/></label>; }
function text(value:unknown){return typeof value === "string" && value.trim() ? value.trim() : null;}
function dateInput(value:unknown){const raw=text(value);if(!raw)return "";const date=new Date(raw);return Number.isNaN(date.getTime()) ? raw.slice(0,10) : date.toISOString().slice(0,10);}
