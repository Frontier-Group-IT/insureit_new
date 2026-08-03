import { renderNewOnboardingPage, type NewOnboardingQuery } from "@/app/customers/posp-misp/new/new-onboarding-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewPospApplicationPage({ searchParams }: { searchParams: Promise<NewOnboardingQuery> }) {
  const query = await searchParams;
  return renderNewOnboardingPage("posp", { ...query, legacy_mode: undefined });
}
