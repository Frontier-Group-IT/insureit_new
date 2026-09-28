import fs from 'node:fs';

const source = fs.readFileSync(new URL('../app/customer/claims.tsx', import.meta.url), 'utf8');

function expectIncludes(value, label) {
  if (!source.includes(value)) {
    console.error(`Missing ${label}: ${value}`);
    process.exit(1);
  }
}

function expectNotIncludes(value, label) {
  if (source.includes(value)) {
    console.error(`Unexpected ${label}: ${value}`);
    process.exit(1);
  }
}

expectNotIncludes('styles.statusIcon', 'secondary claim/status icon render');
expectNotIncludes('claimCardIcons', 'secondary claim/status icon asset map');
expectNotIncludes('claimCardIcon(', 'secondary claim/status icon resolver');
expectIncludes('internalProjection?.stageLabel ?? claim.current_status', 'internal actual journey stage label');
expectNotIncludes('internalProjection?.substage ?? claim.current_status', 'internal customer-action substage on claim card');
expectIncludes('styles.externalMilestoneRightValue', 'shared red milestone style binding');
expectIncludes("externalMilestoneRightValue: { color: '#C43838' }", 'shared milestone red style');

console.log('Customer claims card icon/status styling regression passed.');
