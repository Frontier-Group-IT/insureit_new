import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const screen = readFileSync(new URL('../app/insurers.tsx', import.meta.url), 'utf8');

// Insurer performance reference: compact full-width date filter, single inline calendar,
// pinned insurer names and every actor-authorized financial column in the scrollable register.
assert.match(screen, /function displayInsurerName\(name: string\): string/);
assert.match(screen, /const NAME_ALIASES: Array<\[RegExp, string\]>/);
for (const alias of ['United India', 'New India', 'ICICI Lombard', 'Tata AIG', 'Go Digit'])
  assert.ok(screen.includes(alias), 'Required short name ' + alias);
assert.match(screen, /accessibilityLabel=\{insurer\.name\}/);
assert.match(screen, /numberOfLines=\{2\} ellipsizeMode="tail"/);
assert.match(screen, /BUSINESS PERFORMANCE/);
assert.match(screen, /bar-chart-outline/);
assert.match(screen, /hideTopBar fullWidth/, 'Preserve compact blue header');
assert.match(screen, /accessibilityLabel="Date Range"/, 'Date Range is the only register filter');
assert.match(screen, /styles\.dateRangeTrigger/, 'Full-width date range control remains');
assert.match(screen, /dateExpanded \? \(/, 'Calendar opens immediately beneath Date Range');
assert.match(screen, /calendarCells\.map/, 'Single shared calendar is displayed');
assert.match(screen, /setPickerTarget\('from'\)/, 'Range selects from and to dates');
assert.match(screen, /setPickerTarget\('to'\)/, 'From selection advances to To');
assert.doesNotMatch(screen, /contentContainerStyle=\{styles\.filterRow\}|Sort insurer register|DateTimePicker|dateModalOpen/, 'No financial filter strip, sort modal or native dual picker');
assert.doesNotMatch(screen, /sortButton|searchRow|tableScrollRef|Swipe table sideways/, 'No separate sort button or legacy table');
assert.match(screen, /<ScrollView horizontal nestedScrollEnabled directionalLockEnabled/, 'Financial register scrolls horizontally');
assert.match(screen, /styles\.fixedNames/, 'Insurer names must stay pinned');
assert.match(screen, /styles\.financialRow/, 'All financial columns must scroll as one register');
for (const label of ["label: 'Policies'", "label: 'Amount'", "label: 'Net Premium'", "label: 'Pay-In'", "label: 'Retention'", "label: 'Payout'"])
  assert.ok(screen.includes(label), 'Missing register column ' + label);
assert.match(screen, /const columns: Array<\{ key: Metric \| 'policies'; label: string \}> = employee/, 'Actor-specific column sets');
assert.match(screen, /getPartnerInsurerRegister\(from, to\)/, 'Keep authorized RPC');
assert.match(screen, /setRange\(draft\)/, 'Applying date range refreshes query');
assert.match(screen, /validDateRange\(draft\.from, draft\.to\)/, 'Reject invalid ranges');
assert.match(screen, /if \(sortKey === 'payin_desc' && employee\)/, 'Pay-In sort is employee-only');
assert.match(screen, /if \(sortKey === 'retention_desc' && employee\)/, 'Retention sort is employee-only');
assert.match(screen, /accessibilityLabel=\{\`Sort by \$\{column\.label\}\`\}/, 'Column header sorting preserved');
assert.doesNotMatch(screen, /arrow-forward|summaryCard/, 'No row navigation or summary card');
console.log('Partner insurer inline date range and full scrollable register regression passed.');
