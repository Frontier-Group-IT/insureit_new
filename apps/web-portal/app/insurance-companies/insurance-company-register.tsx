"use client";

import Link from "next/link";
import { ExternalLink, Plus, Search, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

export type InsuranceCompanyRegisterRow = {
  id: string;
  name: string;
  segment: "general" | "health" | "life" | null;
  sibpl_code: string | null;
  portal_url: string | null;
  portal_status: "configured" | "pending" | "not_provided";
  is_active: boolean;
  updated_at: string;
};

const segmentLabel: Record<string, string> = {
  general: "General Insurance",
  health: "Health Insurance",
  life: "Life Insurance",
};

export function InsuranceCompanyRegister({ rows }: { rows: InsuranceCompanyRegisterRow[] }) {
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState("all");
  const [status, setStatus] = useState("active");

  const counts = useMemo(() => ({
    total: rows.length,
    general: rows.filter((row) => row.segment === "general" && row.is_active).length,
    health: rows.filter((row) => row.segment === "health" && row.is_active).length,
    life: rows.filter((row) => row.segment === "life" && row.is_active).length,
    active: rows.filter((row) => row.is_active).length,
  }), [rows]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery = !normalized || row.name.toLowerCase().includes(normalized) || (row.sibpl_code ?? "").toLowerCase().includes(normalized);
      const matchesSegment = segment === "all" || row.segment === segment;
      const matchesStatus = status === "all" || (status === "active" ? row.is_active : !row.is_active);
      return matchesQuery && matchesSegment && matchesStatus;
    });
  }, [query, rows, segment, status]);

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[24px] border border-white/75 bg-white/80 shadow-[0_18px_55px_rgba(28,39,68,.08)] backdrop-blur-xl">
        <div className="flex flex-col gap-4 border-b border-[#E7ECF3] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[.16em] text-[#52749E]">Master data</p>
            <h1 className="mt-1 text-[20px] font-semibold tracking-[-.02em] text-[#102A4C]">Insurance Companies</h1>
            <p className="mt-1 max-w-2xl text-[10px] leading-4 text-[#667085]">Canonical insurer names used by policy onboarding, historical policies and policy-document matching.</p>
          </div>
          <Link href="/master-data/insurance-companies/new" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#17365D] px-4 text-[10px] font-bold text-white shadow-sm hover:bg-[#102A4C]"><Plus className="h-4 w-4" />Add Insurance Company</Link>
        </div>

        <div className="grid grid-cols-2 gap-px bg-[#E8EDF4] sm:grid-cols-5">
          {[
            ["Active", counts.active],
            ["General", counts.general],
            ["Health", counts.health],
            ["Life", counts.life],
            ["All records", counts.total],
          ].map(([label, value]) => <div key={String(label)} className="bg-white px-4 py-3"><p className="text-[8px] font-bold uppercase tracking-[.08em] text-[#7B8799]">{label}</p><p className="mt-1 text-[17px] font-bold text-[#17365D]">{value}</p></div>)}
        </div>
      </section>

      <section className="overflow-hidden rounded-[22px] border border-white/75 bg-white/82 shadow-[0_16px_45px_rgba(28,39,68,.07)] backdrop-blur-xl">
        <div className="flex flex-col gap-3 border-b border-[#E7ECF3] p-4 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7B8799]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 w-full rounded-xl border border-[#D6DFEB] bg-[#FBFCFE] pl-9 pr-3 text-[11px] outline-none focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA]" placeholder="Search company name or SIBPL code" />
          </label>
          <select value={segment} onChange={(event) => setSegment(event.target.value)} className="h-10 rounded-xl border border-[#D6DFEB] bg-white px-3 text-[10px] font-semibold text-[#334155] outline-none">
            <option value="all">All segments</option><option value="general">General</option><option value="health">Health</option><option value="life">Life</option>
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-xl border border-[#D6DFEB] bg-white px-3 text-[10px] font-semibold text-[#334155] outline-none">
            <option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All statuses</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead className="bg-[#F8FAFD] text-[8px] font-black uppercase tracking-[.08em] text-[#6F7F93]"><tr><th className="px-4 py-3">Insurance company</th><th className="px-4 py-3">Segment</th><th className="px-4 py-3">SIBPL code</th><th className="px-4 py-3">Portal</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr></thead>
            <tbody className="divide-y divide-[#EDF1F6]">
              {visible.map((row) => (
                <tr key={row.id} className="bg-white text-[10.5px] text-[#334155] hover:bg-[#FBFCFE]">
                  <td className="max-w-[360px] px-4 py-3"><div className="flex items-start gap-2.5"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#EEF4FB] text-[#315B9A]"><ShieldCheck className="h-3.5 w-3.5" /></span><div><Link href={`/master-data/insurance-companies/${row.id}`} className="font-bold leading-4 text-[#17203A] hover:text-[#315B9A]">{row.name}</Link><p className="mt-0.5 text-[8px] text-[#98A2B3]">Updated {new Date(row.updated_at).toLocaleDateString("en-IN")}</p></div></div></td>
                  <td className="px-4 py-3"><span className="rounded-full border border-[#DCE5F0] bg-[#F8FAFD] px-2.5 py-1 text-[8.5px] font-bold text-[#52647D]">{row.segment ? segmentLabel[row.segment] : "Legacy / unclassified"}</span></td>
                  <td className="px-4 py-3 font-semibold text-[#17203A]">{row.sibpl_code || "—"}</td>
                  <td className="px-4 py-3">{row.portal_status === "configured" && row.portal_url ? <a href={row.portal_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-[#315B9A] hover:underline">Open portal <ExternalLink className="h-3 w-3" /></a> : <span className={`text-[9px] font-semibold ${row.portal_status === "pending" ? "text-amber-700" : "text-[#98A2B3]"}`}>{row.portal_status === "pending" ? "Pending" : "Not provided"}</span>}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[8.5px] font-bold ${row.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{row.is_active ? "Active" : "Inactive"}</span></td>
                  <td className="px-4 py-3 text-right"><Link href={`/master-data/insurance-companies/${row.id}`} className="rounded-lg border border-[#D6DFEB] bg-white px-3 py-2 text-[9px] font-bold text-[#17365D] hover:bg-[#F8FAFD]">Review</Link></td>
                </tr>
              ))}
              {!visible.length ? <tr><td colSpan={6} className="px-4 py-12 text-center"><p className="text-[11px] font-semibold text-[#475467]">No insurance companies match these filters.</p><p className="mt-1 text-[9px] text-[#98A2B3]">Clear the search or change segment/status.</p></td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
