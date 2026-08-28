import { Ionicons } from '@expo/vector-icons';

import { ModulePlaceholder } from '@/components/module-placeholder';
import { PartnerScreen } from '@/components/partner-screen';

export default function ClaimsScreen() {
  return (
    <PartnerScreen eyebrow="SERVICE" title="Claims">
      <ModulePlaceholder
        icon={<Ionicons name="shield-outline" size={26} color="#4F46C8" />}
        title="Claims access is being scoped"
        copy="The Partner app will surface only claims that belong to the user's authorized commercial relationships. The existing customer and operations claim workflows remain separate."
      />
    </PartnerScreen>
  );
}
