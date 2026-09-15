import { OperationsClaimStages } from "@/components/claim-manager/operations-claim-stages";
import { FinalDocumentsWorkspaceV2 } from "@/components/final-documents/final-documents-workspace-v2";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { SpotClaimHeader, SpotSurveyWorkspace } from "@/components/spot-survey/spot-survey-workspace-v2";
import { loadPartnerClaimOperationsWorkspace } from "@/lib/partner-claim-operations";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PartnerClaimDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ stage?: string }>;
}) {
  const { id } = await params;
  const requestedStage = (await searchParams)?.stage;
  const data = await loadPartnerClaimOperationsWorkspace(id);
  const title = `Documents Verification - ${data.claimForVerification.claim_no}${data.claimForVerification.insurer_claim_no ? ` / ${data.claimForVerification.insurer_claim_no}` : ""}`;

  return (
    <PartnerPortalShell title={title}>
      <div className="pb-4">
        <div className="[&>section>div:first-child>div:nth-child(3)_img]:grayscale [&>section>div:first-child>div:nth-child(3)_img]:invert [&>section>div:first-child>div:nth-child(3)_img]:contrast-[4] [&>section>div:first-child>div:nth-child(3)_img]:mix-blend-screen">
          <SpotClaimHeader
            claim={{
              ...data.effectiveClaimWithSpotIntimation,
              policySource: data.externalPolicy ? "external" : "sibl",
              policyCopy: data.policyCopy,
            }}
          />
        </div>
        <div className="mt-[6px]">
          <OperationsClaimStages
            claimId={data.claim.id}
            currentStatus={data.claim.current_status}
            insurerClaimNo={data.claim.insurer_claim_no}
            details={data.stageRows}
            accidentAt={data.claim.accident_at}
            spotIntimationAt={data.effectiveClaimWithSpotIntimation.spotIntimationAt}
            spotDetails={data.effectiveSpotDetails}
            spotContent={
              <SpotSurveyWorkspace
                claim={{
                  ...data.effectiveClaimWithSpotIntimation,
                  policySource: data.externalPolicy ? "external" : "sibl",
                  policyCopy: data.policyCopy,
                }}
                documents={data.signedDocs}
                verifications={data.mergedVerifications}
                surveyorDetails={data.surveyorDetails}
                showContext={false}
                showSpotDetails={false}
              />
            }
            claimIntimationContent={
              <FinalDocumentsWorkspaceV2
                claimId={data.claim.id}
                rows={data.finalRows}
                dealershipDetails={data.dealershipDetails}
              />
            }
            initialStageKey={requestedStage}
            externalCustomerMilestones={data.externalCustomerMilestones?.map((milestone) => ({
              key: milestone.milestone_key,
              status: milestone.milestone_status,
            }))}
          />
        </div>
      </div>
    </PartnerPortalShell>
  );
}
