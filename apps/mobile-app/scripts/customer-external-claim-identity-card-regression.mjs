import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../components/external-claim-ui.native.tsx', import.meta.url), 'utf8');

assert.match(source, /getVehicleBrandLogoSource\(vehicleMake\)/, 'External Claim identity card must use the vehicle manufacturer catalog logo.');
assert.match(source, /getInsurerLogoSource\(insurerName\)/, 'External Claim identity card must use the insurer catalog logo.');
assert.match(source, /vehicleMeta\?\.split\('·'\)\[0\]/, 'External Claim identity card must derive manufacturer from the existing vehicle meta value.');
assert.match(source, /styles\.primaryValue[\s\S]*vehicleNo \|\| 'Vehicle'/, 'Vehicle number must remain the primary value in the compact left block.');
assert.match(source, /styles\.primaryValue[\s\S]*policyNo \|\| '—'/, 'Policy number must remain the primary value in the compact right block.');
assert.match(source, /logoTile: \{ width: 38, height: 38/, 'Reference-style brand logo tiles must stay compact.');
assert.match(source, /headerTitle: \{[^}]*fontSize: 12\.5/, 'Reference-style stage title typography must stay compact.');
assert.doesNotMatch(source, /styles\.secondaryInfoRow/, 'External Claim identity card must not return to the old two-row-per-column layout.');
assert.doesNotMatch(source, /styles\.mainInfoLabel/, 'External Claim identity card must not show Vehicle:/Policy: labels from the previous layout.');

console.log('Customer external claim identity card reference regression passed.');
