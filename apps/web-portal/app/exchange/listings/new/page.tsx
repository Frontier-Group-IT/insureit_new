import { redirect } from "next/navigation";
import { ClaimManagerShell } from "@/components/claim-manager/claim-manager-shell";
import { InternalExchangeListingWorkspace } from "@/components/exchange/internal-exchange-listing-workspace";
import { requireCapability } from "@/lib/master-data-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const allowedRoles = new Set(["it_super_user", "super_admin", "sales_operations_head"]);

export default async function InternalExchangeListingPage() {
  const profile = await requireCapability("create_exchange_listings", "edit");
  if (!allowedRoles.has(String(profile.role))) redirect("/access-denied");

  return (
    <ClaimManagerShell title="Exchange Listing" activeNav="exchange">
      <InternalExchangeListingWorkspace />
    </ClaimManagerShell>
  );
}
