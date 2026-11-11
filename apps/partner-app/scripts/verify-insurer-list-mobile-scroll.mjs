import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const screen = readFileSync(new URL('../app/insurers.tsx', import.meta.url), 'utf8');

// Reference redesign: financial metric pills + date range replace sideways tables.
assert.match(screen, /function displayInsurerName\(name: string\): string/);
assert.match(screen, /const NAME_ALIASES: Array<\[RegExp, string\]>/);
for (const alias of ['United India', 'New India', 'ICICI Lombard', 'Tata AIG', 'Go Digit'])
  assert.ok(screen.includes(alias), `Required short company name: ${alias}`);
assert.match(screen, /accessibilityLabel=\{insurer\.name\}/, 'Full legal name stays accessible');
assert.match(screen, /numberOfLines=\{2\} ellipsizeMode="tail"/);
assert.doesNotMatch(screen, /tableScrollRef|Swipe table sideways|Amounts →|← Insurers/, 'Remove old sideways navigation');
assert.match(screen, /contentContainerStyle=\{styles\.filterRow\}/, 'Metric row is scrollable on narrow phones');
assert.match(screen, /Date Range, open date picker/, 'Date Range control follows financial metrics');
assert.match(screen, /<PartnerDatePicker label="From Date"/);
assert.match(screen, /<PartnerDatePicker label="To Date"/);
assert.match(screen, /validDateRange\(draft\.from, draft\.to\)/, 'Reject invalid or oversized date range');
assert.match(screen, /setRange\(draft\)/, 'Apply only validated dates');
assert.match(screen, /getPartnerInsurerRegister\(from, to\)/, 'Keep authorized RPC');
assert.match(screen, /const options: Array<\{ key: Metric; label: string \}> = employee/, 'Scope metric options to actor identity');
assert.match(screen, /\{ key: 'payin', label: 'Pay-In' \}/);
assert.match(screen, /\{ key: 'retention', label: 'Retention' \}/);
assert.match(screen, /\{ key: 'payout', label: 'Payout' \}/);
assert.match(screen, /const selectedMetric = options\.some/, 'Cannot select employee-only metric as partner');
assert.match(screen, /metricValue\(insurer, selectedMetric\)/, 'Metric actually updates displayed amounts');
assert.match(screen, /search\.trim\(\)/, 'Client-side search implemented');
assert.match(screen, /<PartnerInsurerLogo name=\{insurer\.name\}/);
assert.doesNotMatch(screen, /chevron-forward|arrow-forward|styles\.summaryCard/, 'No row arrows or summary card');
console.log('Partner insurer performance compact vertical register regression passed.');
