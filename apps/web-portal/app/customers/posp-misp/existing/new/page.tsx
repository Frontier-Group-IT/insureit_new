import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Query = {
  partner_type?: string;
};

export default async function ExistingIntermediaryNewPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const query = await searchParams;
  const partnerType = query.partner_type === "misp" ? "misp" : "posp";

  redirect(`/customers/posp-misp/new?partner_type=${partnerType}&legacy_mode=existing`);
}
