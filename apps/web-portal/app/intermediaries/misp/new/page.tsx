import { renderNewOnboardingPage, type NewOnboardingQuery } from "@/app/customers/posp-misp/new/new-onboarding-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewMispApplicationPage({ searchParams }: { searchParams: Promise<NewOnboardingQuery> }) {
  const query = await searchParams;
  return renderNewOnboardingPage("misp", { ...query, legacy_mode: undefined });
}
