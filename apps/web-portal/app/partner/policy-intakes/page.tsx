import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerPolicyIntakeListClient } from "@/components/partner-portal/partner-policy-intake-list-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function PartnerPolicyIntakesPage() {
  return (
    <PartnerPortalShell title="Policy Intake">
      <div data-policy-intake-page>
        <PartnerPolicyIntakeListClient />
        <style>{`
          [data-policy-intake-page] > div > section > div:nth-of-type(2) > button:last-child {
            border-color: #123f73;
            background: #123f73;
            color: #ffffff;
            box-shadow: 0 2px 6px rgba(18, 63, 115, 0.18);
          }

          [data-policy-intake-page] > div > section > div:nth-of-type(2) > button:last-child:hover {
            background: #0f3765;
          }

          [data-policy-intake-page] > div > section > div:nth-of-type(2) > button:last-child > svg {
            display: none;
          }
        `}</style>
      </div>
    </PartnerPortalShell>
  );
}
