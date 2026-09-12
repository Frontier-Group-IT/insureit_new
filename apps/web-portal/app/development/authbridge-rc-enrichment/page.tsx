import { redirect } from "next/navigation";

import { AppShell } from "@/components/shell";
import AuthbridgeRcEnrichmentWorkspace from "@/components/development/authbridge-rc-enrichment-workspace";
import { requireCapability } from "@/lib/master-data-server";

export const dynamic = "force-dynamic";

export default async function AuthbridgeRcEnrichmentDevelopmentPage() {
  const profile = await requireCapability("manage_system", "approve");
  if (profile.role !== "it_super_user") redirect("/access-denied");

  return (
    <AppShell title="AuthBridge RC Enrichment">
      <AuthbridgeRcEnrichmentWorkspace />
    </AppShell>
  );
}
