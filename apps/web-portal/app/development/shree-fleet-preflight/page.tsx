import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import ShreeFleetAuthbridgePreflight from "@/components/development/shree-fleet-authbridge-preflight";
import { requireCapability } from "@/lib/master-data-server";

export const dynamic = "force-dynamic";

export default async function ShreeFleetPreflightPage() {
 const profile = await requireCapability("manage_system","approve");
 if(profile.role !== "it_super_user") redirect("/access-denied");
 return <AppShell title="Shree Transport Fleet Import"><ShreeFleetAuthbridgePreflight /></AppShell>;
}
