import { Building2, GitBranch, Network, UserRound, UsersRound } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
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
      <div className="space-y-4">
        <section className="rounded-[26px] border border-[#D7E0EC] bg-white p-5 shadow-[0_16px_45px_rgba(34,56,89,.07)] sm:p-6">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#687A96]">My Network</p>
            <h2 className="mt-1 text-[23px] font-extrabold tracking-[-0.025em] text-[#142541]">Commercial relationships</h2>
            <p className="mt-1 text-[11px] font-medium text-[#74839A]">This hierarchy comes directly from the backend-authorized Partner family scope; the website does not reconstruct commercial ownership locally.</p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Partner Families" value={data.total_partners} icon={UsersRound} />
            <Metric label="Groups" value={data.total_groups} icon={Building2} />
            <Metric label="POSP / MISP" value={childCount} icon={GitBranch} />
            <Metric label="Scope" value={humanize(data.scope_mode)} icon={Network} />
          </div>
        </section>

        {sections.length ? sections.map((section) => (
          <section key={section.key} className="overflow-hidden rounded-[26px] border border-[#D7E0EC] bg-white shadow-[0_16px_45px_rgba(34,56,89,.07)]">
            <div className="flex flex-col gap-2 border-b border-[#E6ECF3] bg-[#F8FAFD] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-[#3156B8]"><Building2 className="h-4 w-4" /></span>
                <div>
                  <p className="text-[12px] font-extrabold text-[#172846]">{section.label}</p>
                  <p className="mt-0.5 text-[9.5px] font-medium text-[#7A899F]">{section.rows.length} Partner {section.rows.length === 1 ? "family" : "families"}{section.owner ? " · " + section.owner : ""}</p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-[#E8EDF4]">
              {section.rows.map((row) => (
                <div key={row.partner_id} className="px-5 py-5 sm:px-6">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#EEF4FF] text-[#3156B8]"><UserRound className="h-4 w-4" /></span>
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-extrabold text-[#1B2F4E]">{row.partner_name}</p>
                        <p className="mt-0.5 text-[9.5px] font-medium text-[#74839A]">{row.partner_code} · {humanize(row.partner_kind)}</p>
                        {row.owner.name ? <p className="mt-1 text-[9px] text-[#8190A5]">Sales owner: {row.owner.name}{row.owner.employee_code ? " · " + row.owner.employee_code : ""}</p> : null}
                      </div>
                    </div>

                    <div className="min-w-[190px] xl:text-right">
                      <p className="text-[9px] font-black uppercase tracking-[0.09em] text-[#75849A]">Premium This Month</p>
                      <p className="mt-1 text-[18px] font-extrabold text-[#162746]">{currency(row.metrics.premium_this_month)}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                    <MiniStat label="Policies" value={row.metrics.total_policies} />
                    <MiniStat label="Customers" value={row.metrics.total_customers} />
                    <MiniStat label="This Month" value={row.metrics.policies_this_month} />
                    <MiniStat label="Renewals 30d" value={row.metrics.renewals_30_days} />
                    <MiniStat label="Active Claims" value={row.metrics.active_claims} />
                  </div>

                  <div className="mt-4 rounded-2xl border border-[#E1E7F0] bg-[#F8FAFD] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#6E8099]">Partner Family Structure</p>
                      <div className="flex gap-2 text-[9px] font-semibold text-[#74839A]">
                        <span>{row.posp_count} POSP</span><span>·</span><span>{row.misp_count} MISP</span>
                      </div>
                    </div>

                    {row.children.length ? (
                      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {row.children.map((child) => (
                          <div key={child.intermediary_id} className="flex items-center gap-3 rounded-xl border border-[#E1E7F0] bg-white px-3 py-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#EEF4FF] text-[#3156B8]">{child.type === "posp" ? <UserRound className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}</span>
                            <div className="min-w-0">
                              <p className="truncate text-[10.5px] font-extrabold text-[#1B2F4E]">{child.name}</p>
                              <p className="mt-0.5 text-[9px] font-medium text-[#74839A]">{child.type.toUpperCase()}{child.code ? " · " + child.code : ""}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 rounded-xl bg-white px-3 py-3 text-[9.5px] font-semibold text-[#667892]">Standalone Partner family — no POSP or MISP child is attached.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )) : (
          <section className="rounded-[26px] border border-[#D7E0EC] bg-white px-5 py-14 text-center shadow-[0_16px_45px_rgba(34,56,89,.07)]">
            <Network className="mx-auto h-7 w-7 text-[#9AABC0]" />
            <p className="mt-3 text-[12px] font-bold text-[#23395D]">No commercial network available</p>
            <p className="mt-1 text-[10.5px] text-[#7A899F]">No Partner families are currently visible in this authorized scope.</p>
          </section>
        )}
      </div>
    </PartnerPortalShell>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Network }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-[#E1E7F0] bg-[#F8FAFD] p-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-[#3156B8]"><Icon className="h-4 w-4" /></span><div><p className="text-[9px] font-black uppercase tracking-[0.09em] text-[#75849A]">{label}</p><p className="mt-1 text-[18px] font-extrabold text-[#162746]">{value}</p></div></div>;
}
function MiniStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-[#F8FAFD] px-3 py-3 text-center"><p className="text-[15px] font-extrabold text-[#162746]">{value}</p><p className="mt-1 text-[8.5px] font-bold uppercase tracking-[0.08em] text-[#75849A]">{label}</p></div>;
}
