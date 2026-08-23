import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";
import { listPartnerPayablesWorkbench } from "./actions";
import { PartnerPayablesWorkbench } from "./workbench";

export default async function PartnerPayablesPage(){const profile=await requireCapability("view_accounts");if(!canAccessPolicyCommercials(profile))redirect("/access-denied");const data=await listPartnerPayablesWorkbench();return <AppShell title="Partner Payables"><PartnerPayablesWorkbench data={data}/></AppShell>;}
