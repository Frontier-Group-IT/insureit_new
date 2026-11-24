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
const emptyStateChecks = [
  ["const illustrationScale = Math.min(0.88, Math.max(0.68, (width - 48) / 340));", 'compact responsive empty illustration'],
  ["emptyWrapFull: { flexGrow: 1, justifyContent: 'flex-start', paddingTop: 24, paddingBottom: 10 }", 'empty state sits closer to filters'],
  ["claimsEmptyTitle: { marginTop: 2, color: '#64748B'", 'approved muted slate empty title'],
  ["claimsEmptyMessage: { marginTop: 7, maxWidth: 290, color: '#6B778A'", 'approved readable muted description'],
  ["claimsEmptyHalo: { position: 'absolute', top: 15, width: 210, height: 174, borderRadius: 100, backgroundColor: '#DCEAFF' }", 'clear but isolated empty artwork'],
  ["summaryAddClaimMotion:", 'Add Claim button remains present'],
];
for (const [fragment, label] of emptyStateChecks) assert.ok(source.includes(fragment), label);
assert.ok(source.includes("source={PartnerAssets.actions.impactBlue3dCar}"), 'Keep original 3D car artwork');
console.log('Claims filters, actions, and compact faded empty presentation verified');
