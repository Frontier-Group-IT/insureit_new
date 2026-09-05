import fs from 'node:fs';

const path = 'apps/mobile-app/app/customer/internal-claim-stage.tsx';
const source = fs.readFileSync(path, 'utf8');

const stageOne = source.slice(source.indexOf("if (stageKey === 'spot_intimation')"), source.indexOf("if (stageKey === 'spot_status')"));
const required = [
  '<ExternalClaimStageHeader',
  'step={1}',
  'title="Spot Intimation"',
  'subtitle="Start tracking an incident."',
  '<ClaimIdentityCard',
];

for (const token of required) {
  if (!stageOne.includes(token)) {
    throw new Error(`Internal Stage 1 header parity regression: missing ${token}`);
  }
}

if (stageOne.includes('<InternalSpotIntimationIdentityCard')) {
  throw new Error('Internal Stage 1 must not use the legacy custom identity header.');
}

console.log('Internal Stage 1 uses the same external claim header and identity card.');
