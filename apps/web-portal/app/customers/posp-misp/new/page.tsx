import { redirect } from "next/navigation";
import { renderNewOnboardingPage, type NewOnboardingQuery } from "./new-onboarding-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Query = NewOnboardingQuery & { partner_type?: string };

export default async function NewPospMispPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams;
  const partnerType = query.partner_type;
  if (partnerType !== "posp" && partnerType !== "misp") redirect("/customers/posp-misp");
  return renderNewOnboardingPage(partnerType, query);
}
