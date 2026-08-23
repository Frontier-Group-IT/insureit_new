import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";

export default async function ReconciliationLayout({ children }: { children: ReactNode }) {
  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) redirect("/access-denied");
  return children;
}
