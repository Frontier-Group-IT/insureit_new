import { FileText, Layers3, Target, UsersRound } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerPageHeader } from "@/components/partner-portal/partner-page-primitives";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { getPartnerWebNetwork, type PartnerNetworkRow } from "@/lib/partner-web";
import { PartnerNetworkStructure } from "./network-structure";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function keepRootPartnerFamilies(rows: PartnerNetworkRow[], scopeMode: string) {
  // A self-scoped login (including Branch login) is already constrained by the
  // authorized partner_app_network RPC. Avoid the broader hierarchy lookup here:
  // Branch users can legitimately lack RLS visibility to the parent Partner row,
  // which previously turned the Network page into a server-side exception.
  if (scopeMode === "self") return rows;

  const partnerIds = [...new Set(rows.map((row) => row.partner_id).filter(Boolean))];
  if (!partnerIds.length) return rows;

  const supabase = await createServerSupabaseClient();
  const { data: hierarchyRows, error } = await supabase
    .from("partners")
    .select("id, parent_partner_id")
    .in("id", partnerIds);

  if (error) {
    throw new Error(`Partner hierarchy is unavailable: ${error.message}`);
  }

  if ((hierarchyRows ?? []).length !== partnerIds.length) {
    throw new Error("Partner hierarchy is incomplete for the current network scope.");
  }

  const branchIds = new Set(
    (hierarchyRows ?? [])
      .filter((row) => Boolean(row.parent_partner_id))
      .map((row) => row.id),
  );

  return rows.filter((row) => !branchIds.has(row.partner_id));
}

export default async function PartnerNetworkPage() {
  const data = await getPartnerWebNetwork();
  const partnerRows = await keepRootPartnerFamilies(data.partners, data.scope_mode);
  const visibleGroupIds = new Set(
    partnerRows.map((row) => row.group?.group_id).filter((groupId): groupId is string => Boolean(groupId)),
  );
  const totalGroups = visibleGroupIds.size;
  const childCount = partnerRows.reduce((sum, row) => sum + row.child_count, 0);

  return (
    <PartnerPortalShell title="Network">
      <div className="space-y-3">
        <PartnerPageHeader title="Commercial relationships" />

        <section className="grid overflow-hidden rounded-xl border border-[#DFE7F2] bg-white shadow-[0_8px_24px_rgba(49,86,184,0.05)] sm:grid-cols-2 xl:grid-cols-4">
          <SummaryMetric label="Partner Families" value={partnerRows.length} icon={<UsersRound className="h-4 w-4" />} iconClass="bg-[#EEF4FF] text-[#2563EB]" />
          <SummaryMetric label="Groups" value={totalGroups} icon={<Layers3 className="h-4 w-4" />} iconClass="bg-[#E7F8EF] text-[#13A36B]" />
          <SummaryMetric label="POSP / MISP" value={childCount} icon={<FileText className="h-4 w-4" />} iconClass="bg-[#F4EAFE] text-[#8B3FE8]" />
          <SummaryMetric label="Scope" value={humanize(data.scope_mode)} icon={<Target className="h-4 w-4" />} iconClass="bg-[#FFF0DF] text-[#F28A18]" />
        </section>

        {partnerRows.length ? (
          <PartnerNetworkStructure rows={partnerRows} totalGroups={totalGroups} />
        ) : (
          <section className="rounded-xl border border-[#DFE7F2] bg-white px-4 py-10 text-center shadow-[0_8px_24px_rgba(49,86,184,0.05)]">
            <p className="text-[12px] font-bold text-[#23395D]">No commercial network available</p>
            <p className="mt-1 text-[10.5px] text-[#7A899F]">No Partner families are currently visible in this authorized scope.</p>
          </section>
        )}
      </div>
    </PartnerPortalShell>
  );
}

function SummaryMetric({ label, value, icon, iconClass }: { label: string; value: number | string; icon: React.ReactNode; iconClass: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-[#E5EBF3] px-4 py-3 sm:[&:nth-child(odd)]:border-r sm:[&:nth-child(n+3)]:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${iconClass}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[8px] font-black uppercase tracking-[0.08em] text-[#6F8097]">{label}</p>
        <p className="mt-1 truncate text-[15px] font-extrabold leading-none text-[#172846]">{value}</p>
      </div>
    </div>
  );
}
