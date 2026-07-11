import { LegalPage } from '@/components/legal-page';
import { legalDocumentBySlug } from '@/lib/legal-content';

export default function FraudDetectionPolicyScreen() {
  return <LegalPage document={legalDocumentBySlug('fraud-detection-policy')!} />;
}
