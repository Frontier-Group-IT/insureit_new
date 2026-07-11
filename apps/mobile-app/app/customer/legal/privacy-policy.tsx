import { LegalPage } from '@/components/legal-page';
import { legalDocumentBySlug } from '@/lib/legal-content';

export default function PrivacyPolicyScreen() {
  return <LegalPage document={legalDocumentBySlug('privacy-policy')!} />;
}
