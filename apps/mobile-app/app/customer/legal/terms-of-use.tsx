import { LegalPage } from '@/components/legal-page';
import { legalDocumentBySlug } from '@/lib/legal-content';

export default function TermsOfUseScreen() {
  return <LegalPage document={legalDocumentBySlug('terms-of-use')!} />;
}
