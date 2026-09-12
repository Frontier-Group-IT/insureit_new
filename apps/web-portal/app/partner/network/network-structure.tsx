"use client";

import { useMemo, useState } from "react";
import { BarChart3, Building2, ChevronDown, FileText, Layers3, Network, RefreshCcw, Search, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import type { PartnerNetworkRow } from "@/lib/partner-web";

function currency(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0);
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function PartnerNetworkStructure({ rows, totalGroups }: { rows: PartnerNetworkRow[]; totalGroups: number }) {
  const [query, setQuery] = useState("");

  const sections = useMemo(() => {
    const grouped = new Map<string, { label: string; owner: string | null; rows: PartnerNetworkRow[] }>();
    for (const row of rows) {
      const key = row.group?.group_id || "ungrouped:" + (row.owner.employee_id || "none");
      const existing = grouped.get(key);
      if (existing) existing.rows.push(row);
      else grouped.set(key, { label: row.group?.group_name || "Ungrouped", owner: row.owner.name, rows: [row] });
    }

    const normalizedQuery = query.trim().toLowerCase();
    return [...grouped.entries()]
      .map(([key, value]) => ({ key, ...value }))
      .map((section) => {
        if (!normalizedQuery) return section;
        if (`${section.label} ${section.owner ?? ""}`.toLowerCase().includes(normalizedQuery)) return section;
        return {
          ...section,
          rows: section.rows.filter((row) => [
            row.partner_name,
            row.partner_code,
            row.partner_kind,
            row.owner.name ?? "",
            row.owner.employee_code ?? "",
            ...row.children.flatMap((child) => [child.name, child.code ?? "", child.type]),
          ].join(" ").toLowerCase().includes(normalizedQuery)),
        };
      })
      .filter((section) => section.rows.length > 0);
  }, [query, rows]);

  const rootMetrics = useMemo(() => ({
    partnerFamilies: rows.length,
    groups: totalGroups,
    children: rows.reduce((sum, row) => sum + row.child_count, 0),
    policies: rows.reduce((sum, row) => sum + row.metrics.total_policies, 0),
    customers: rows.reduce((sum, row) => sum + row.metrics.total_customers, 0),
  }), [rows, totalGroups]);

  const rootLabel = useMemo(() => {
    const namedGroups = sections.filter((section) => !section.key.startsWith("ungrouped:"));
    if (totalGroups === 1 && namedGroups.length === 1) return namedGroups[0].label;
    if (rows.length === 1) return rows[0].partner_name;
    return "Partner Network";
  }, [rows, sections, totalGroups]);

  return (
    <section className="overflow-hidden rounded-xl border border-[#DFE7F2] bg-white shadow-[0_8px_24px_rgba(49,86,184,0.05)]">
      <div className="flex flex-col gap-3 border-b border-[#E6ECF4] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#EEF4FF] text-[#2563EB]"><Network className="h-4 w-4" /></span>
          <div className="min-w-0">
            <h2 className="text-[13px] font-extrabold text-[#172846]">Partner Family Structure</h2>
            <p className="mt-0.5 text-[9.5px] font-medium text-[#7A899F]">View and manage the complete hierarchy of your partner network.</p>
          </div>
        </div>
        <label className="flex h-9 w-full items-center gap-2 rounded-lg border border-[#DCE5F1] bg-white px-3 sm:w-[280px]">
          <Search className="h-3.5 w-3.5 shrink-0 text-[#71839B]" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search partner, group or POSP/MISP..." className="min-w-0 flex-1 bg-transparent text-[9.5px] font-medium text-[#213A60] outline-none placeholder:text-[#8B99AB]" />
        </label>
      </div>

      <details open className="group/root border-b border-[#E3EAF4]">
        <summary className="flex cursor-pointer list-none flex-col gap-3 bg-[#F1F6FD] px-4 py-3.5 marker:content-none sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#E2EEFF] text-[#2563EB]"><Network className="h-4.5 w-4.5" /></span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-[11.5px] font-extrabold text-[#172846]">{rootLabel}</p>
                <span className="rounded-full bg-white px-2 py-0.5 text-[7.5px] font-black text-[#2563EB] ring-1 ring-[#D6E3F8]">Main Group</span>
              </div>
              <p className="mt-0.5 text-[8.5px] font-medium text-[#73839A]">Top level of the current partner network.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:justify-end">
            <RootMetric label="Partner Families" value={rootMetrics.partnerFamilies} Icon={UsersRound} tone="blue" />
            <RootMetric label="Groups" value={rootMetrics.groups} Icon={Layers3} tone="green" />
            <RootMetric label="POSP / MISP" value={rootMetrics.children} Icon={FileText} tone="purple" />
            <RootMetric label="Policies" value={rootMetrics.policies} Icon={FileText} tone="purple" />
            <RootMetric label="Customers" value={rootMetrics.customers} Icon={UsersRound} tone="cyan" />
            <ChevronDown className="h-4 w-4 text-[#617895] transition-transform group-open/root:rotate-180" />
          </div>
        </summary>

        <div className="p-3">
          {sections.length ? <div className="space-y-2">{sections.map((section) => {
            const hideUngroupedHeader = section.key.startsWith("ungrouped:") && totalGroups === 0 && section.label.trim().toLowerCase() === "ungrouped";
            return <div key={section.key} className="overflow-hidden rounded-lg border border-[#E1E8F2] bg-white">
              {!hideUngroupedHeader ? <div className="flex items-center justify-between gap-3 bg-[#F8FBFF] px-3.5 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#E9F1FF] text-[#2563EB]"><Building2 className="h-4 w-4" /></span>
                  <div className="min-w-0"><p className="truncate text-[10.5px] font-extrabold text-[#183057]">{section.label}</p><p className="mt-0.5 text-[8.5px] font-medium text-[#7A899F]">{section.rows.length} Partner {section.rows.length === 1 ? "family" : "families"}{section.owner ? ` · ${section.owner}` : ""}</p></div>
                </div>
              </div> : null}

              <div className="divide-y divide-[#E8EDF4]">{section.rows.map((row) => <details key={row.partner_id} open className="group bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#EEF4FF] text-[#2563EB]"><UserRound className="h-4 w-4" /></span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><p className="truncate text-[11px] font-extrabold text-[#172846]">{row.partner_name}</p><span className="rounded-full bg-[#EAF2FF] px-2 py-0.5 text-[7.5px] font-black text-[#2563EB]">{humanize(row.partner_kind)}</span></div>
                      <p className="mt-0.5 text-[8.5px] font-medium text-[#73839A]">{row.partner_code}{row.owner.name ? ` · ${row.owner.name}` : ""}{row.owner.employee_code ? ` · ${row.owner.employee_code}` : ""}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-4"><div className="hidden text-right md:block"><p className="text-[7.5px] font-black uppercase tracking-[0.08em] text-[#7A899E]">Premium This Month</p><p className="mt-1 text-[13px] font-extrabold text-[#2563EB]">{currency(row.metrics.premium_this_month)}</p></div><ChevronDown className="h-4 w-4 text-[#617895] transition-transform group-open:rotate-180" /></div>
                </summary>

                <div className="border-t border-[#EDF1F6] bg-[#FBFDFF] px-3.5 pb-3 pt-2.5">
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                    <InlineMetric label="Policies" value={row.metrics.total_policies} Icon={FileText} tone="blue" />
                    <InlineMetric label="Customers" value={row.metrics.total_customers} Icon={UsersRound} tone="green" />
                    <InlineMetric label="This Month" value={row.metrics.policies_this_month} Icon={BarChart3} tone="purple" />
                    <InlineMetric label="Renewals 30d" value={row.metrics.renewals_30_days} Icon={RefreshCcw} tone="orange" />
                    <InlineMetric label="Active Claims" value={row.metrics.active_claims} Icon={ShieldCheck} tone="pink" />
                  </div>

                  {row.children.length ? <div className="mt-2.5 space-y-1.5">{row.children.map((child) => <div key={child.intermediary_id} className="flex items-center justify-between gap-3 rounded-lg border border-[#E7EDF5] bg-white px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#F4ECFF] text-[#7C3AED]">{child.type === "posp" ? <UserRound className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}</span><div className="min-w-0"><p className="truncate text-[10px] font-extrabold text-[#1C3151]">{child.name}</p><p className="mt-0.5 text-[8.5px] font-medium text-[#7A899F]">{child.type.toUpperCase()}{child.code ? ` · ${child.code}` : ""}</p></div></div>
                  </div>)}</div> : <div className="mt-2.5 flex items-center gap-2.5 rounded-lg border border-dashed border-[#D9E4F1] bg-[#F7FAFE] px-3 py-2.5"><Network className="h-4 w-4 shrink-0 text-[#7990AE]" /><p className="text-[9px] font-semibold text-[#687B95]">No POSP or MISP partner is attached to this Partner family.</p></div>}
                </div>
              </details>)}</div>
            </div>;
          })}</div> : <div className="flex min-h-[120px] flex-col items-center justify-center rounded-lg border border-dashed border-[#D8E3F0] bg-[#F8FBFF] px-4 text-center"><Search className="h-5 w-5 text-[#8AA0BB]" /><p className="mt-2 text-[10.5px] font-bold text-[#29415F]">No matching network member found</p><p className="mt-1 text-[9px] text-[#7A899F]">Try a partner, group, code, POSP or MISP name.</p></div>}
        </div>
      </details>
    </section>
  );
}

function RootMetric({ label, value, Icon, tone }: { label: string; value: number; Icon: React.ComponentType<{ className?: string }>; tone: "blue" | "green" | "purple" | "cyan" }) {
  const tones = {
    blue: "bg-[#E8F1FF] text-[#2563EB]",
    green: "bg-[#E8F8F0] text-[#13A36B]",
    purple: "bg-[#F2EAFF] text-[#7C3AED]",
    cyan: "bg-[#E8F8FB] text-[#0EA5B7]",
  } as const;
  return <div className="flex items-center gap-2"><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${tones[tone]}`}><Icon className="h-3.5 w-3.5" /></span><div><p className="text-[10.5px] font-extrabold leading-none text-[#172846]">{value}</p><p className="mt-1 text-[7px] font-bold text-[#78879B]">{label}</p></div></div>;
}

function InlineMetric({ label, value, Icon, tone }: { label: string; value: number; Icon: React.ComponentType<{ className?: string }>; tone: "blue" | "green" | "purple" | "orange" | "pink" }) {
  const tones = { blue: "bg-[#EEF4FF] text-[#2563EB]", green: "bg-[#E8F8F0] text-[#13A36B]", purple: "bg-[#F2EAFF] text-[#7C3AED]", orange: "bg-[#FFF0DF] text-[#F28A18]", pink: "bg-[#FFEAF1] text-[#E93D68]" } as const;
  return <div className="flex items-center gap-2.5 rounded-lg border border-[#E7EDF5] bg-white px-3 py-2"><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${tones[tone]}`}><Icon className="h-3.5 w-3.5" /></span><div className="min-w-0"><p className="text-[12px] font-extrabold leading-none text-[#172846]">{value}</p><p className="mt-1 text-[7.5px] font-black uppercase tracking-[0.06em] text-[#78879B]">{label}</p></div></div>;
}
