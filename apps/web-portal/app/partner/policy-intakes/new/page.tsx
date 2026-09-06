import { redirect } from "next/navigation";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerPolicyIntakeNewClient } from "@/components/partner-portal/partner-policy-intake-new-client";
import { getPartnerExternalRenewalDetail, getPartnerExternalRenewalIntakeLink } from "@/lib/partner-external-renewals";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const INTAKE_READY_STATUSES = new Set(["connected", "interested", "quote_requested", "quote_shared", "follow_up"]);

function cleanMobile(value: string | null | undefined) {
  const mobile = String(value ?? "").replace(/\D/g, "").slice(-10);
  return /^[6-9][0-9]{9}$/.test(mobile) ? mobile : "";
}

export default async function PartnerPolicyIntakeNewPage({
  searchParams,
}: {
  searchParams: Promise<{ external_opportunity?: string }>;
}) {
  const query = await searchParams;
  const opportunityId = query.external_opportunity?.trim();
  let externalRenewal: {
    opportunityId: string;
    mobile: string;
    customerLabel: string;
    vehicleLabel: string;
    policyLabel: string;
  } | null = null;

  if (opportunityId) {
    const [detail, existingLink] = await Promise.all([
      getPartnerExternalRenewalDetail(opportunityId),
      getPartnerExternalRenewalIntakeLink(opportunityId),
    ]);

    if (existingLink?.intake_id) {
      redirect("/partner/policy-intakes/" + encodeURIComponent(existingLink.intake_id));
    }

    if (!INTAKE_READY_STATUSES.has(detail.opportunity.opportunity_status)) {
      const target = "/partner/renewals/external/" + encodeURIComponent(opportunityId) + "?error=" + encodeURIComponent("Record customer interest before starting Policy Intake.");
      redirect(target);
    }

    const opportunity = detail.opportunity;
    externalRenewal = {
      opportunityId,
      mobile: cleanMobile(opportunity.mobile),
      customerLabel: opportunity.account_name || opportunity.customer_name || opportunity.contact_name || "Customer",
      vehicleLabel: [opportunity.registration_no || opportunity.chassis_no, opportunity.vehicle_make, opportunity.vehicle_model].filter(Boolean).join(" · ") || "Vehicle not recorded",
      policyLabel: [opportunity.current_policy_no, opportunity.current_insurer].filter(Boolean).join(" · ") || "Policy not recorded",
    };
  }

  return (
    <PartnerPortalShell title="New Policy Intake">
      <PartnerPolicyIntakeNewClient externalRenewal={externalRenewal} />
    </PartnerPortalShell>
  );
}
