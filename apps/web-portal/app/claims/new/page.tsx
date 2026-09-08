import { redirect } from "next/navigation";
import { ClaimManagerShell } from "@/components/claim-manager/claim-manager-shell";
import { requireCapability } from "@/lib/master-data-server";
import { AddClaimForm } from "./add-claim-form";

export default async function AddClaimPage() {
  const profile = await requireCapability("manage_claims", "edit");
  if (!profile?.id) redirect("/access-denied");

  return (
    <ClaimManagerShell title="Add Claim" backHref="/claims" activeNav="dashboard">
      <AddClaimForm />
    </ClaimManagerShell>
  );
}
