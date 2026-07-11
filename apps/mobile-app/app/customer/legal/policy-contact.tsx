import { LegalPage } from '@/components/legal-page';
import { legalDocumentBySlug } from '@/lib/legal-content';

export default function PolicyContactScreen() {
  return <LegalPage document={legalDocumentBySlug('policy-contact')!} />;
}
