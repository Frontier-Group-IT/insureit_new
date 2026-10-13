import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const startClaim = await readFile(new URL('../app/customer/start-claim.tsx', import.meta.url), 'utf8');
const liveCustomerScreen = await readFile(new URL('../components/customer-aware-ui.tsx', import.meta.url), 'utf8');

// Match ONLY the selector component, not the menu options or unrelated
// Start Claim actions. In particular avoid nested icon-only Pressables.
const selector = startClaim.split('function VehicleDropdown(')[1]?.split('function formatDate(')[0];
assert.ok(selector, 'The Start Claim vehicle dropdown component must exist.');
const field = selector.split('<Modal')[0];
assert.match(field, /<Pressable[\s\S]*accessibilityRole="button"[\s\S]*accessibilityLabel="Select vehicle"[\s\S]*accessibilityState=\{\{ expanded: open \}\}[\s\S]*onPress=\{\(\) => \{ console\.warn\('\[claim-navigation\] vehicle-selector-field-press'\); toggleSelector\(\); \}\}/, 'One accessible field Pressable must open the dropdown.');
assert.equal((field.match(/<Pressable\b/g) ?? []).length, 1, 'The selector field must have a single Pressable responder (no nested icon-only button).');
assert.match(field, /<Text style=\{styles\.sectionLabel\}>Vehicle number \*<\/Text>/, 'The selection label must be inside the press target.');
assert.match(field, /<View ref=\{anchorRef\} collapsable=\{false\} pointerEvents="none"/, 'The original anchored field must remain measurable without capturing taps.');
assert.match(field, /<View style=\{styles\.selectVehicleLogoShell\}>/, 'Vehicle manufacturer artwork must remain visible.');
assert.match(field, /<View style=\{styles\.selectCopy\}>/, 'Vehicle number and make/model must remain visible.');
assert.match(field, /<View style=\{styles\.vehicleSelectorTrigger\} accessible=\{false\}>/, 'Right-side list icon must be decorative, not a second hit target.');
assert.match(field, /<Text style=\{styles\.helper\}>Start typing to find a vehicle\.<\/Text>[\s\S]*<\/Pressable>/, 'Helper text must also be within the press target.');
assert.doesNotMatch(field, /hitSlop=|vehicle-selector-icon-press/, 'Selector must not retain the old icon-only responder or an oversized hit slop.');
assert.match(selector, /anchorRef\.current\?\.measureInWindow\(\(x, y, width, height\) => \{[\s\S]*setAnchor\(\{ x, y, width, height \}\);[\s\S]*onToggle\(\);/, 'The existing anchored dropdown opening behavior must remain.');
assert.match(selector, /<Modal[\s\S]*onRequestClose=\{closeSelector\}[\s\S]*<TextInput[\s\S]*onChangeText=\{onQueryChange\}/, 'The modal must retain dismiss and search behavior.');
assert.match(selector, /onSelect\(vehicle\)/, 'Selecting a vehicle must remain available.');
assert.match(startClaim, /!accountVehicles\.length \? <Text style=\{styles\.helper\}>Start typing to find a vehicle\.<\/Text> : null/, 'The empty-vehicle state must preserve its helper without duplication.');

// Guard against reintroducing the V6 confirmed Start Claim-to-Home bug:
// its *real* aliased Customer header logo must stay noninteractive.
assert.match(liveCustomerScreen, /pathname === '\/customer\/start-claim' \? \([\s\S]*<View pointerEvents="none" style=\{baseStyles\.fixedBrandStatic\}>[\s\S]*\) : \([\s\S]*<Pressable/, 'Start Claim Customer header must remain noninteractive.');
console.log('Customer Start Claim full-field selector and protected header regression passed.');
