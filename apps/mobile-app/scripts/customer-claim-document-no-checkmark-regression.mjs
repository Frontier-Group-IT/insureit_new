import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');
const self = read('../app/customer/self-managed-claim.tsx');
const tracker = read('../components/internal-claim-stage-one-tracker.tsx');
const legacy = read('../components/internal-claim-stage-legacy.tsx');
const entry = read('../components/internal-claim-stage-one.tsx');

// The tiny upper-left green status ticks are decorative, not upload state.
for (const [name, source] of [
  ['self-managed Spot Intimation', self],
  ['internal Stage 1 tracker', tracker],
  ['legacy Spot Intimation', legacy],
  ['new internal Spot Intimation', entry],
]) {
  assert.ok(
    !source.includes('<MaterialCommunityIcons name="check" size={15} color="#18864B" />'),
    name + ' must not show the decorative saved-document tick',
  );
}
assert.doesNotMatch(self, /name="check-circle-outline" size={29} color="#18864B"/);
assert.match(self, /name="file-document-multiple-outline" size={29}/);

// Keep actual uploaded/verified state, remove actions, and the lock semantics.
assert.match(self, /saved \? 'Saved' : ready \? 'Ready' : 'Tap to upload'/);
assert.ok(self.includes('accessibilityLabel={`Remove ${title}`}'));
assert.match(tracker, /disabled={busy \|\| locked}/);
assert.ok(tracker.includes('name="lock-outline" size={15}'));
assert.match(tracker, /saved \? 'Saved' : requested \? 'REQUEST UPLOAD'/);
assert.match(tracker, /onRemove\(\)/);
assert.match(legacy, /saved \? 'Saved' : 'Tap to upload'/);
assert.match(entry, /ready \? 'Uploaded' : 'Tap to upload'/);

console.log('Customer claim document checkmark regression passed');
