"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Application } from "./page";

export function CustomerKycWorkspace({ applications, documentCounts, initialSearch, initialStatus, loadError }: { applications: Application[]; documentCounts: Record<string, number>; initialSearch: string; initialStatus: string; loadError: boolean }) {
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState(initialStatus);
  const normalized = search.trim().toLowerCase();
  const rows = useMemo(() => applications.filter((application) => {
    const draft = application.draft_data ?? {};
    const name = firstText(draft, ["contact_name", "group_name", "company_name", "legal_trade_name", "owner_name"]);
    const haystack = [name, application.applicant_phone, application.applicant_email, application.partner_type, application.source, application.status].filter(Boolean).join(" ").toLowerCase();
    return (!status || application.status === status) && (!normalized || haystack.includes(normalized));
  }), [applications, normalized, status]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (status) params.set("status", status);
    const nextUrl = `/customer-kyc${params.size ? `?${params.toString()}` : ""}`;
    if (`${window.location.pathname}${window.location.search}` !== nextUrl) window.history.replaceState(null, "", nextUrl);
  }, [search, status]);

  return <div className="mx-auto max-w-[1440px] space-y-3 pb-5">
    <section className="rounded-2xl border border-[#DCE5EF] bg-white p-4 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#64748B]">Customers</p><h1 className="mt-1 text-lg font-semibold text-[#0F172A]">Customer KYC Applications</h1><p className="mt-1 text-[10px] text-[#64748B]">Only policyholder and insured-customer applications appear here. Distribution-network applications are managed separately.</p></div><Link href="/intermediaries" className="rounded-lg border border-[#C7D2FE] bg-[#EEF2FF] px-3 py-2 text-[10px] font-semibold text-[#4338CA]">Distribution Network</Link></div></section>
    <form onSubmit={(event) => event.preventDefault()} className="grid gap-2 rounded-xl border border-[#DCE5EF] bg-white p-3 shadow-sm sm:grid-cols-[1fr_180px]"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search phone or email" className="h-10 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-3 text-[11px] outline-none"/><select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-lg border border-[#CBD5E1] bg-white px-3 text-[11px]"><option value="">All statuses</option><option value="submitted">Submitted</option><option value="under_review">Under review</option><option value="changes_requested">Changes requested</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></form>
    <section className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">{loadError?<div className="px-4 py-14 text-center text-[11px] text-red-700">The customer KYC queue could not be loaded.</div>:rows.length?<div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-[10.5px]"><thead className="border-b bg-[#F8FAFC] text-[8.5px] uppercase tracking-[.05em] text-[#64748B]"><tr><th className="px-4 py-3">Applicant</th><th className="px-3 py-3">Customer type</th><th className="px-3 py-3">Documents</th><th className="px-3 py-3">Source</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Updated</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-[#EEF2F6]">{rows.map(application=>{const draft=application.draft_data??{};const name=firstText(draft,["contact_name","group_name","company_name","legal_trade_name","owner_name"]);return <tr key={application.id} className="hover:bg-[#FAFCFF]"><td className="px-4 py-3"><p className="font-semibold text-[#0F172A]">{name??application.applicant_phone??"Applicant"}</p><p className="text-[8.5px] text-[#64748B]">{application.applicant_email??application.applicant_phone??"-"}</p></td><td className="px-3 py-3 capitalize">{(application.partner_type??"customer").replaceAll("_"," ")}</td><td className="px-3 py-3 font-semibold">{documentCounts[application.id]??0}</td><td className="px-3 py-3">{application.source==="customer_app"?"Mobile app":"Manager portal"}</td><td className="px-3 py-3"><Status value={application.status}/></td><td className="px-3 py-3 text-[#64748B]">{formatDate(application.updated_at)}</td><td className="px-4 py-3 text-right">{application.customer_id?<Link href={`/customers/${application.customer_id}/edit`} prefetch={false} className="font-semibold text-[#4F46E5]">Open customer</Link>:<Link href={`/customers/applications/${application.id}`} prefetch={false} className="font-semibold text-[#4F46E5]">Review</Link>}</td></tr>})}</tbody></table></div>:<div className="px-4 py-16 text-center"><p className="text-[12px] font-semibold">No customer KYC applications</p><p className="mt-1 text-[10px] text-[#64748B]">POSP, MISP and Business Associate applications will not appear in this queue.</p></div>}</section>
  </div>;
}

function firstText(data:Record<string,unknown>,keys:string[]){for(const key of keys){const value=data[key];if(typeof value==="string"&&value.trim())return value.trim()}return null}
function Status({value}:{value:string}){return <span className="rounded-full bg-slate-100 px-2 py-1 text-[8.5px] font-semibold capitalize text-slate-700">{value.replaceAll("_"," ")}</span>}
function formatDate(value:string){return new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kolkata"}).format(new Date(value))}
