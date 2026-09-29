import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
if (!root) {
  console.error('Usage: node patch-0-1-policy-claims-readable-kpis.mjs <partner-app-root>');
  process.exit(1);
}

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`Could not find ${label}`);
  }
  return source.replace(before, after);
}

function patchPolicies(file) {
  let source = fs.readFileSync(file, 'utf8');

  source = replaceOnce(source, "      helper: 'Portfolio',\n    },", "      helper: 'Portfolio',\n      lifecycle: 'all' as PartnerPolicyLifecycle,\n    },", 'Total Policies lifecycle');
  source = replaceOnce(source, "      helper: 'In force',\n    },", "      helper: 'In force',\n      lifecycle: 'in_force' as PartnerPolicyLifecycle,\n    },", 'Active Policies lifecycle');
  source = replaceOnce(source, "      helper: 'Next 30 days',\n    },", "      helper: 'Next 30 days',\n      lifecycle: 'expiring' as PartnerPolicyLifecycle,\n    },", 'Expiring Soon lifecycle');
  source = replaceOnce(source, "      helper: 'Expired',\n    },", "      helper: 'Expired',\n      lifecycle: 'expired' as PartnerPolicyLifecycle,\n    },", 'Lapsed Policies lifecycle');

  source = replaceOnce(
    source,
    "          {summaryItems.map(({ key, ...item }) => (\n            <SummaryCard key={key} {...item} />\n          ))}",
    "          {summaryItems.map(({ key, lifecycle: itemLifecycle, ...item }) => (\n            <SummaryCard\n              key={key}\n              {...item}\n              active={lifecycle === itemLifecycle}\n              onPress={() => {\n                setQuery('');\n                setLifecycle(itemLifecycle);\n                setFiltersVisible(true);\n              }}\n            />\n          ))}",
    'policy summary card wiring',
  );

  source = replaceOnce(
    source,
    `function SummaryCard({\n  icon,\n  value,\n  label,\n  helper,\n  accent,\n}: {\n  icon: keyof typeof Ionicons.glyphMap;\n  value: number;\n  label: string;\n  helper: string;\n  accent: string;\n}) {\n  return (\n    <View style={styles.summaryCard}>\n      <View style={[styles.summaryIcon, { backgroundColor: \`${'${accent}'}12\` }]}>\n        <Ionicons name={icon} size={17} color={accent} />\n      </View>\n      <Text style={[styles.summaryValue, { color: accent }]}>{value}</Text>\n      <Text numberOfLines={2} style={styles.summaryLabel}>{label}</Text>\n      <Text numberOfLines={1} style={styles.summaryHelper}>{helper}</Text>\n    </View>\n  );\n}`,
    `function SummaryCard({\n  icon,\n  value,\n  label,\n  helper,\n  accent,\n  active,\n  onPress,\n}: {\n  icon: keyof typeof Ionicons.glyphMap;\n  value: number;\n  label: string;\n  helper: string;\n  accent: string;\n  active: boolean;\n  onPress: () => void;\n}) {\n  return (\n    <Pressable\n      accessibilityRole="button"\n      accessibilityLabel={\`${'${label}'}, ${'${value}'}. Show ${'${label}'}\`}\n      accessibilityState={{ selected: active }}\n      onPress={onPress}\n      style={({ pressed }) => [styles.summaryCard, active && styles.summaryCardActive, pressed && styles.summaryCardPressed]}\n    >\n      <View style={[styles.summaryIcon, { backgroundColor: \`${'${accent}'}12\` }]}>\n        <Ionicons name={icon} size={18} color={accent} />\n      </View>\n      <Text style={[styles.summaryValue, { color: accent }]}>{value}</Text>\n      <Text numberOfLines={2} style={styles.summaryLabel}>{label}</Text>\n      <Text numberOfLines={1} style={styles.summaryHelper}>{helper}</Text>\n    </Pressable>\n  );\n}`,
    'policy SummaryCard component',
  );

  const replacements = [
    ["  filterButtonText: { color: '#3156B8', fontSize: 9.5, lineHeight: 12, fontWeight: '700' },", "  filterButtonText: { color: '#3156B8', fontSize: 10.5, lineHeight: 14, fontWeight: '700' },"],
    ["  summaryIcon: {", "  summaryCardActive: { borderColor: '#7FA7E8', backgroundColor: '#F5F9FF' },\n  summaryCardPressed: { backgroundColor: '#EEF5FF' },\n  summaryIcon: {"],
    ["  summaryValue: { marginTop: 4, fontSize: 14, lineHeight: 16, fontWeight: '800' },", "  summaryValue: { marginTop: 4, fontSize: 16, lineHeight: 19, fontWeight: '800' },"],
    ["  summaryLabel: { minHeight: 20, marginTop: 2, color: '#506079', textAlign: 'center', fontSize: 7, lineHeight: 9, fontWeight: '700' },", "  summaryLabel: { minHeight: 24, marginTop: 2, color: '#506079', textAlign: 'center', fontSize: 9.5, lineHeight: 12, fontWeight: '700' },"],
    ["  summaryHelper: { marginTop: 2, color: '#9AA6B7', fontSize: 5.8, lineHeight: 8, fontWeight: '600' },", "  summaryHelper: { marginTop: 2, color: '#8794A8', fontSize: 7.5, lineHeight: 10, fontWeight: '600' },"],
    ["  intakeTitle: { color: '#FFFFFF', fontSize: 10.5, lineHeight: 13, fontWeight: '800' },", "  intakeTitle: { color: '#FFFFFF', fontSize: 12, lineHeight: 15, fontWeight: '800' },"],
    ["  intakeSubtitle: { marginTop: 1, color: '#C9DAF7', fontSize: 6.7, lineHeight: 9, fontWeight: '500' },", "  intakeSubtitle: { marginTop: 1, color: '#C9DAF7', fontSize: 8.5, lineHeight: 11, fontWeight: '500' },"],
    ["  tabText: { color: '#708099', fontSize: 7, lineHeight: 10, fontWeight: '700' },", "  tabText: { color: '#708099', fontSize: 9, lineHeight: 12, fontWeight: '700' },"],
    ["  sortText: { color: '#3156B8', fontSize: 7, lineHeight: 10, fontWeight: '700' },", "  sortText: { color: '#3156B8', fontSize: 9, lineHeight: 12, fontWeight: '700' },"],
    ["  bookTitle: { color: '#708099', fontSize: 7.2, lineHeight: 10, letterSpacing: 1.2, fontWeight: '800' },", "  bookTitle: { color: '#708099', fontSize: 9.5, lineHeight: 12, letterSpacing: 1.05, fontWeight: '800' },"],
    ["  bookMeta: { marginTop: 2, color: '#9AA6B7', fontSize: 6.4, lineHeight: 9, fontWeight: '600' },", "  bookMeta: { marginTop: 2, color: '#8794A8', fontSize: 8, lineHeight: 10, fontWeight: '600' },"],
    ["  customerName: { color: '#173A7D', fontSize: 8.8, lineHeight: 11, fontWeight: '800' },", "  customerName: { color: '#173A7D', fontSize: 10.5, lineHeight: 13, fontWeight: '800' },"],
    ["  policyNumber: { marginTop: 2, color: '#5C6C84', fontSize: 6.7, lineHeight: 9, fontWeight: '600' },", "  policyNumber: { marginTop: 2, color: '#5C6C84', fontSize: 8.5, lineHeight: 11, fontWeight: '600' },"],
    ["  vehicleText: { maxWidth: '48%', color: '#7D8CA1', fontSize: 6.1, lineHeight: 8, fontWeight: '600' },", "  vehicleText: { maxWidth: '48%', color: '#738299', fontSize: 8, lineHeight: 10, fontWeight: '600' },"],
    ["  insurerText: { flex: 1, color: '#7D8CA1', fontSize: 6.1, lineHeight: 8, fontWeight: '600' },", "  insurerText: { flex: 1, color: '#738299', fontSize: 8, lineHeight: 10, fontWeight: '600' },"],
    ["  metaDot: { paddingHorizontal: 3, color: '#A3AFBF', fontSize: 6, lineHeight: 8 },", "  metaDot: { paddingHorizontal: 3, color: '#A3AFBF', fontSize: 8, lineHeight: 10 },"],
    ["  statusText: { fontSize: 6.3, lineHeight: 8, fontWeight: '800' },", "  statusText: { fontSize: 8, lineHeight: 10, fontWeight: '800' },"],
    ["  policyPeriod: { marginTop: 4, color: '#72829A', fontSize: 5.6, lineHeight: 8, fontWeight: '600', textAlign: 'right' },", "  policyPeriod: { marginTop: 4, color: '#72829A', fontSize: 7.5, lineHeight: 10, fontWeight: '600', textAlign: 'right' },"],
  ];
  for (const [before, after] of replacements) source = replaceOnce(source, before, after, before.slice(0, 60));

  fs.writeFileSync(file, source);
}

