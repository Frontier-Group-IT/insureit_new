import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell";
import { FormSubmitButton } from "@/components/form-submit-button";
import { requireScopedPospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createPartnerAssociateAccount } from "./actions";
import { AssociateAccountResultToast } from "./associate-account-result-toast";
import { AssociateAccountActionsMenu } from "./associate-account-actions-menu";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Application = {
  id: string;
  partner_status: string | null;
  draft_data: Record<string, unknown> | null;
};
type Profile = {
  partner_id: string | null;
  partner_type: "posp" | "misp";
  pos_name: string | null;
  misp_name: string | null;
  applicant_phone: string | null;
  applicant_email: string | null;
  dp_phone: string | null;
  dp_email: string | null;
  pan_number: string | null;
  aadhaar_last_four: string | null;
  date_of_birth: string | null;
  dp_date_of_birth: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc_code: string | null;
  gst_number: string | null;
};
type Intermediary = {
  id: string;
  intermediary_code: string | null;
  intermediary_type: string;
  account_status: string;
};
type Associate = {
  id: string;
  name: string;
  phone_number: string;
  email: string;
  designation: string;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  role: "admin" | "claim_head" | "insurance_head" | "bodyshop_manager";
  status: "invited" | "active" | "disabled";
  created_at: string;
  invited_at: string | null;
};

