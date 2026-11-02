import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../app/customer/start-claim.tsx', import.meta.url), 'utf8');

assert.match(source, /<View style=\{\[styles\.policyCard, styles\.policyCardCompact\]\}>/, 'Managed and external policy cards must share the compact card shell.');
assert.match(source, /<View style=\{\[styles\.policyContent, styles\.policyContentCompact\]\}>/, 'Managed and external policy cards must share compact content spacing.');
assert.match(source, /<View style=\{\[styles\.policyIcon, styles\.policyIconCompact\]\}>/, 'Managed and external policy cards must share compact icon sizing.');
assert.match(source, /<PolicyStatusPulse condition=\{selectedPolicyCondition \?\? 'active'\} \/>/, 'All managed/external Active, Due and Expired states must use the same animated status pulse.');
assert.doesNotMatch(source, /selectedPolicy\.source === 'external' && styles\.policyCardCompact/, 'Compact policy-card styling must not be limited to external policies.');

console.log('Managed claim card parity regression passed.');
