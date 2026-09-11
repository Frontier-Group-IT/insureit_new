import { ArrowRight, BarChart3, Building2, FileText, Layers3, Network, RefreshCcw, ShieldCheck, Target, UserRound, UsersRound } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerPageHeader } from "@/components/partner-portal/partner-page-primitives";
import { getPartnerWebNetwork, type PartnerNetworkRow } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function currency(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0);
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function PartnerNetworkPage() {
  const data = await getPartnerWebNetwork();
  const childCount = data.partners.reduce((sum, row) => sum + row.child_count, 0);

  const grouped = new Map<string, { label: string; owner: string | null; rows: PartnerNetworkRow[] }>();
  for (const row of data.partners) {
    const key = row.group?.group_id || "ungrouped:" + (row.owner.employee_id || "none");
    const existing = grouped.get(key);
    if (existing) existing.rows.push(row);
    else grouped.set(key, { label: row.group?.group_name || "Ungrouped", owner: row.owner.name, rows: [row] });
  }
  const sections = [...grouped.entries()].map(([key, value]) => ({ key, ...value }));

  return (
    <PartnerPortalShell title="Network">
      <div className="space-y-7">
        <PartnerPageHeader title="Commercial relationships" />

        <div className="grid overflow-hidden rounded-xl border border-[#E3EAF3] bg-white shadow-[0_8px_24px_rgba(49,86,184,0.06)] sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex min-w-0 items-center gap-3 border-b border-[#E3EAF3] px-4 py-3.5 sm:border-r xl:border-b-0">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#EEF4FF] text-[#2563EB]"><UsersRound className="h-5 w-5" /></span>
            <div className="min-w-0"><p className="text-[8.5px] font-black uppercase tracking-[0.09em] text-[#6E8099]">Partner Families</p><p className="mt-1 text-[18px] font-extrabold leading-none text-[#162746]">{data.total_partners}</p></div>
          </div>
          <div className="flex min-w-0 items-center gap-3 border-b border-[#E3EAF3] px-4 py-3.5 xl:border-b-0 xl:border-r">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#E7F8EF] text-[#13A36B]"><Layers3 className="h-5 w-5" /></span>
            <div className="min-w-0"><p className="text-[8.5px] font-black uppercase tracking-[0.09em] text-[#6E8099]">Groups</p><p className="mt-1 text-[18px] font-extrabold leading-none text-[#162746]">{data.total_groups}</p></div>
          </div>
          <div className="flex min-w-0 items-center gap-3 border-b border-[#E3EAF3] px-4 py-3.5 sm:border-r sm:border-b-0 xl:border-r">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F4EAFE] text-[#8B3FE8]"><FileText className="h-5 w-5" /></span>
            <div className="min-w-0"><p className="text-[8.5px] font-black uppercase tracking-[0.09em] text-[#6E8099]">POSP / MISP</p><p className="mt-1 text-[18px] font-extrabold leading-none text-[#162746]">{childCount}</p></div>
          </div>
          <div className="flex min-w-0 items-center gap-3 px-4 py-3.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#FFF0DF] text-[#F28A18]"><Target className="h-5 w-5" /></span>
            <div className="min-w-0"><p className="text-[8.5px] font-black uppercase tracking-[0.09em] text-[#6E8099]">Scope</p><p className="mt-1 truncate text-[15px] font-extrabold leading-none text-[#162746]">{humanize(data.scope_mode)}</p></div>
          </div>
        </div>

        {sections.length ? sections.map((section) => (
          <section key={section.key}>
            <div className="flex flex-col gap-2 rounded-xl border border-[#E3EAF3] bg-white px-4 py-3.5 shadow-[0_6px_20px_rgba(49,86,184,0.05)] sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#EEF4FF] text-[#2563EB]"><Building2 className="h-4 w-4" /></span>
                <div><p className="text-[12px] font-extrabold text-[#172846]">{section.label}</p><p className="mt-0.5 text-[9.5px] font-medium text-[#7A899F]">{section.rows.length} Partner {section.rows.length === 1 ? "family" : "families"}{section.owner ? " · " + section.owner : ""}</p></div>
              </div>
              <ArrowRight className="hidden h-4 w-4 shrink-0 text-[#6E8099] sm:block" />
            </div>

            <div className="divide-y divide-[#E8EDF4]">
              {section.rows.map((row) => (
                <div key={row.partner_id} className="py-5">
                  <div className="flex flex-col gap-4 rounded-xl border border-[#E6EDF6] bg-[#FBFDFF] px-4 py-4 shadow-[0_5px_18px_rgba(49,86,184,0.04)] xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#EEF4FF] text-[#2563EB]"><UserRound className="h-5 w-5" /></span>
                      <div className="min-w-0">
                        <p className="break-words text-[12px] font-extrabold leading-4 text-[#172846]">{row.partner_name}</p>
                        <p className="mt-0.5 text-[9.5px] font-medium text-[#74839A]">{row.partner_code} · {humanize(row.partner_kind)}</p>
                        {row.owner.name ? <p className="mt-1 text-[9px] text-[#8190A5]">Sales owner: {row.owner.name}{row.owner.employee_code ? " · " + row.owner.employee_code : ""}</p> : null}
                      </div>
                    </div>
                    <div className="min-w-[190px] xl:text-right"><p className="text-[9px] font-black uppercase tracking-[0.09em] text-[#75849A]">Premium This Month</p><p className="mt-1 text-[18px] font-extrabold text-[#2563EB]">{currency(row.metrics.premium_this_month)}</p></div>
                  </div>

                  <div className="mt-4 grid gap-2 rounded-xl border border-[#E4EAF2] bg-white p-2 shadow-[0_5px_18px_rgba(49,86,184,0.035)] sm:grid-cols-2 xl:grid-cols-5">
                    <MiniStat label="Policies" value={row.metrics.total_policies} />
                    <MiniStat label="Customers" value={row.metrics.total_customers} />
                    <MiniStat label="This Month" value={row.metrics.policies_this_month} />
                    <MiniStat label="Renewals 30d" value={row.metrics.renewals_30_days} />
                    <MiniStat label="Active Claims" value={row.metrics.active_claims} />
                  </div>

                  <div className="mt-5 border-t border-[#DCE4ED] pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#6E8099]">Partner Family Structure</p>
                      <div className="flex gap-2 text-[9px] font-semibold text-[#74839A]"><span>{row.posp_count} POSP</span><span>·</span><span>{row.misp_count} MISP</span></div>
                    </div>
                    {row.children.length ? (
                      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {row.children.map((child) => (
                          <div key={child.intermediary_id} className="flex items-center gap-3 border-b border-[#E0E7EF] py-3 last:border-b-0">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#EEF4FF] text-[#3156B8]">{child.type === "posp" ? <UserRound className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}</span>
                            <div className="min-w-0"><p className="break-words text-[10.5px] font-extrabold leading-4 text-[#1B2F4E]">{child.name}</p><p className="mt-0.5 text-[9px] font-medium text-[#74839A]">{child.type.toUpperCase()}{child.code ? " · " + child.code : ""}</p></div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 border-y border-[#E0E7EF] py-3 text-[9.5px] font-semibold text-[#667892]">Standalone Partner family — no POSP or MISP child is attached.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )) : (
          <section className="border-y border-[#DCE4ED] px-1 py-14 text-center sm:px-4">
            <Network className="mx-auto h-7 w-7 text-[#9AABC0]" />
            <p className="mt-3 text-[12px] font-bold text-[#23395D]">No commercial network available</p>
            <p className="mt-1 text-[10.5px] text-[#7A899F]">No Partner families are currently visible in this authorized scope.</p>
          </section>
        )}
      </div>
    </PartnerPortalShell>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  const styles = {
    Policies: { Icon: FileText, wrap: "bg-[#F6F9FF] border-[#E1EAFA]", icon: "bg-[#E5F0FF] text-[#2563EB]" },
    Customers: { Icon: UsersRound, wrap: "bg-[#F5FBF8] border-[#DDEFE5]", icon: "bg-[#DCF6E8] text-[#13A36B]" },
    "This Month": { Icon: BarChart3, wrap: "bg-[#FAF7FF] border-[#EBE2FA]", icon: "bg-[#EFE5FF] text-[#7C3AED]" },
    "Renewals 30d": { Icon: RefreshCcw, wrap: "bg-[#FFF9F3] border-[#F4E5D5]", icon: "bg-[#FFE9D3] text-[#F28A18]" },
    "Active Claims": { Icon: ShieldCheck, wrap: "bg-[#FFF7FA] border-[#F6E1E8]", icon: "bg-[#FFE3EC] text-[#E93D68]" },
  } as const;

  const style = styles[label as keyof typeof styles] ?? styles.Policies;
  const Icon = style.Icon;

  return (
    <div className={`flex min-w-0 items-center gap-3 rounded-lg border px-3 py-3 ${style.wrap}`}>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${style.icon}`}><Icon className="h-4 w-4" /></span>
      <div className="min-w-0">
        <p className="text-[15px] font-extrabold leading-none text-[#162746]">{value}</p>
        <p className="mt-1 text-[8.5px] font-bold uppercase tracking-[0.06em] text-[#75849A]">{label}</p>
      </div>
    </div>
  );
}
