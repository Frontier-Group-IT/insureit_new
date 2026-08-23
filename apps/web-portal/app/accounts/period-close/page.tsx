import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";
import { listPeriodCloseWorkbench } from "./actions";
import { PeriodCloseWorkbench } from "./workbench";

export default async function PeriodClosePage(){const profile=await requireCapability("view_accounts");if(!canAccessPolicyCommercials(profile))redirect("/access-denied");const data=await listPeriodCloseWorkbench();return <AppShell title="Period Close"><PeriodCloseWorkbench data={data}/></AppShell>;}
