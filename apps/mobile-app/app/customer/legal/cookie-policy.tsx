import { LegalPage } from '@/components/legal-page';
import { legalDocumentBySlug } from '@/lib/legal-content';

export default function CookiePolicyScreen() {
  return <LegalPage document={legalDocumentBySlug('cookie-policy')!} />;
}
