import fs from 'node:fs';
import path from 'node:path';

const target = process.argv[2];
if (!target) throw new Error('Usage: node patch-0-1-home-net-premium-period.mjs <index.tsx>');

let source = fs.readFileSync(target, 'utf8');

const replaceOnce = (before, after, label) => {
  if (!source.includes(before)) throw new Error(`Expected ${label} source was not found`);
  source = source.replace(before, after);
};

replaceOnce(
  `type CommissionRange = {\n  policies: number;\n  commission_available?: boolean;\n  commission_earned?: number | string | null;\n};`,
  `type CommissionRange = {\n  policies: number;\n  net_premium?: number | string;\n  premium_previous_period?: number | string;\n  premium_change_percent?: number | string;\n  customers?: number;\n  renewals?: number;\n  commission_available?: boolean;\n  commission_earned?: number | string | null;\n};\n\ntype BusinessPeriod = 'all' | 'last6' | 'mtd' | 'month';\nconst BUSINESS_PERIODS: { key: BusinessPeriod; label: string }[] = [\n  { key: 'all', label: 'All' },\n  { key: 'last6', label: 'Last 6 Months' },\n  { key: 'mtd', label: 'MTD' },\n  { key: 'month', label: 'This Month' },\n];`,
  'business period types',
);

replaceOnce(
  `  const [searchQuery, setSearchQuery] = useState('');`,
  `  const [searchQuery, setSearchQuery] = useState('');\n  const [businessPeriod, setBusinessPeriod] = useState<BusinessPeriod>('month');\n  const [periodOpen, setPeriodOpen] = useState(false);`,
  'business period state',
);

replaceOnce(
  `  const workspace = usePartnerQuery({\n    scopeKey: cacheScopeKey,\n    key: 'home:workspace',\n    fetcher: fetchHomeWorkspace,\n    staleTimeMs: 60_000,\n  });\n\n  useFocusEffect(useCallback(() => {\n    void workspace.ensureFresh();\n  }, [workspace.ensureFresh]));`,
  `  const workspace = usePartnerQuery({\n    scopeKey: cacheScopeKey,\n    key: 'home:workspace',\n    fetcher: fetchHomeWorkspace,\n    staleTimeMs: 60_000,\n  });\n\n  const selectedBusinessRange = businessDateRange(businessPeriod);\n  const fetchSelectedBusinessRange = useCallback(\n    () => getPartnerBusinessRange(selectedBusinessRange.from, selectedBusinessRange.to),\n    [selectedBusinessRange.from, selectedBusinessRange.to],\n  );\n  const business = usePartnerQuery({\n    scopeKey: cacheScopeKey,\n    key: \`home:business:\${businessPeriod}:\${selectedBusinessRange.from}:\${selectedBusinessRange.to}\`,\n    fetcher: fetchSelectedBusinessRange,\n    staleTimeMs: 60_000,\n  });\n\n  useFocusEffect(useCallback(() => {\n    void workspace.ensureFresh();\n    void business.ensureFresh();\n  }, [workspace.ensureFresh, business.ensureFresh]));`,
  'selected business range query',
);

replaceOnce(
  `  const currentMonth = workspace.data?.currentMonth ?? null;`,
  `  const currentMonth = workspace.data?.currentMonth ?? null;\n  const periodLabel = BUSINESS_PERIODS.find((item) => item.key === businessPeriod)?.label ?? 'This Month';\n  const rangeData = business.data;`,
  'selected business range data',
);

replaceOnce(
  `            refreshing={workspace.refreshing}\n            onRefresh={() => void workspace.refresh()}`,
  `            refreshing={workspace.refreshing || business.refreshing}\n            onRefresh={() => { void workspace.refresh(); void business.refresh(); }}`,
  'combined refresh state',
);

replaceOnce(
  `                    <View style={styles.periodLabelWrap}>\n                      <Text style={styles.periodLabel}>This Month</Text>\n                      <Feather name="chevron-down" size={13} color="#123E83" />\n                    </View>`,
  `                    <View style={styles.periodLabelWrap}>\n                      <Pressable\n                        accessibilityRole="button"\n                        accessibilityLabel={\`Business period: \${periodLabel}\`}\n                        onPress={() => setPeriodOpen((value) => !value)}\n                        style={({ pressed }) => [styles.periodButton, pressed && styles.pressed]}\n                      >\n                        <Text style={styles.periodLabel}>{periodLabel}</Text>\n                        <Feather name={periodOpen ? 'chevron-up' : 'chevron-down'} size={13} color="#123E83" />\n                      </Pressable>\n                      {periodOpen ? (\n                        <View style={styles.periodMenu}>\n                          {BUSINESS_PERIODS.map((item) => (\n                            <Pressable\n                              key={item.key}\n                              accessibilityRole="button"\n                              accessibilityLabel={\`Show \${item.label} business\`}\n                              onPress={() => { setBusinessPeriod(item.key); setPeriodOpen(false); }}\n                              style={({ pressed }) => [\n                                styles.periodOption,\n                                item.key === businessPeriod && styles.periodOptionActive,\n                                pressed && styles.pressed,\n                              ]}\n                            >\n                              <Text style={[styles.periodOptionText, item.key === businessPeriod && styles.periodOptionTextActive]}>{item.label}</Text>\n                              {item.key === businessPeriod ? <Feather name="check" size={13} color={partnerTheme.colors.brandStrong} /> : null}\n                            </Pressable>\n                          ))}\n                        </View>\n                      ) : null}\n                    </View>`,
  'business period selector',
);

