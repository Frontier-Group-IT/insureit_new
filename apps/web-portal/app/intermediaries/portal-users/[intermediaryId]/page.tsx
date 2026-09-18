import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FormSubmitButton } from "@/components/form-submit-button";
import { AppShell } from "@/components/shell";
import { canAccessIntermediary } from "@/lib/employee-access-scope";
import { requirePospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { resendIntermediaryPortalInvite } from "../../resend-portal-invite-action";
import {
  createAdditionalPartnerPortalLogin,
  resendAdditionalPartnerPortalInvite,
  resetAdditionalPartnerPortalPassword,
  setAdditionalPartnerPortalLoginStatus,
} from "../partner-multi-login-actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PartnerRow = {
  id: string;
  application_id: string | null;
  display_name: string;
  intermediary_code: string | null;
  intermediary_type: string;
  account_status: string;
  portal_access_status: string;
};

type PrimaryAccount = {
  id: string;
  email: string;
  status: "invited" | "active" | "disabled";
  invited_at: string | null;
  activated_at: string | null;
};

type AdditionalAccount = {
  id: string;
  email: string;
  status: "invited" | "active" | "disabled";
  invited_at: string | null;
  activated_at: string | null;
  created_at: string;
};

export default async function PartnerPortalUsersDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ intermediaryId: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const reviewer = await requirePospMispManager();
  const { intermediaryId } = await params;
  const query = await searchParams;

  if (!(await canAccessIntermediary(reviewer.id, reviewer.role, intermediaryId))) {
    redirect("/access-denied");
  }

  const admin = createSupabaseAdminClient();
  const [{ data: partner, error: partnerError }, { data: primary }, { data: additional, error: additionalError }] = await Promise.all([
    admin.from("intermediaries")
      .select("id,application_id,display_name,intermediary_code,intermediary_type,account_status,portal_access_status")
      .eq("id", intermediaryId)
      .maybeSingle<PartnerRow>(),
    admin.from("intermediary_portal_accounts")
      .select("id,email,status,invited_at,activated_at")
      .eq("intermediary_id", intermediaryId)
      .maybeSingle<PrimaryAccount>(),
    admin.from("partner_portal_additional_users")
      .select("id,email,status,invited_at,activated_at,created_at")
      .eq("intermediary_id", intermediaryId)
      .order("created_at", { ascending: true })
      .returns<AdditionalAccount[]>(),
  ]);

  if (partnerError || !partner || partner.intermediary_type !== "partner") notFound();
  if (additionalError) throw new Error("Additional Partner portal users could not be loaded.");

  const returnPath = `/intermediaries/portal-users/${intermediaryId}`;
  const successMessage = successText(query.success);
  const errorMessage = errorText(query.error);

  return (
    <AppShell title="Partner Portal Users" backHref="/intermediaries/portal-users">
      <div className="mx-auto max-w-[1180px] space-y-4 pb-8">
        <section className="rounded-2xl border border-[#DCE5EF] bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[15px] font-semibold text-[#102A4C]">{partner.display_name}</h1>
                <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-[8.5px] font-semibold text-sky-700">
                  {partner.portal_access_status.replaceAll("_", " ")}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-[#64748B]">
                {partner.intermediary_code ?? "Partner ID pending"} · One Partner Portal, multiple independent login emails
              </p>
            </div>
            <Link href="/intermediaries/portal-users" className="rounded-lg border border-[#DCE5EF] px-3 py-2 text-[9.5px] font-semibold text-[#475569] hover:bg-[#F8FAFC]">
              Back to Portal Users
            </Link>
          </div>
        </section>

        {successMessage ? <Notice tone="success">{successMessage}</Notice> : null}
        {errorMessage ? <Notice tone="error">{errorMessage}</Notice> : null}

        <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
          <div className="border-b border-[#E7ECF3] bg-[#F8FAFC] px-5 py-3">
            <h2 className="text-[12px] font-semibold text-[#17203A]">Login users</h2>
            <p className="mt-0.5 text-[9.5px] text-[#64748B]">Every active login resolves to this same Partner Portal and business scope.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[10.5px]">
              <thead className="border-b text-[8.5px] uppercase tracking-wide text-[#64748B]">
                <tr>
                  <th className="px-5 py-3">Login email</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Invited</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {primary ? (
                  <tr>
                    <td className="px-5 py-3 font-medium text-[#17203A]">{primary.email}</td>
                    <td className="px-3 py-3"><Badge>Primary</Badge></td>
                    <td className="px-3 py-3"><Status value={primary.status} /></td>
                    <td className="px-3 py-3 text-[#64748B]">{dateTime(primary.invited_at)}</td>
                    <td className="px-3 py-3 text-right">
                      {primary.status === "invited" ? (
                        <form action={resendIntermediaryPortalInvite} className="inline-flex">
                          <input type="hidden" name="intermediary_id" value={intermediaryId} />
                          <input type="hidden" name="return_path" value={returnPath} />
                          <FormSubmitButton label="Resend Invite" pendingLabel="Sending..." className={actionClass} />
                        </form>
                      ) : <span className="text-[9px] font-medium text-[#94A3B8]">Primary login preserved</span>}
                    </td>
                  </tr>
                ) : null}
                {(additional ?? []).map((account) => (
                  <tr key={account.id}>
                    <td className="px-5 py-3 font-medium text-[#17203A]">{account.email}</td>
                    <td className="px-3 py-3"><Badge>Additional</Badge></td>
                    <td className="px-3 py-3"><Status value={account.status} /></td>
                    <td className="px-3 py-3 text-[#64748B]">{dateTime(account.invited_at)}</td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        {account.status === "invited" ? (
                          <form action={resendAdditionalPartnerPortalInvite}>
                            <Hidden accountId={account.id} returnPath={returnPath} />
                            <FormSubmitButton label="Resend" pendingLabel="Sending..." className={actionClass} />
                          </form>
                        ) : null}
                        {account.status === "active" ? (
                          <form action={resetAdditionalPartnerPortalPassword}>
                            <Hidden accountId={account.id} returnPath={returnPath} />
                            <FormSubmitButton label="Reset Password" pendingLabel="Sending..." className={actionClass} />
                          </form>
                        ) : null}
                        <form action={setAdditionalPartnerPortalLoginStatus}>
                          <Hidden accountId={account.id} returnPath={returnPath} />
                          <input type="hidden" name="next_status" value={account.status === "disabled" ? "enabled" : "disabled"} />
                          <FormSubmitButton
                            label={account.status === "disabled" ? "Enable" : "Disable"}
                            pendingLabel="Updating..."
                            className={account.status === "disabled" ? enableClass : disableClass}
                          />
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
                {!primary && !(additional ?? []).length ? (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-[10.5px] text-[#64748B]">No Partner Portal login exists yet. Create the primary login from the Portal Users register first.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        {primary ? (
          <section className="rounded-2xl border border-[#DCE5EF] bg-white p-5 shadow-sm">
            <h2 className="text-[12px] font-semibold text-[#17203A]">Add another login email</h2>
            <p className="mt-1 text-[9.5px] text-[#64748B]">
              This creates a separate authentication account but does not create another Partner or duplicate any business data.
            </p>
            <form action={createAdditionalPartnerPortalLogin} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <input type="hidden" name="intermediary_id" value={intermediaryId} />
              <input type="hidden" name="return_path" value={returnPath} />
              <label className="min-w-0 flex-1">
                <span className="mb-1.5 block text-[8.5px] font-bold uppercase tracking-wide text-[#64748B]">Login email</span>
                <input name="login_email" type="email" required autoComplete="email" placeholder="user@company.com" className="h-10 w-full rounded-xl border border-[#D8DEE9] px-3 text-[11px] outline-none focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA]" />
              </label>
              <FormSubmitButton label="Send Invitation" pendingLabel="Sending..." className="h-10 rounded-xl bg-[#17365D] px-5 text-[10px] font-bold text-white hover:bg-[#102A4C]" />
            </form>
            <p className="mt-3 text-[9px] leading-4 text-[#64748B]">
              The new user chooses their own password from the invitation email. Existing Primary login access is not changed.
            </p>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}

const actionClass = "h-8 rounded-lg border border-[#CBD5E1] bg-white px-3 text-[9px] font-semibold text-[#334155] hover:bg-[#F8FAFC]";
const disableClass = "h-8 rounded-lg border border-rose-200 bg-white px-3 text-[9px] font-semibold text-rose-700 hover:bg-rose-50";
const enableClass = "h-8 rounded-lg border border-emerald-200 bg-white px-3 text-[9px] font-semibold text-emerald-700 hover:bg-emerald-50";

function Hidden({ accountId, returnPath }: { accountId: string; returnPath: string }) {
  return <><input type="hidden" name="account_id" value={accountId} /><input type="hidden" name="return_path" value={returnPath} /></>;
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-[8.5px] font-semibold text-violet-700">{children}</span>;
}

function Status({ value }: { value: string }) {
  const style = value === "active"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : value === "invited"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : "border-amber-200 bg-amber-50 text-amber-700";
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[8.5px] font-semibold capitalize ${style}`}>{value}</span>;
}

function Notice({ tone, children }: { tone: "success" | "error"; children: React.ReactNode }) {
  const style = tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700";
  return <div className={`rounded-xl border px-4 py-3 text-[10.5px] font-medium ${style}`}>{children}</div>;
}

function dateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(date);
}

function successText(value?: string) {
  if (value === "partner_multi_login_invited") return "Additional Partner Portal invitation sent.";
  if (value === "partner_multi_login_invite_resent") return "Invitation sent again.";
  if (value === "partner_multi_login_password_reset") return "Password reset email sent.";
  if (value === "partner_multi_login_disabled") return "Additional login disabled. Other Partner logins remain unchanged.";
  if (value === "partner_multi_login_enabled") return "Additional login enabled.";
  if (value === "portal_invite_resent") return "Primary Partner invitation sent again.";
  return null;
}

function errorText(value?: string) {
  if (!value) return null;
  const decoded = decodeURIComponentSafe(value);
  if (decoded === "partner_multi_login_email_in_use") return "That email is already assigned to another portal login.";
  if (decoded === "partner_multi_login_email_invalid") return "Enter a valid email address.";
  if (decoded === "partner_multi_login_not_authorized") return "You do not have permission to manage this Partner Portal.";
  if (decoded === "partner_multi_login_partner_family_unresolved") return "This Partner does not resolve to a valid Partner family.";
  if (decoded === "partner_multi_login_resend_not_available") return "Only pending invitations can be resent.";
  if (decoded === "partner_multi_login_reset_not_available") return "Password reset is available only for active additional users.";
  if (/rate|security|email/i.test(decoded) && decoded.length < 180) return decoded;
  return "The Partner Portal login action could not be completed.";
}

function decodeURIComponentSafe(value: string) {
  try { return decodeURIComponent(value); } catch { return value; }
}
