import { LegalPage } from '@/components/legal-page';
import { legalDocumentBySlug } from '@/lib/legal-content';

export default function TermsOfUseScreen() {
  return <LegalPage chrome="auth" document={legalDocumentBySlug('terms-of-use')!} />;
}
