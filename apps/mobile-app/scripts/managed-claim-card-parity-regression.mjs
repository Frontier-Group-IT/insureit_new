import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../app/customer/start-claim.tsx', import.meta.url), 'utf8');

assert.match(source, /<View style=\{\[styles\.policyCard, styles\.policyCardCompact(?:, compactPhone && \{ minHeight: 94 \})?\]\}>/, 'Managed and external policy cards must share the compact card shell.');
assert.match(source, /<View style=\{\[styles\.policyContent, styles\.policyContentCompact(?:, compactPhone && \{ minHeight: 94, paddingHorizontal: 8, gap: 6 \})?\]\}>/, 'Managed and external policy cards must share compact content spacing.');
assert.match(source, /<View style=\{\[styles\.policyIcon, styles\.policyIconCompact\]\}>/, 'Managed and external policy cards must share compact icon sizing.');
assert.match(source, /<PolicyStatusPulse condition=\{selectedPolicyCondition \?\? 'active'\} \/>/, 'All managed/external Active, Due and Expired states must use the same animated status pulse.');
assert.doesNotMatch(source, /selectedPolicy\.source === 'external' && styles\.policyCardCompact/, 'Compact policy-card styling must not be limited to external policies.');

console.log('Managed claim card parity regression passed.');

 // Compact-screen layout contracts for the shared iOS/Android Customer app.
const vehicleScreen = await readFile(new URL('../app/customer/vehicles.tsx', import.meta.url), 'utf8');
const profileScreen = await readFile(new URL('../app/customer/profile.tsx', import.meta.url), 'utf8');
const customerUI = await readFile(new URL('../components/customer-aware-ui.tsx', import.meta.url), 'utf8');
const bottomTabs = await readFile(new URL('../components/ui.tsx', import.meta.url), 'utf8');
assert.match(vehicleScreen, /compactPhone && \{ width: 112, paddingRight: 0 \}/, 'Small phones must leave room for vehicle policy details.');
assert.match(vehicleScreen, /compactPhone && \{ width: 106, height: 62 \}/, 'Small-phone vehicle artwork must fit the narrow card.');
assert.match(vehicleScreen, /numberOfLines=\{2\} ellipsizeMode="tail"/, 'Long vehicle names must truncate without overflowing.');
assert.match(profileScreen, /compactPhone && \{ width: 80, height: 80, borderRadius: 40 \}/, 'Profile avatars must shrink on small phones.');
assert.match(customerUI, /pathname === '\/customer\/start-claim'/, 'Protected Start Claim header behavior must remain route-specific.');
assert.match(customerUI, /compactPhone \? 112 : 132/, 'Shared Customer header logo must respond to width.');
assert.match(bottomTabs, /compactCustomerTabs = customerNavyTabs && screenWidth < 375/, 'Only Customer bottom navigation must use compact sizing.');
assert.match(bottomTabs, /paddingBottom: Math.max\(bottomInset, 10\)/, 'Navigation must retain the device safe-area inset.');
console.log('Customer compact iOS/Android layout contracts passed.');

