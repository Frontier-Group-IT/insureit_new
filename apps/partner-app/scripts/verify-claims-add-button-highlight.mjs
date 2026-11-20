import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const src = readFileSync(new URL('../app/(tabs)/claims.tsx', import.meta.url), 'utf8');
for (const text of [
  'canPartnerStartClaim(context)',
  '<HighlightedAddClaimButton onPress={() => router.push(\'/claim/select-vehicle\' as never)} active={isFocused} />',
  'ADD_CLAIM_GRADIENT',
  'start = [5, 63, 175]',
  'end = [10, 84, 213]',
  'accessibilityLabel="Add Claim"',
  'useNativeDriver: true',
  'duration: 1450',
  'summaryAddClaimText: { color: \'#FFFFFF\'',
]) {
  assert(src.includes(text), 'Add Claim blue-gradient button contract missing: ' + text);
}
console.log('Partner Add Claim blue gradient, subtle native animation, navigation and permission gates verified');
