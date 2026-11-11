import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const screen = readFileSync(new URL('../app/insurers.tsx', import.meta.url), 'utf8');
const shared = readFileSync(new URL('../lib/format.ts', import.meta.url), 'utf8');

assert.ok(screen.includes("const wholeRupeeFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0, minimumFractionDigits: 0 });"));
assert.ok(screen.includes('function formatInsurerRupees(amount: number | string): string'));
assert.ok(screen.includes('const numericAmount = Number(amount);'));
assert.ok(screen.includes('wholeRupeeFormatter.format(Number.isFinite(numericAmount) ? numericAmount : 0)'));
assert.ok(!screen.includes('formatIndianCurrency'));
assert.ok(shared.includes('hasPaise ? 2 : 0'));

for (const field of ['premium', 'payin', 'retention', 'payout']) {
  assert.ok(screen.includes(`return row.${field}`) || (field === 'premium' && screen.includes('return row.premium')), `Must preserve role-available money field ${field}`);
}
assert.ok(screen.includes("amount == null ? '—' : formatInsurerRupees(amount)"), 'Missing amounts render unavailable, not zero');
assert.ok(screen.includes('numberOfLines={1} adjustsFontSizeToFit'), 'Display full amounts in narrow metric cell');
assert.ok(screen.includes('getPartnerInsurerRegister(from, to)'));
assert.ok(screen.includes("context?.identity.actor_kind === 'employee'"), 'Employee/non-employee amounts remain scoped');
const formatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0, minimumFractionDigits: 0 });
for (const [value, expected] of [
  [592992, '₹5,92,992'], [427895.28, '₹4,27,895'], [153273.96, '₹1,53,274'],
  [8320.85, '₹8,321'], [23.71, '₹24'], [0.53, '₹1'], [0, '₹0'],
]) {
  assert.equal('₹' + formatter.format(value), expected);
}
console.log('Partner insurer performance whole-rupee presentation regression passed.');
