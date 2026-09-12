import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { getPartnerWebSession } from "@/lib/partner-web";
import { RenewalVoiceLab } from "./renewal-voice-lab";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RenewalVoiceLabPage() {
  await getPartnerWebSession();

  return (
    <PartnerPortalShell title="AI Renewal Voice Lab">
      <RenewalVoiceLab />
    </PartnerPortalShell>
  );
}
