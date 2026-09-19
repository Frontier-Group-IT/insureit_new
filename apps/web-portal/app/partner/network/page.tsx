import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerPageHeader } from "@/components/partner-portal/partner-page-primitives";
import { getPartnerBranchNetworkContacts } from "@/lib/partner-branch-network";
import { getPartnerWebNetwork, getPartnerWebSession, type PartnerNetworkRow } from "@/lib/partner-web";
import { BranchNetworkContacts } from "./branch-network-contacts";
import { PartnerNetworkStructure } from "./network-structure";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PartnerNetworkHierarchyRow = PartnerNetworkRow & {
  parent_partner_id?: string | null;
};

function splitPartnerHierarchy(rows: PartnerNetworkRow[], scopeMode: string) {
  // Self scope can also represent a non-Branch Partner login. If the dedicated
  // Branch contact RPC does not resolve a parent Partner, retain the normal view.
  if (scopeMode === "self") {
    return { rootRows: rows, branchRows: [] as PartnerNetworkHierarchyRow[] };
  }

  const hierarchyRows = rows as PartnerNetworkHierarchyRow[];
  return {
    rootRows: hierarchyRows.filter((row) => !row.parent_partner_id),
    branchRows: hierarchyRows.filter((row) => Boolean(row.parent_partner_id)),
  };
}

export default async function PartnerNetworkPage() {
  const session = await getPartnerWebSession();
  const branchContacts = session.scope.scope_mode === "self" ? await getPartnerBranchNetworkContacts() : null;

  if (branchContacts) {
    return (
      <PartnerPortalShell title="Network">
        <div className="space-y-3">
          <PartnerPageHeader title="Commercial relationships" />
          <BranchNetworkContacts contacts={branchContacts} />
        </div>
      </PartnerPortalShell>
    );
  }

  const data = await getPartnerWebNetwork();
  const { rootRows, branchRows } = splitPartnerHierarchy(data.partners, data.scope_mode);
  const visibleGroupIds = new Set(
    rootRows.map((row) => row.group?.group_id).filter((groupId): groupId is string => Boolean(groupId)),
  );
  const totalGroups = visibleGroupIds.size;

  return (
    <PartnerPortalShell title="Network">
      <div className="space-y-3">
        <PartnerPageHeader title="Commercial relationships" />

        {rootRows.length ? (
          <PartnerNetworkStructure rows={rootRows} branchRows={branchRows} totalGroups={totalGroups} />
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