function patchClaims(file) {
  let source = fs.readFileSync(file, 'utf8');

  source = replaceOnce(
    source,
    `          <View style={styles.kpiGrid}>\n            <MetricCard icon="document-text-outline" value={summary.data?.total_claims ?? 0} label="Total Claims" />\n            <MetricCard icon="shield-checkmark-outline" value={summary.data?.completed_claims ?? 0} label="Settled Claims" />\n            <MetricCard icon="hourglass-outline" value={summary.data?.active_claims ?? 0} label="In Progress" />\n            <MetricCard icon="headset-outline" value={summary.data?.assistance_requested ?? 0} label="Assistance" />\n          </View>`,
    `          <View style={styles.kpiGrid}>\n            <MetricCard icon="document-text-outline" value={summary.data?.total_claims ?? 0} label="Total Claims" active={state === 'all'} onPress={() => { setQuery(''); setState('all'); }} />\n            <MetricCard icon="shield-checkmark-outline" value={summary.data?.completed_claims ?? 0} label="Settled Claims" active={state === 'completed'} onPress={() => { setQuery(''); setState('completed'); }} />\n            <MetricCard icon="hourglass-outline" value={summary.data?.active_claims ?? 0} label="In Progress" active={state === 'active'} onPress={() => { setQuery(''); setState('active'); }} />\n            <MetricCard icon="headset-outline" value={summary.data?.assistance_requested ?? 0} label="Assistance" active={state === 'assistance'} onPress={() => { setQuery(''); setState('assistance'); }} />\n          </View>`,
    'claim metric card wiring',
  );

  source = replaceOnce(
    source,
    `function MetricCard({ icon, value, label }: { icon: ComponentProps<typeof Ionicons>['name']; value: number; label: string }) {\n  return (\n    <View style={styles.kpiCard}>\n      <View style={styles.kpiIconWrap}>\n        <Ionicons name={icon} size={16} color="#0D4185" />\n      </View>\n      <Text style={styles.kpiValue}>{value}</Text>\n      <Text numberOfLines={2} style={styles.kpiLabel}>{label}</Text>\n      <View style={styles.scopeLine}>\n        <Ionicons name="analytics-outline" size={8} color="#19A56F" />\n        <Text style={styles.scopeText}>Current scope</Text>\n      </View>\n    </View>\n  );\n}`,
    `function MetricCard({\n  icon,\n  value,\n  label,\n  active,\n  onPress,\n}: {\n  icon: ComponentProps<typeof Ionicons>['name'];\n  value: number;\n  label: string;\n  active: boolean;\n  onPress: () => void;\n}) {\n  return (\n    <Pressable\n      accessibilityRole="button"\n      accessibilityLabel={\`${'${label}'}, ${'${value}'}. Show ${'${label}'}\`}\n      accessibilityState={{ selected: active }}\n      onPress={onPress}\n      style={({ pressed }) => [styles.kpiCard, active && styles.kpiCardActive, pressed && styles.kpiCardPressed]}\n    >\n      <View style={styles.kpiIconWrap}>\n        <Ionicons name={icon} size={17} color="#0D4185" />\n      </View>\n      <Text style={styles.kpiValue}>{value}</Text>\n      <Text numberOfLines={2} style={styles.kpiLabel}>{label}</Text>\n      <View style={styles.scopeLine}>\n        <Ionicons name="analytics-outline" size={9} color="#19A56F" />\n        <Text style={styles.scopeText}>Current scope</Text>\n      </View>\n    </Pressable>\n  );\n}`,
    'claim MetricCard component',
  );

  const replacements = [
    ["  searchInput: { flex: 1, minWidth: 0, paddingVertical: 7, color: '#18304F', fontSize: 9.5, lineHeight: 13 },", "  searchInput: { flex: 1, minWidth: 0, paddingVertical: 7, color: '#18304F', fontSize: 10.5, lineHeight: 14 },"],
    ["  filterText: { color: '#1738D5', fontSize: 9.5, lineHeight: 13, fontWeight: '700' },", "  filterText: { color: '#1738D5', fontSize: 10.5, lineHeight: 14, fontWeight: '700' },"],
    ["  kpiIconWrap: {", "  kpiCardActive: { borderColor: '#7FA7E8', backgroundColor: '#F5F9FF' },\n  kpiCardPressed: { backgroundColor: '#EEF5FF' },\n  kpiIconWrap: {"],
    ["  kpiValue: { marginTop: 1, color: '#1738D5', fontSize: 15, lineHeight: 18, fontWeight: '800' },", "  kpiValue: { marginTop: 1, color: '#1738D5', fontSize: 17, lineHeight: 20, fontWeight: '800' },"],
    ["  kpiLabel: { minHeight: 20, color: '#3F55A1', textAlign: 'center', fontSize: 7.5, lineHeight: 10, fontWeight: '600' },", "  kpiLabel: { minHeight: 24, color: '#3F55A1', textAlign: 'center', fontSize: 9.5, lineHeight: 12, fontWeight: '700' },"],
    ["  scopeText: { color: '#19A56F', fontSize: 6.5, lineHeight: 8, fontWeight: '700' },", "  scopeText: { color: '#15845A', fontSize: 8, lineHeight: 10, fontWeight: '700' },"],
    ["  tabText: { color: '#5E6C8C', fontSize: 7.5, lineHeight: 10, fontWeight: '600' },", "  tabText: { color: '#5E6C8C', fontSize: 9, lineHeight: 12, fontWeight: '600' },"],
    ["  sortText: { color: '#1E31D3', fontSize: 8, lineHeight: 10, fontWeight: '700' },", "  sortText: { color: '#1E31D3', fontSize: 9, lineHeight: 12, fontWeight: '700' },"],
    ["  claimNo: { color: '#071D49', fontSize: 9.5, lineHeight: 12, fontWeight: '800' },", "  claimNo: { color: '#071D49', fontSize: 11, lineHeight: 14, fontWeight: '800' },"],
    ["  claimCustomer: { marginTop: 0, color: '#51678E', fontSize: 7.5, lineHeight: 10, fontWeight: '600' },", "  claimCustomer: { marginTop: 0, color: '#51678E', fontSize: 9, lineHeight: 12, fontWeight: '600' },"],
    ["  claimDetail: { marginTop: 1, color: '#7788A5', fontSize: 6.8, lineHeight: 9 },", "  claimDetail: { marginTop: 1, color: '#6F809B', fontSize: 8.2, lineHeight: 10.5 },"],
    ["  claimAmount: { marginTop: 2, color: '#152238', fontSize: 7.2, lineHeight: 9.5, fontWeight: '700' },", "  claimAmount: { marginTop: 2, color: '#152238', fontSize: 8.5, lineHeight: 11, fontWeight: '700' },"],
    ["  statusText: { flexShrink: 1, fontSize: 6.6, lineHeight: 9, fontWeight: '700' },", "  statusText: { flexShrink: 1, fontSize: 8, lineHeight: 10, fontWeight: '700' },"],
    ["  claimDate: { color: '#66789B', fontSize: 6.4, lineHeight: 8.5, fontWeight: '600', textAlign: 'right' },", "  claimDate: { color: '#66789B', fontSize: 7.5, lineHeight: 10, fontWeight: '600', textAlign: 'right' },"],
    ["  loadMoreText: { color: '#1738D5', fontSize: 8, lineHeight: 11, fontWeight: '700' },", "  loadMoreText: { color: '#1738D5', fontSize: 9.5, lineHeight: 12, fontWeight: '700' },"],
    ["  loadingMoreText: { color: '#66789B', fontSize: 7.5, lineHeight: 10 },", "  loadingMoreText: { color: '#66789B', fontSize: 9, lineHeight: 12 },"],
    ["  endText: { minHeight: 26, paddingTop: 6, color: '#7D8BA1', textAlign: 'center', fontSize: 7, lineHeight: 9 },", "  endText: { minHeight: 26, paddingTop: 6, color: '#7D8BA1', textAlign: 'center', fontSize: 8.5, lineHeight: 11 },"],
  ];
  for (const [before, after] of replacements) source = replaceOnce(source, before, after, before.slice(0, 60));

  fs.writeFileSync(file, source);
}

function patchClaimsLib(file) {
  let source = fs.readFileSync(file, 'utf8');
  source = replaceOnce(
    source,
    "export type PartnerClaimState = 'all' | 'active' | 'completed';",
    "export type PartnerClaimState = 'all' | 'active' | 'completed' | 'assistance';",
    'PartnerClaimState assistance support',
  );
  source = replaceOnce(
    source,
    "  claim_state: Exclude<PartnerClaimState, 'all'>;",
    "  claim_state: 'active' | 'completed';",
    'claim row state type',
  );
  fs.writeFileSync(file, source);
}

patchPolicies(path.join(root, 'app/(tabs)/policies.tsx'));
patchClaims(path.join(root, 'app/(tabs)/claims.tsx'));
patchClaimsLib(path.join(root, 'lib/claims.ts'));

console.log('Partner 0.1 Policies/Claims readability + clickable KPI patch applied.');
