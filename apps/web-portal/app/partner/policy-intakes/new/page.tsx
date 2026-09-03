import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerPolicyIntakeNewClient } from "@/components/partner-portal/partner-policy-intake-new-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function PartnerPolicyIntakeNewPage() {
  return (
    <PartnerPortalShell title="New Policy Intake">
      <PartnerPolicyIntakeNewClient />
    </PartnerPortalShell>
  );
}
