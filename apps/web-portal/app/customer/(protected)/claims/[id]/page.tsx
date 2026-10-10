import { redirect } from "next/navigation";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import { loadCustomerClaimDetail } from "@/lib/customer-web-phase2-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Keep old claim-detail links working while using the canonical stage layout. */
export default async function CustomerClaimDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ account?: string }>;
}) {
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const { account } = await resolveCustomerWebScope(query.account);
  // Authorize this claim within the selected customer account before redirecting.
  const { claim } = await loadCustomerClaimDetail(account.id, id);
  const target = new URLSearchParams({ account: account.id });
  redirect(`/customer/claims/${encodeURIComponent(claim.id)}/stage/spot_intimation?${target.toString()}`);
}
