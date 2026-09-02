import { redirect } from "next/navigation";
import { AppShell, PageHeader } from "@/components/shell";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { accessRank, getEffectivePermissionAccessMap } from "@/lib/effective-permissions";
import { updateServiceEnquiryStatus } from "./actions";

type ServiceEnquiryRow = {
  id: string;
  enquiry_no: string;
  service_type: "insurance_quote" | "challan_assistance";
  source: "guest_login" | "guest_signup" | "customer_dashboard";
  customer_id: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  guest_email: string | null;
  vehicle_no: string | null;
  subject: string;
  description: string;
  details: Record<string, unknown> | null;
  status: "open" | "in_progress" | "resolved" | "closed";
  consent_accepted: boolean;
  consent_accepted_at: string | null;
  consent_version: string | null;
  whatsapp_opt_in: boolean;
  created_at: string;
  customers: { contact_name: string | null; phone: string | null; email: string | null; customer_code: string | null } | null;
  vehicles: { vehicle_no: string | null } | null;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ServiceEnquiriesPage() {
  const token = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(token);
  if (!profile) redirect("/login");

  const permissions = await getEffectivePermissionAccessMap(profile);
  if (accessRank[permissions.view_tasks ?? "none"] < accessRank.view) redirect("/dashboard");
  const canEdit = accessRank[permissions.view_tasks ?? "none"] >= accessRank.edit;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("service_enquiries")
    .select("id,enquiry_no,service_type,source,customer_id,guest_name,guest_phone,guest_email,vehicle_no,subject,description,details,status,consent_accepted,consent_accepted_at,consent_version,whatsapp_opt_in,created_at,customers(contact_name,phone,email,customer_code),vehicles(vehicle_no)")
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<ServiceEnquiryRow[]>();

  const rows = data ?? [];
  const open = rows.filter((row) => row.status === "open").length;
  const inProgress = rows.filter((row) => row.status === "in_progress").length;
  const guest = rows.filter((row) => !row.customer_id).length;

  return (
    <AppShell title="Service Enquiries">
      <PageHeader
        title="Service Enquiries"
        description="Quote and challan requests from signed-in customers and verified guests."
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label="Open" value={open} />
        <Metric label="In progress" value={inProgress} />
        <Metric label="Guest enquiries" value={guest} />
      </section>

      {error ? (
        <div className="rounded-[20px] border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          Service enquiries could not be loaded. Apply the customer service enquiry migration before using this workspace.
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[24px] border border-white/75 bg-white/80 shadow-[0_18px_50px_rgba(37,39,92,0.075)] backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="min-w-[1050px] w-full text-left">
            <thead className="border-b border-[#E8ECF4] bg-[#F8FAFD] text-[10px] font-black uppercase tracking-[0.08em] text-[#69738A]">
              <tr>
                <th className="px-4 py-3">Request</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Customer / Guest</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Consent</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF0F5]">
              {rows.map((row) => {
                const name = row.customer_id ? row.customers?.contact_name || "Customer" : row.guest_name || "Guest";
                const phone = row.customer_id ? row.customers?.phone : row.guest_phone;
                const email = row.customer_id ? row.customers?.email : row.guest_email;
                const vehicle = row.vehicles?.vehicle_no || row.vehicle_no || (row.details?.newVehicle ? "New vehicle" : "—");
                return (
                  <tr key={row.id} className="align-top text-[11px] text-[#34405A]">
                    <td className="px-4 py-4">
                      <p className="font-black text-[#171D3D]">{row.enquiry_no}</p>
                      <p className="mt-1 text-[10px] text-[#7B8498]">{formatDateTime(row.created_at)}</p>
                      <span className="mt-2 inline-flex rounded-full bg-[#EEF3FF] px-2 py-1 text-[9px] font-black text-[#3156B8]">{sourceLabel(row.source)}</span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-black text-[#171D3D]">{row.service_type === "insurance_quote" ? "Insurance Quote" : "Challan Assistance"}</p>
                      <p className="mt-1 max-w-[170px] text-[10px] leading-4 text-[#707A90]">{row.subject}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-black text-[#171D3D]">{name}</p>
                      <p className="mt-1 text-[10px] text-[#7B8498]">{row.customer_id ? row.customers?.customer_code || "Existing customer" : "Verified guest"}</p>
                    </td>
                    <td className="px-4 py-4 font-bold text-[#171D3D]">{vehicle}</td>
                    <td className="px-4 py-4">
                      <p className="max-w-[260px] whitespace-normal text-[10.5px] leading-4 text-[#59647A]">{row.description}</p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1.5">
                        {phone ? <a className="font-black text-[#0B63CE] hover:underline" href={`tel:${phone}`}>{phone}</a> : <span className="text-[#9AA2B2]">No phone</span>}
                        {email ? <a className="max-w-[180px] truncate font-semibold text-[#56637A] hover:text-[#0B63CE] hover:underline" href={`mailto:${email}`}>{email}</a> : null}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col items-start gap-1.5">
                        <span className={`inline-flex rounded-full px-2 py-1 text-[9px] font-black ${row.consent_accepted ? "bg-[#EAF8F0] text-[#147A55]" : "bg-[#F3F5F9] text-[#7B8498]"}`}>
                          {row.consent_accepted ? "Consent captured" : "Legacy request"}
                        </span>
                        {row.whatsapp_opt_in ? <span className="inline-flex rounded-full bg-[#EAF7F2] px-2 py-1 text-[9px] font-black text-[#15765B]">WhatsApp allowed</span> : null}
                        {row.consent_accepted_at ? <span className="text-[9px] text-[#8A93A6]">{formatDateTime(row.consent_accepted_at)}</span> : null}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {canEdit ? (
                        <form action={updateServiceEnquiryStatus} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={row.id} />
                          <select name="status" defaultValue={row.status} className="h-9 rounded-xl border border-[#DCE3EF] bg-white px-2 text-[10px] font-bold text-[#27324A]">
                            <option value="open">Open</option>
                            <option value="in_progress">In progress</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                          </select>
                          <button type="submit" className="h-9 rounded-xl bg-[#17213E] px-3 text-[10px] font-black text-white">Save</button>
                        </form>
                      ) : (
                        <span className="inline-flex rounded-full bg-[#F3F5F9] px-2.5 py-1 text-[9px] font-black uppercase text-[#5B6579]">{row.status.replace("_", " ")}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!rows.length ? (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-sm font-semibold text-[#7B8498]">No quote or challan enquiries yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-[20px] border border-white/80 bg-white/78 px-4 py-3 shadow-[0_12px_35px_rgba(37,39,92,0.06)]"><p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#7B8498]">{label}</p><p className="mt-1 text-2xl font-black text-[#171D3D]">{value}</p></div>;
}
function sourceLabel(source: ServiceEnquiryRow["source"]) { return source === "customer_dashboard" ? "Customer app" : source === "guest_signup" ? "Signup guest" : "Login guest"; }
function formatDateTime(value: string) { return new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
