import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../app/(tabs)/claims.tsx',import.meta.url),'utf8');
const phrases=[
  ["summaryChips: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 0, padding: 2, borderRadius: 12, borderWidth: 1, borderColor: '#D7DFEC', backgroundColor: '#FFFFFF' }", 'one connected container'],
  ["summaryChipSelected: { backgroundColor: '#FFFFFF', borderColor: '#17365D' }", 'selected state is navy outlined, never filled'],
  ["summaryChipLabelSelected: { color: '#17365D', fontWeight: '800' }", 'selected text navy'],
  ["summaryChipCountSelected: { color: '#17365D', fontWeight: '800' }", 'selected count navy'],
  ["onPress={() => selectSummary(metric.filter)}", 'existing filter handler'],
  ["accessibilityState={{ selected }}", 'selected accessibility state'],
  ["{ label: 'All Claims', shortLabel: 'All', filter: 'all'", 'all segment'],
  ["{ label: 'Settled Claims', shortLabel: 'Settled', filter: 'completed'", 'settled segment'],
  ["{ label: 'In Progress', shortLabel: 'Progress', filter: 'active'", 'progress segment'],
  ["<HighlightedAddClaimButton onPress={() => router.push('/claim/select-vehicle' as never)} active={isFocused} />", 'existing Add Claim action'],
];
for(const [fragment,label] of phrases) assert.ok(source.includes(fragment),label);
console.log('Claims unified segmented filters, navy-outline selection, counts and Add Claim action verified');
