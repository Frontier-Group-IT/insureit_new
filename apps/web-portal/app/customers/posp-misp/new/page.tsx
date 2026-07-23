import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { requireMasterDataManager } from "@/lib/master-data-server";
import { createPospMispOnboarding } from "../actions";
import { PospMispOnboardingForm } from "../posp-misp-onboarding-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewPospMispPage({ searchParams }: { searchParams: Promise<{ partner_type?: string }> }) {
  await requireMasterDataManager();
  const { partner_type: partnerType } = await searchParams;
  if (partnerType !== "posp" && partnerType !== "misp") redirect("/customers/posp-misp");

  return (
    <AppShell title={`Add ${partnerType.toUpperCase()} Application`}>
      <PospMispOnboardingForm action={createPospMispOnboarding} partnerType={partnerType} />
    </AppShell>
  );
}