replaceOnce(
  `                      <Text style={styles.businessPremium}>\n                        {currencyParts(data.business.premium_this_month).whole}\n                        {currencyParts(data.business.premium_this_month).fraction ? (\n                          <Text style={styles.businessPremiumFraction}>.{currencyParts(data.business.premium_this_month).fraction}</Text>\n                        ) : null}\n                      </Text>\n                      <Text style={styles.businessCaption}>Business Generated</Text>\n                      <Trend\n                        value={Number(data.business.premium_change_percent || 0)}\n                        hasPrevious={Number(data.business.premium_last_month || 0) > 0}\n                      />`,
  `                      <Text style={styles.businessPremium}>\n                        {currencyParts(rangeData?.net_premium ?? 0).whole}\n                        {currencyParts(rangeData?.net_premium ?? 0).fraction ? (\n                          <Text style={styles.businessPremiumFraction}>.{currencyParts(rangeData?.net_premium ?? 0).fraction}</Text>\n                        ) : null}\n                      </Text>\n                      <Text style={styles.businessCaption}>Net Premium</Text>\n                      {business.loading && !rangeData ? (\n                        <Text style={styles.trendNeutral}>Updating business figures…</Text>\n                      ) : (\n                        <Trend\n                          value={Number(rangeData?.premium_change_percent ?? data.business.premium_change_percent ?? 0)}\n                          hasPrevious={Number(rangeData?.premium_previous_period ?? data.business.premium_last_month ?? 0) > 0}\n                        />\n                      )}`,
  'net premium and trend',
);

replaceOnce(
  `                      value={currentMonth?.policies ?? data.business.policies_this_month}`,
  `                      value={rangeData?.policies ?? currentMonth?.policies ?? data.business.policies_this_month}`,
  'filtered policies count',
);
replaceOnce(
  `                      value={currentMonth?.commission_available\n                        ? formatCompactIndianAmount(currentMonth.commission_earned)\n                        : '—'}`,
  `                      value={rangeData?.commission_available\n                        ? formatCompactIndianAmount(rangeData.commission_earned)\n                        : currentMonth?.commission_available\n                          ? formatCompactIndianAmount(currentMonth.commission_earned)\n                          : '—'}`,
  'filtered commission',
);

replaceOnce(
  `function toLocalDateKey(value: Date) {`,
  `function businessDateRange(period: BusinessPeriod) {\n  const now = new Date();\n  const today = toLocalDateKey(now);\n  if (period === 'all') return { from: '2000-01-01', to: today };\n  if (period === 'mtd') return { from: toLocalDateKey(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };\n  if (period === 'last6') return { from: toLocalDateKey(new Date(now.getFullYear(), now.getMonth() - 5, 1)), to: today };\n  return {\n    from: toLocalDateKey(new Date(now.getFullYear(), now.getMonth(), 1)),\n    to: toLocalDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0)),\n  };\n}\n\nfunction toLocalDateKey(value: Date) {`,
  'business date range helper',
);

replaceOnce(
  `  periodLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },\n  periodLabel: { color: '#123E83', fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium', default: undefined }), fontSize: 11.5, lineHeight: 15, fontWeight: '800' },`,
  `  periodLabelWrap: { position: 'relative', zIndex: 20 },\n  periodButton: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 1 },\n  periodLabel: { color: '#123E83', fontFamily: Platform.select({ ios: 'Avenir Next', android: 'sans-serif-medium', default: undefined }), fontSize: 11.5, lineHeight: 15, fontWeight: '800' },\n  periodMenu: { position: 'absolute', top: 31, left: 0, width: 146, padding: 5, borderRadius: 11, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: '#D8E4F2', shadowColor: '#12355E', shadowOpacity: 0.14, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8, zIndex: 30 },\n  periodOption: { minHeight: 34, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8 },\n  periodOptionActive: { backgroundColor: '#EEF6FF' },\n  periodOptionText: { color: '#53647A', fontSize: 10.5, lineHeight: 14, fontWeight: '600' },\n  periodOptionTextActive: { color: '#123E83', fontWeight: '800' },`,
  'business period styles',
);

fs.writeFileSync(target, source);

const appRoot = path.resolve(path.dirname(target), '../..');
const homePath = path.join(appRoot, 'lib/home.ts');
let home = fs.readFileSync(homePath, 'utf8');

const replaceHomeOnce = (before, after, label) => {
  if (!home.includes(before)) throw new Error(`Expected ${label} source was not found in lib/home.ts`);
  home = home.replace(before, after);
};

replaceHomeOnce(
  `  premium: number | string;\n  premium_previous_period: number | string;\n  premium_change_percent: number | string;\n  policies: number;\n  customers: number;\n  renewals: number;\n  claims: number;`,
  `  premium: number | string;\n  gross_premium: number | string;\n  net_premium: number | string;\n  premium_previous_period: number | string;\n  premium_change_percent: number | string;\n  policies: number;\n  commission_available?: boolean;\n  commission_earned?: number | string | null;\n  customers: number;\n  renewals: number;\n  claims: number;`,
  'business range summary fields',
);
replaceHomeOnce(
  `supabase.rpc('partner_app_business_range', {`,
  `supabase.rpc('partner_app_business_range_v2', {`,
  'business range v2 RPC',
);

fs.writeFileSync(homePath, home);
