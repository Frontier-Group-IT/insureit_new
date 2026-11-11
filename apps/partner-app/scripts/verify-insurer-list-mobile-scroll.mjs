import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const screen = readFileSync(new URL('../app/insurers.tsx', import.meta.url), 'utf8');

// Policy Intake reference layout: one horizontal metric/date/sort strip.
assert.match(screen, /function displayInsurerName\(name: string\): string/);
assert.match(screen, /const NAME_ALIASES: Array<\[RegExp, string\]>/);
for (const alias of ['United India', 'New India', 'ICICI Lombard', 'Tata AIG', 'Go Digit'])
  assert.ok(screen.includes(alias), 'Required short name ' + alias);
assert.match(screen, /accessibilityLabel=\{insurer\.name\}/);
assert.match(screen, /numberOfLines=\{2\} ellipsizeMode="tail"/);
assert.match(screen, /BUSINESS PERFORMANCE/);
assert.match(screen, /bar-chart-outline/);
assert.match(screen, /hideTopBar fullWidth/, 'Do not show the old building icon navy header');
assert.match(screen, /contentContainerStyle=\{styles\.filterRow\}/);
assert.match(screen, /Date Range, open date picker/);
assert.match(screen, /Sort insurer register/);
assert.ok(screen.indexOf('Date Range, open date picker') < screen.indexOf('Sort insurer register'), 'Sort must be the final filter');
assert.doesNotMatch(screen, /sortButton|searchRow|tableScrollRef|Swipe table sideways/, 'No separate sort button or old scroll table');
assert.match(screen, /ref=\{amountScrollRef\}/);
assert.match(screen, /styles\.fixedNames/, 'Insurer names must stay pinned');
assert.match(screen, /styles\.financialRow/, 'All financial columns must scroll as one register');
for (const label of ["label: 'Policies'", "label: 'Amount'", "label: 'Net Premium'", "label: 'Pay-In'", "label: 'Retention'", "label: 'Payout'"])
  assert.ok(screen.includes(label), 'Missing register column ' + label);
assert.match(screen, /const columns: Array<\{ key: Metric \| 'policies'; label: string \}> = employee/, 'Actor-specific column sets');
assert.match(screen, /getPartnerInsurerRegister\(from, to\)/, 'Keep authorized RPC');
assert.match(screen, /DateTimePicker key=\{pickerTarget\}/, 'Use full-width native date calendar');
assert.match(screen, /setRange\(draft\)/, 'Applied range must cause query refresh');
assert.match(screen, /validDateRange\(draft\.from, draft\.to\)/, 'Reject invalid ranges');
assert.match(screen, /sortOptions\.map/, 'Real sort menu is required');
assert.match(screen, /sortForCurrentUser === 'policies_desc'/);
assert.match(screen, /sortForCurrentUser === 'payin_desc' && employee/, 'Pay-In sorts employee only');
assert.match(screen, /sortForCurrentUser === 'retention_desc' && employee/, 'Retention sorts employee only');
assert.doesNotMatch(screen, /chevron-forward|arrow-forward|summaryCard/, 'No row navigation or summary card');
console.log('Partner insurer full scrollable register, date range and sort regression passed.');
