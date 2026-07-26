import Link from "next/link";
import { AppShell } from "@/components/shell";
import { requireMasterDataManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Application = {
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
  await requireMasterDataManager();
  const query = await searchParams;
  const search = query.q?.trim().slice(0, 80) ?? "";
  const status = ["submitted", "under_review", "changes_requested", "approved", "rejected"].includes(query.status ?? "") ? query.status : null;
  const admin = createSupabaseAdminClient();

  let request = admin.from("customer_onboarding_applications")
    .select("id, partner_type, source, status, applicant_phone, applicant_email, customer_id, draft_data, updated_at")
    .not("partner_type", "in", "(posp,misp)")
    .order("updated_at", { ascending: false })
    .limit(250);
  if (status) request = request.eq("status", status);
  if (search) request = request.or(`applicant_phone.ilike.%${search}%,applicant_email.ilike.%${search}%`);
  const { data, error } = await request.returns<Application[]>();
  const applications = data ?? [];
  const ids = applications.map((row) => row.id);
  const { data: documents } = ids.length ? await admin.from("customer_onboarding_documents").select("application_id").in("application_id", ids).returns<Array<{ application_id: string }>>() : { data: [] as Array<{ application_id: string }> };
  const documentCounts = new Map<string, number>();
  for (const document of documents ?? []) documentCounts.set(document.application_id, (documentCounts.get(document.application_id) ?? 0) + 1);

  return <AppShell title="Customer KYC"><div className="mx-auto max-w-[1440px] space-y-3 pb-5">
    <section className="rounded-2xl border border-[#DCE5EF] bg-white p-4 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#64748B]">Customers</p><h1 className="mt-1 text-lg font-semibold text-[#0F172A]">Customer KYC Applications</h1><p className="mt-1 text-[10px] text-[#64748B]">Only policyholder and insured-customer applications appear here. Distribution-network applications are managed separately.</p></div><Link href="/intermediaries" className="rounded-lg border border-[#C7D2FE] bg-[#EEF2FF] px-3 py-2 text-[10px] font-semibold text-[#4338CA]">Distribution Network</Link></div></section>
    <form method="get" className="grid gap-2 rounded-xl border border-[#DCE5EF] bg-white p-3 shadow-sm sm:grid-cols-[1fr_180px_auto]"><input name="q" defaultValue={search} placeholder="Search phone or email" className="h-10 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-3 text-[11px] outline-none"/><select name="status" defaultValue={status??""} className="h-10 rounded-lg border border-[#CBD5E1] bg-white px-3 text-[11px]"><option value="">All statuses</option><option value="submitted">Submitted</option><option value="under_review">Under review</option><option value="changes_requested">Changes requested</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select><button className="h-10 rounded-lg bg-[#0F2A55] px-4 text-[10.5px] font-semibold text-white">Apply</button></form>
    <section className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">{error?<div className="px-4 py-14 text-center text-[11px] text-red-700">The customer KYC queue could not be loaded.</div>:applications.length?<div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-[10.5px]"><thead className="border-b bg-[#F8FAFC] text-[8.5px] uppercase tracking-[.05em] text-[#64748B]"><tr><th className="px-4 py-3">Applicant</th><th className="px-3 py-3">Customer type</th><th className="px-3 py-3">Documents</th><th className="px-3 py-3">Source</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Updated</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-[#EEF2F6]">{applications.map(application=>{const draft=application.draft_data??{};const name=firstText(draft,["contact_name","group_name","company_name","legal_trade_name","owner_name"]);return <tr key={application.id} className="hover:bg-[#FAFCFF]"><td className="px-4 py-3"><p className="font-semibold text-[#0F172A]">{name??application.applicant_phone??"Applicant"}</p><p className="text-[8.5px] text-[#64748B]">{application.applicant_email??application.applicant_phone??"-"}</p></td><td className="px-3 py-3 capitalize">{(application.partner_type??"customer").replaceAll("_"," ")}</td><td className="px-3 py-3 font-semibold">{documentCounts.get(application.id)??0}</td><td className="px-3 py-3">{application.source==="customer_app"?"Mobile app":"Manager portal"}</td><td className="px-3 py-3"><Status value={application.status}/></td><td className="px-3 py-3 text-[#64748B]">{formatDate(application.updated_at)}</td><td className="px-4 py-3 text-right">{application.customer_id?<Link href={`/customers/${application.customer_id}/edit`} className="font-semibold text-[#4F46E5]">Open customer</Link>:<Link href={`/customers/applications/${application.id}`} className="font-semibold text-[#4F46E5]">Review</Link>}</td></tr>})}</tbody></table></div>:<div className="px-4 py-16 text-center"><p className="text-[12px] font-semibold">No customer KYC applications</p><p className="mt-1 text-[10px] text-[#64748B]">POSP, MISP and Business Associate applications will not appear in this queue.</p></div>}</section>
  </div></AppShell>;
}
function firstText(data:Record<string,unknown>,keys:string[]){for(const key of keys){const value=data[key];if(typeof value==="string"&&value.trim())return value.trim()}return null}
function Status({value}:{value:string}){return <span className="rounded-full bg-slate-100 px-2 py-1 text-[8.5px] font-semibold capitalize text-slate-700">{value.replaceAll("_"," ")}</span>}
function formatDate(value:string){return new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kolkata"}).format(new Date(value))}
