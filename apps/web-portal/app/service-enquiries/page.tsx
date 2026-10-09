import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/shell";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { accessRank, getEffectivePermissionAccessMap } from "@/lib/effective-permissions";
import { updateServiceEnquiryStatus } from "./actions";

type ServiceEnquiryRow = {
  id: string;
  enquiry_no: string;
  service_type: "insurance_quote" | "challan_assistance" | "support_ticket";
  source: "guest_login" | "guest_signup" | "customer_dashboard";
  customer_id: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  guest_email: string | null;
  vehicle_no: string | null;
  claim_id: string | null;
  category: "claim" | "policy" | "documents" | "roadside" | "other" | null;
  priority: "low" | "medium" | "high" | null;
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

type EnquirySection = "tickets" | "quotes";
type PageProps = { searchParams: Promise<{ section?: string; status?: string; q?: string; page?: string }> };

export default async function ServiceEnquiriesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const section: EnquirySection = params.section === "quotes" ? "quotes" : "tickets";
  const token = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(token);
  if (!profile) redirect("/login");

  const permissions = await getEffectivePermissionAccessMap(profile);
  if (accessRank[permissions.view_tasks ?? "none"] < accessRank.view) redirect("/dashboard");
  const canEdit = accessRank[permissions.view_tasks ?? "none"] >= accessRank.edit;

  const supabase = await createServerSupabaseClient();
  const status = ["open", "in_progress", "resolved", "closed"].includes(params.status ?? "") ? params.status! : "";
  const query = (params.q ?? "").trim().slice(0, 100);
  const requestedPage = Math.max(1, Math.min(100000, Number.parseInt(params.page ?? "1", 10) || 1));
  const pageSize = 25;
  const basePath = "/service-enquiries";
  const filterUrl = (changes: Record<string, string>) => {
    const values = new URLSearchParams({ section, ...(query ? { q: query } : {}), ...(status ? { status } : {}), ...changes });
    for (const [key, value] of values) if (!value) values.delete(key);
    return `${basePath}?${values.toString()}`;
  };
  const selectedServiceTypes = section === "quotes" ? ["insurance_quote"] : ["support_ticket", "challan_assistance"];

  // Server-side filters and exact counts avoid the previous 200-record cutoff.
  const countFor = async (types: string[], rowStatus?: string) => {
    let builder = supabase.from("service_enquiries").select("id", { count: "exact", head: true }).in("service_type", types);
    if (rowStatus) builder = builder.eq("status", rowStatus);
    const result = await builder;
    return result.count ?? 0;
  };
  const [ticketCount, quoteCount, openCount] = await Promise.all([
    countFor(["support_ticket", "challan_assistance"]),
    countFor(["insurance_quote"]),
    countFor(selectedServiceTypes, "open"),
  ]);

  let matchedCustomerIds: string[] = [];
  if (query) {
    const safe = query.replace(/[%,().]/g, " ").trim();
    if (safe) {
      const { data: customers } = await supabase.from("customers")
        .select("id")
        .or(`contact_name.ilike.%${safe}%,phone.ilike.%${safe}%,customer_code.ilike.%${safe}%`)
        .limit(500);
      matchedCustomerIds = (customers ?? []).map((customer) => customer.id);
    }
  }

  const columns = "id,enquiry_no,service_type,source,customer_id,guest_name,guest_phone,guest_email,vehicle_no,claim_id,category,priority,subject,description,details,status,consent_accepted,consent_accepted_at,consent_version,whatsapp_opt_in,created_at,customers(contact_name,phone,email,customer_code),vehicles(vehicle_no)";
  let builder = supabase.from("service_enquiries").select(columns, { count: "exact" }).in("service_type", selectedServiceTypes);
  if (status) builder = builder.eq("status", status);
  if (query) {
    const safe = query.replace(/[%,().]/g, " ").trim();
    if (safe) {
      const parts = [
        `enquiry_no.ilike.%${safe}%`, `guest_name.ilike.%${safe}%`,
        `guest_phone.ilike.%${safe}%`, `vehicle_no.ilike.%${safe}%`,
        `subject.ilike.%${safe}%`, `description.ilike.%${safe}%`,
      ];
      if (matchedCustomerIds.length) parts.push(`customer_id.in.(${matchedCustomerIds.join(",")})`);
      builder = builder.or(parts.join(","));
    }
  }
  const { data, error, count } = await builder
    .order("created_at", { ascending: false })
    .range((requestedPage - 1) * pageSize, requestedPage * pageSize - 1)
    .returns<ServiceEnquiryRow[]>();
  const sectionRows = data ?? [];
  const totalRows = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  return (
    <AppShell title="Service Enquiries">
      <header className="flex min-w-0 items-center gap-3 overflow-x-auto border border-[#DCE4F0] bg-white px-4 py-3 [scrollbar-width:thin]">
        <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#17365C] text-xl text-white">☷</span>
        <h1 className="shrink-0 whitespace-nowrap text-[18px] font-bold text-[#172844]">Service Enquiries</h1>
        <nav aria-label="Service enquiry sections" className="flex shrink-0 items-center rounded-lg border border-[#DCE4F0] bg-[#F8FAFD] p-1">
          <SectionLink href={filterUrl({ section: "tickets", page: "" })} active={section === "tickets"} label="Ticket Enquiries" count={ticketCount} />
          <SectionLink href={filterUrl({ section: "quotes", page: "" })} active={section === "quotes"} label="Get Quote Enquiries" count={quoteCount} />
        </nav>
        <form method="get" action={basePath} className="ml-auto flex min-w-0 shrink-0 items-center gap-2">
          <input type="hidden" name="section" value={section} />
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <input name="q" defaultValue={query} aria-label="Search service enquiries" placeholder="Search request, customer, mobile, vehicle..." className="h-11 w-[min(28vw,420px)] min-w-[190px] rounded-lg border border-[#CBD6E6] bg-white px-3 text-xs text-[#172844] outline-none focus:border-[#1C4C8E]" />
          <button type="submit" className="h-11 shrink-0 rounded-lg bg-[#073B81] px-3 text-xs font-bold text-white">Search</button>
        </form>
        <form method="get" action={basePath} className="flex shrink-0 items-center">
          <input type="hidden" name="section" value={section} />
          {query ? <input type="hidden" name="q" value={query} /> : null}
          <select name="status" defaultValue={status} aria-label="Filter enquiry status" className="h-11 min-w-[145px] rounded-lg border border-[#CBD6E6] bg-white px-3 text-xs font-semibold text-[#172844]" >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <button type="submit" className="ml-2 h-11 rounded-lg border border-[#CBD6E6] px-3 text-xs font-bold text-[#17365C]">Apply</button>
        </form>
      </header>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">Service enquiries could not be loaded.</div>
      ) : null}

      <div className="flex items-center gap-2 rounded-t-xl border border-b-0 border-[#DCE4F0] bg-white px-4 py-3">
        <h2 className="text-sm font-bold text-[#172844]">{section === "quotes" ? "Get Quote Register" : "Ticket Register"}</h2>
        <span className="rounded-full bg-[#EAF2FF] px-3 py-1 text-[11px] font-semibold text-[#1A4D90]">{openCount} open</span>
        <span className="ml-auto text-[11px] text-[#718095]">{totalRows} matching</span>
      </div>
      <section className="overflow-hidden rounded-b-xl border border-[#DCE4F0] bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[1050px] w-full text-left">
            <thead className="border-b border-[#E8ECF4] bg-[#073B81] text-[10px] font-bold text-white">
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
              {sectionRows.map((row) => {
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
                      <p className="font-black text-[#171D3D]">{serviceLabel(row.service_type)}</p>
                      <p className="mt-1 max-w-[170px] text-[10px] leading-4 text-[#707A90]">{row.subject}</p>{row.service_type === "support_ticket" ? <p className="mt-1 text-[9px] font-bold capitalize text-[#7B8498]">{row.category || "Support"} · {row.priority || "medium"} priority</p> : null}
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
                          {row.service_type === "support_ticket" ? "App support request" : row.consent_accepted ? "Consent captured" : "Legacy request"}
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
              {!sectionRows.length ? (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-sm font-semibold text-[#7B8498]">{section === "quotes" ? "No quote enquiries match the selected filters." : "No ticket enquiries match the selected filters."}</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      <div className="flex items-center justify-between border border-t-0 border-[#DCE4F0] bg-white px-4 py-3 text-xs text-[#617189]">
        <span>Showing {totalRows ? (requestedPage - 1) * pageSize + 1 : 0}–{Math.min(requestedPage * pageSize, totalRows)} of {totalRows}</span>
        <div className="flex items-center gap-3">
          {requestedPage > 1 ? <Link href={filterUrl({ page: String(requestedPage - 1) })} className="rounded border px-3 py-2">Previous</Link> : <span className="opacity-40">Previous</span>}
          <span>{requestedPage}/{totalPages}</span>
          {requestedPage < totalPages ? <Link href={filterUrl({ page: String(requestedPage + 1) })} className="rounded border px-3 py-2">Next</Link> : <span className="opacity-40">Next</span>}
        </div>
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-[20px] border border-white/80 bg-white/78 px-4 py-3 shadow-[0_12px_35px_rgba(37,39,92,0.06)]"><p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#7B8498]">{label}</p><p className="mt-1 text-2xl font-black text-[#171D3D]">{value}</p></div>;
}
function serviceLabel(type: ServiceEnquiryRow["service_type"]) { return type === "support_ticket" ? "Support Ticket" : type === "insurance_quote" ? "Insurance Quote" : "Challan Assistance"; }
function sourceLabel(source: ServiceEnquiryRow["source"]) { return source === "customer_dashboard" ? "Customer app" : source === "guest_signup" ? "Signup guest" : "Login guest"; }
function formatDateTime(value: string) { return new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }

function SectionLink({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return <Link href={href} aria-current={active ? "page" : undefined} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors ${active ? "bg-[#17213E] text-white shadow-sm" : "text-[#56637A] hover:bg-[#F0F4FA]"}`}>{label}<span className={`rounded-full px-2 py-0.5 text-[10px] ${active ? "bg-white/20 text-white" : "bg-[#EAF0F9] text-[#36517D]"}`}>{count}</span></Link>;
}
