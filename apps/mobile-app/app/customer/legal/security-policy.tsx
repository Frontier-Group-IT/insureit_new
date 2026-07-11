import { LegalPage } from '@/components/legal-page';
import { legalDocumentBySlug } from '@/lib/legal-content';

export default function SecurityPolicyScreen() {
  return <LegalPage document={legalDocumentBySlug('security-policy')!} />;
}
