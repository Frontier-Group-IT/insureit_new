import { redirect } from "next/navigation";
import { getPartnerWebSession } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PartnerAccountBridgePage() {
  await getPartnerWebSession();
  redirect("/intermediary-portal");
}
