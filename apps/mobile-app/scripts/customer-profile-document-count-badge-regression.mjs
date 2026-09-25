import fs from 'node:fs';

const source = fs.readFileSync(new URL('../app/customer/profile.tsx', import.meta.url), 'utf8');

if (source.includes('styles.kycVaultCount')) {
  console.error('Documents & KYC count badge is still rendered.');
  process.exit(1);
}
if (source.includes('kycVaultCountText')) {
  console.error('Documents & KYC count badge styles are still present.');
  process.exit(1);
}
if (!source.includes("name={documentsOpen ? 'chevron-up' : 'chevron-down'}")) {
  console.error('Documents & KYC expand/collapse control was removed unexpectedly.');
  process.exit(1);
}

console.log('Customer profile document-count badge regression passed.');