export default async function PartnerAssociateAccountsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string; associate_error?: string; retry_after?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  await requireScopedPospMispManager(id);
  const admin = createSupabaseAdminClient();

  const [{ data: application }, { data: profile }, { data: intermediary }] = await Promise.all([
    admin.from("intermediary_onboarding_applications")
      .select("id,partner_status,draft_data")
      .eq("id", id)
      .maybeSingle<Application>(),
    admin.from("posp_misp_onboarding_profiles")
      .select("partner_id,partner_type,pos_name,misp_name,applicant_phone,applicant_email,dp_phone,dp_email,pan_number,aadhaar_last_four,date_of_birth,dp_date_of_birth,address,city,state,postal_code,bank_name,bank_account_number,bank_ifsc_code,gst_number")
      .eq("application_id", id)
      .maybeSingle<Profile>(),
    admin.from("intermediaries")
      .select("id,intermediary_code,intermediary_type,account_status")
      .eq("application_id", id)
      .maybeSingle<Intermediary>(),
  ]);

  if (!application || !profile || !intermediary) notFound();
  const draft = asObject(application.draft_data);
  const accountContext = draft.account_context === "posp" || draft.account_context === "misp" ? draft.account_context : "partner";
  if (accountContext !== "partner" || application.partner_status !== "active_partner" || intermediary.intermediary_type !== "partner" || intermediary.account_status !== "active") {
    notFound();
  }

  const { data: associates, error: associatesError } = await admin.from("partner_portal_associate_accounts")
    .select("id,name,phone_number,email,designation,address,city,state,postal_code,role,status,created_at,invited_at")
    .eq("intermediary_id", intermediary.id)
    .order("created_at", { ascending: false })
    .returns<Associate[]>();
  if (associatesError) throw new Error("Associate accounts could not be loaded.");

  const name = (profile.partner_type === "misp" ? profile.misp_name : profile.pos_name) ?? "Unnamed applicant";
  const phone = profile.partner_type === "misp" ? profile.dp_phone ?? profile.applicant_phone : profile.applicant_phone;
  const email = profile.partner_type === "misp" ? profile.dp_email ?? profile.applicant_email : profile.applicant_email;
  const dob = profile.partner_type === "misp" ? profile.dp_date_of_birth : profile.date_of_birth;
  const partnerId = profile.partner_id && !profile.partner_id.startsWith("PENDING-") ? profile.partner_id : intermediary.intermediary_code;
  const returnPath = `/intermediaries/applications/${id}/associate-accounts`;

  return (
    <AppShell title="Partner Associate Accounts" backHref={`/intermediaries/applications/${id}`}>
      <div className="mx-auto max-w-[1480px] space-y-4 pb-8">
        {query.success ? (
          <AssociateAccountResultToast tone="success" message={successMessage(query.success)} />
        ) : null}
        {query.associate_error || query.error ? <AssociateAccountResultToast tone="error" message={errorMessage(query.associate_error ?? query.error ?? "", query.retry_after)} /> : null}

        <section className="overflow-hidden rounded-2xl border border-[#173E7B] bg-gradient-to-br from-[#071D49] via-[#0A2B65] to-[#0C4A9A] text-white shadow-[0_18px_45px_rgba(7,29,73,.18)]">
          <div className="flex flex-col gap-5 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-[#315FEA] shadow-md">
                <UserIcon />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold">Partner Application Review</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="truncate text-[13px] font-semibold text-white/90">{name}</p>
                  {partnerId ? <span className="inline-flex rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-semibold">{partnerId}</span> : null}
                </div>
              </div>
            </div>
            <Link href={`/intermediaries/applications/${id}`} className="inline-flex h-9 items-center rounded-xl border border-white/20 bg-white/10 px-4 text-[10px] font-semibold text-white hover:bg-white/15">
              Back to Partner
            </Link>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card title="Identity and contact">
            <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
              <Info label="Name" value={name} />
              <Info label="PAN" value={maskPan(profile.pan_number)} />
              <Info label="Aadhaar" value={maskAadhaar(profile.aadhaar_last_four)} />
              <Info label="Date of birth" value={date(dob)} />
              <Info label="Mobile" value={phone ?? "-"} />
              <Info label="Email" value={email ?? "-"} />
            </dl>
          </Card>
          <Card title="Address, bank and tax">
            <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
              <Info label="Address" value={completeAddress(profile)} />
              <Info label="PIN code" value={profile.postal_code ?? "-"} />
              <Info label="Bank" value={profile.bank_name ?? "-"} />
              <Info label="Account" value={maskAccount(profile.bank_account_number)} />
              <Info label="IFSC" value={profile.bank_ifsc_code ?? "-"} />
              <Info label="GST" value={profile.gst_number ?? "Not applicable"} />
            </dl>
          </Card>
        </section>

        <section className="rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
          <div className="border-b border-[#E7ECF3] px-5 py-4">
            <h2 className="text-[13px] font-semibold text-[#17203A]">Associate Accounts</h2>
          </div>
          <form action={createPartnerAssociateAccount} className="p-5">
            <input type="hidden" name="application_id" value={id} />
            <input type="hidden" name="intermediary_id" value={intermediary.id} />
            <input type="hidden" name="return_path" value={returnPath} />
            <div className="grid gap-3 xl:grid-cols-[1.2fr_1fr_1.4fr_1.2fr_1.15fr_auto] xl:items-end">
              <Field label="Name" required><input name="name" required className={inputClass} placeholder="Associate name" /></Field>
              <Field label="Phone Number" required><input name="phone_number" required className={inputClass} placeholder="+91..." inputMode="tel" /></Field>
              <Field label="Email" required><input name="email" type="email" required className={inputClass} placeholder="user@company.com" /></Field>
              <Field label="Designation" required><input name="designation" required className={inputClass} placeholder="Designation" /></Field>
              <Field label="Role" required>
                <select name="role" required defaultValue="" className={inputClass}>
                  <option value="" disabled>Select role</option>
                  <option value="admin" disabled>Admin</option>
                  <option value="claim_head">Claim Head</option>
                  <option value="insurance_head">Insurance Head</option>
                  <option value="bodyshop_manager">Bodyshop Manager</option>
                </select>
              </Field>
              <FormSubmitButton label="Save" pendingLabel="Saving..." className="h-10 rounded-xl bg-[#17365D] px-5 text-[10px] font-bold text-white hover:bg-[#102A4C]" />
            </div>
            <div className="mt-4 grid gap-3 xl:grid-cols-[2fr_1fr_1fr_1fr_auto] xl:items-end">
              <Field label="Address"><input name="address" className={inputClass} placeholder="Address" /></Field>
              <Field label="City"><input name="city" className={inputClass} placeholder="City" /></Field>
              <Field label="State"><input name="state" className={inputClass} placeholder="State" /></Field>
              <Field label="PIN Code"><input name="postal_code" className={inputClass} placeholder="PIN Code" inputMode="numeric" /></Field>
              <FormSubmitButton label="Save" pendingLabel="Saving..." className="h-10 rounded-xl bg-[#17365D] px-5 text-[10px] font-bold text-white hover:bg-[#102A4C]" />
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
          <div className="border-b border-[#E7ECF3] px-5 py-4">
            <h2 className="text-[13px] font-semibold text-[#17203A]">Associate Accounts Register</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-[10.5px]">
              <thead className="border-b border-[#E7ECF3] bg-[#F8FAFC] text-[8.5px] font-bold uppercase tracking-[.06em] text-[#64748B]">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-3 py-3">Phone Number</th>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Designation</th>
                  <th className="px-3 py-3">Address</th>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F6]">
                {(associates ?? []).map((associate) => (
                  <tr key={associate.id} className="hover:bg-[#FAFCFF]">
                    <td className="px-5 py-3 font-semibold text-[#17203A]">{associate.name}</td>
                    <td className="px-3 py-3 text-[#475569]">{associate.phone_number}</td>
                    <td className="px-3 py-3 font-medium text-[#17203A]">{associate.email}</td>
                    <td className="px-3 py-3 text-[#475569]">{associate.designation}</td>
                    <td className="max-w-[260px] px-3 py-3 text-[#475569]">{associateAddress(associate)}</td>
                    <td className="px-3 py-3"><RolePill value={associate.role} /></td>
                    <td className="px-3 py-3"><StatusPill value={associate.status} /></td>
                    <td className="px-3 py-3 text-center">
                      <AssociateAccountActionsMenu
                        associate={associate}
                        applicationId={id}
                        intermediaryId={intermediary.id}
                        returnPath={returnPath}
                      />
                    </td>
                  </tr>
                ))}
                {!(associates ?? []).length ? (
                  <tr><td colSpan={8} className="px-5 py-10 text-center text-[10.5px] text-[#94A3B8]">No associate accounts added yet.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

const inputClass = "h-10 w-full rounded-xl border border-[#D8DEE9] bg-white px-3 text-[11px] text-[#17203A] outline-none focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA]";

function Field({ label, children, required = false }: { label: string; children: React.ReactNode; required?: boolean }) {
  return <label><span className="mb-1.5 block text-[8.5px] font-bold uppercase tracking-wide text-[#64748B]">{label}{required ? <span className="text-red-600"> *</span> : null}</span>{children}</label>;
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-[#DCE5EF] bg-white p-5 shadow-sm"><h2 className="mb-4 text-[13px] font-semibold text-[#17203A]">{title}</h2>{children}</section>;
}
function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex min-w-0 items-baseline gap-1.5 text-[10.5px] leading-5"><dt className="shrink-0 font-semibold text-[#64748B]">{label}:</dt><dd className="min-w-0 break-words font-semibold text-[#0F172A]">{value}</dd></div>;
}
function RolePill({ value }: { value: Associate["role"] }) {
  const label = value === "claim_head" ? "Claim Head" : value === "insurance_head" ? "Insurance Head" : value === "bodyshop_manager" ? "Bodyshop Manager" : "Admin";
  return <span className="inline-flex rounded-full border border-[#D8E2EE] bg-[#F8FAFC] px-2.5 py-1 text-[8.5px] font-semibold text-[#334155]">{label}</span>;
}
function StatusPill({ value }: { value: Associate["status"] }) {
  const label = value === "invited" ? "Invitation Sent" : value === "active" ? "Active" : "Disabled";
  const style = value === "invited"
    ? "border-blue-200 bg-blue-50 text-blue-700"
    : value === "active"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-slate-200 bg-slate-100 text-slate-600";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[8.5px] font-semibold ${style}`}>{label}</span>;
}
function UserIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden="true"><circle cx="12" cy="8" r="3" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></svg>;
}
function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function associateAddress(associate: Associate) {
  const parts = [associate.address, associate.city, associate.state, associate.postal_code]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return parts.length ? parts.join(", ") : "-";
}
function completeAddress(profile: Profile) {
  const parts = [profile.address, profile.city, profile.state].map((value) => value?.trim()).filter((value): value is string => Boolean(value));
  return parts.length ? parts.join(", ") : "-";
}
function maskPan(value: string | null) {
  return value && value.length >= 7 ? `${value.slice(0, 2).toUpperCase()}****${value.slice(-3).toUpperCase()}` : "Not available";
}
function maskAadhaar(value: string | null | undefined) {
  return value ? `**** ${value.slice(-4)}` : "Not available";
}
function maskAccount(value: string | null) {
  return value ? `•••• ${value.slice(-4)}` : "Not available";
}
function date(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(parsed);
}
function successMessage(value: string) {
  if (value === "associate_account_invited") return "Associate account saved. Activation email sent successfully.";
  if (value === "associate_account_updated") return "Associate account updated successfully.";
  if (value === "associate_account_disabled") return "Associate account disabled. Portal access is blocked.";
  if (value === "associate_account_enabled") return "Associate account enabled successfully.";
  if (value === "associate_account_deleted") return "Associate account deleted permanently.";
  if (value === "associate_invite_resent") return "Invitation link sent again successfully.";
  return "Associate account updated successfully.";
}
function errorMessage(value: string, retryAfter?: string) {
  const decoded = safeDecode(value);
  if (decoded === "associate_account_invalid") return "Complete all associate account fields.";
  if (decoded === "associate_email_invalid") return "Enter a valid email address.";
  if (decoded === "associate_phone_invalid") return "Enter a valid phone number.";
  if (decoded === "associate_role_blocked") return "Admin access is blocked by default. Select another role.";
  if (decoded === "associate_email_in_use") return "That email is already used by another portal account.";
  if (decoded === "associate_not_authorized") return "You do not have permission to manage this Partner.";
  if (decoded === "associate_partner_not_available") return "Associate accounts are available only for an active Partner.";
  if (decoded === "associate_not_found") return "That associate account is no longer available.";
  if (decoded === "associate_update_failed") return "The associate details could not be updated.";
  if (decoded === "associate_status_failed") return "The associate login status could not be changed.";
  if (decoded === "associate_delete_failed") return "The associate account could not be deleted.";
  if (decoded === "associate_enable_before_resend") return "Enable this associate account before resending the invitation link.";
  if (decoded === "associate_email_cooldown") {
    const seconds = Number(retryAfter ?? "0");
    return seconds > 0
      ? `An authentication email was sent recently. Please wait ${seconds} seconds before resending the link.`
      : "An authentication email was sent recently. Please wait a moment before resending the link.";
  }
  const rateLimit = decoded.match(/after\s+(\d+)\s+seconds?/i);
  if (rateLimit?.[1]) return `An authentication email was sent recently. Please wait ${rateLimit[1]} seconds before trying again.`;
  return "The associate account action could not be completed.";
}
function safeDecode(value: string) { try { return decodeURIComponent(value); } catch { return value; } }
