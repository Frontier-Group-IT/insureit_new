import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerPolicyIntakeDetailClient } from "@/components/partner-portal/partner-policy-intake-detail-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PartnerPolicyIntakeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PartnerPortalShell title="Policy Intake Detail">
      <PartnerPolicyIntakeDetailClient intakeId={id} />
    </PartnerPortalShell>
  );
}
