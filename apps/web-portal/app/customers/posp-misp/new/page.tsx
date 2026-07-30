import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { requirePospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createManualPospMispOnboardingV2 } from "../manual-actions-v2";
import { OnboardingFieldPresentation } from "../onboarding-field-presentation";
import { PospMispOnboardingForm } from "../posp-misp-onboarding-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Query = { partner_type?: string };

export default async function NewPospMispPage({ searchParams }: { searchParams: Promise<Query> }) {
  await requirePospMispManager();
  const query = await searchParams;
  const partnerType = query.partner_type;
  if (partnerType !== "posp" && partnerType !== "misp") redirect("/customers/posp-misp");
  const admin = createSupabaseAdminClient();
  const [oems, banks] = await Promise.all([
    loadVehicleManufacturers(admin),
    loadBanks(admin)
  ]);
  const isMisp = partnerType === "misp";
  const backHref = isMisp ? "/intermediaries/misp" : "/intermediaries/posp";
  const title = isMisp ? "Add MISP Application" : "Add POSP Application";

  return (
    <AppShell title={title} backHref={backHref}>
      <OnboardingFieldPresentation>
        <PospMispOnboardingForm
          action={createManualPospMispOnboardingV2}
          partnerType={partnerType}
          oems={oems}
          banks={banks}
        />
      </OnboardingFieldPresentation>
    </AppShell>
  );
}

async function loadVehicleManufacturers(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data } = await admin.from("vehicle_manufacturers").select("name").eq("is_active", true).order("sort_order", { ascending: true }).order("name", { ascending: true }).returns<Array<{ name: string }>>();
  return (data ?? []).map((manufacturer) => ({ value: manufacturer.name, label: manufacturer.name }));
}

async function loadBanks(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data } = await admin.from("banks").select("id, name").eq("is_active", true).order("name", { ascending: true }).returns<Array<{ id: string; name: string }>>();
  return (data ?? []).map((bank) => ({ value: bank.id, label: bank.name }));
}
