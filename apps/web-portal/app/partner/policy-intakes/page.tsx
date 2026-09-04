import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerPolicyIntakeListClient } from "@/components/partner-portal/partner-policy-intake-list-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function PartnerPolicyIntakesPage() {
  return (
    <PartnerPortalShell title="Policy Intake">
      <PartnerPolicyIntakeListClient />
    </PartnerPortalShell>
  );
}
