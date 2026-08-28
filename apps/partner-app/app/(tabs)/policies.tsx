import { Ionicons } from '@expo/vector-icons';

import { ModulePlaceholder } from '@/components/module-placeholder';
import { PartnerScreen } from '@/components/partner-screen';

export default function PoliciesScreen() {
  return (
    <PartnerScreen eyebrow="BUSINESS" title="Policies">
      <ModulePlaceholder
        icon={<Ionicons name="document-text-outline" size={26} color="#4F46C8" />}
        title="Scoped policy workspace is next"
        copy="Policy production, renewals and customer attribution will be connected only through Partner-app specific scoped contracts. No unrestricted policy table access will be added."
      />
    </PartnerScreen>
  );
}
