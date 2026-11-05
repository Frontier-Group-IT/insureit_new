import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const screen = readFileSync(new URL('../app/insurers.tsx', import.meta.url), 'utf8');

// Narrow phone: compact readable legal-name aliases and a visible financial-scroll control.
assert.match(screen, /const NAME_WIDTH = 158;/);
assert.match(screen, /const METRIC_WIDTH = 112;/);
assert.match(screen, /function displayInsurerName\(name: string\): string/);
assert.match(screen, /accessibilityLabel=\{insurer\.name\}/, 'Keep full legal name for accessibility.');
assert.match(screen, /numberOfLines=\{2\} ellipsizeMode="tail"/, 'Keep two-line readable truncation.');
assert.match(screen, /Swipe table sideways for/);
assert.match(screen, /Amounts →/);
assert.match(screen, /← Insurers/);
assert.match(screen, /tableScrollRef\.current\?\.scrollTo/, 'Show a working amount navigation control.');
assert.match(screen, /ref=\{tableScrollRef\}/);
assert.match(screen, /horizontal\s+nestedScrollEnabled\s+directionalLockEnabled/);
assert.match(screen, /showsHorizontalScrollIndicator/);
assert.match(screen, /accessibilityLabel="Insurer performance table, scroll horizontally/);
assert.match(screen, /const columns = employee/, 'Keep employee authorization-dependent columns.');
assert.match(screen, /getPartnerInsurerRegister\(from, to\)/, 'Do not replace authorized data.');
for (const name of ['POLICIES', 'NET PREMIUM', 'PAY-IN', 'RETENTION', 'PAYOUT']) assert.ok(screen.includes(name), 'Missing ' + name);
for (const field of ['premium', 'payin', 'retention', 'payout']) assert.ok(screen.includes(`formatInsurerRupees(insurer.${field})`), 'Missing money field ' + field);
assert.match(screen, /new Intl\.NumberFormat\('en-IN', \{ maximumFractionDigits: 0, minimumFractionDigits: 0 \}\)/, 'Keep nearest whole-rupee presentation.');
console.log('Partner insurer mobile horizontal financial navigation regression passed.');
