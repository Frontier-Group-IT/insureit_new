const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'app', 'customer', 'report-accident.tsx');
const source = fs.readFileSync(file, 'utf8');

const required = [
  "primaryLabel={submitting || uploadingDocuments ? 'Saving...' : 'Save Details'}",
  "router.replace({ pathname: '/customer/claim-detail', params: { id: claim.id } });",
];

for (const needle of required) {
  if (!source.includes(needle)) {
    console.error(`Stage 1 regression: missing ${needle}`);
    process.exit(1);
  }
}

if (source.includes("router.replace({ pathname: '/customer/upload-documents', params: { claimId: claim.id } });")) {
  console.error('Stage 1 regression: Save Details must not auto-open upload-documents.');
  process.exit(1);
}

console.log('Stage 1 Save Details tracker handoff regression passed.');
