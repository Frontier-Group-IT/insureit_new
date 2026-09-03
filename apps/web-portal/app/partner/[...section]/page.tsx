import { notFound } from "next/navigation";
import { getPartnerWebSession } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PartnerUnknownRoutePage() {
  await getPartnerWebSession();
  notFound();
}
