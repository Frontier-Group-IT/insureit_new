import fs from 'node:fs';

const target = process.argv[2];
if (!target) {
  console.error('Usage: node patch-0-1-policy-intake-network.mjs <policy-intake-new.tsx>');
  process.exit(1);
}

let source = fs.readFileSync(target, 'utf8');

const networkImport = "import { usePartnerNetwork } from '@/providers/partner-network-provider';\n";
const networkHook = '  const { isOffline } = usePartnerNetwork();';

if (!source.includes(networkImport)) {
  console.error('Expected Partner network provider import was not found.');
  process.exit(1);
}
if (!source.includes(networkHook)) {
  console.error('Expected Partner network provider hook was not found.');
  process.exit(1);
}

source = source.replace(networkImport, '');
source = source.replace(networkHook, '  const isOffline = false;');

if (source.includes('usePartnerNetwork')) {
  console.error('Partner network provider dependency remains after compatibility patch.');
  process.exit(1);
}

fs.writeFileSync(target, source);
