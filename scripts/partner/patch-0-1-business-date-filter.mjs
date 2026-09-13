import fs from 'node:fs';

const target = process.argv[2];
if (!target) throw new Error('Usage: node patch-0-1-business-date-filter.mjs <business.tsx>');
let source = fs.readFileSync(target, 'utf8');

const replaceOnce = (before, after, label) => {
  if (!source.includes(before)) throw new Error(`Expected ${label} source was not found`);
  source = source.replace(before, after);
};

replaceOnce(
  `import { PartnerBanner } from '@/components/ui/partner-banner';`,
  `import { PartnerBusinessDateFilterCompat } from '@/components/partner-business-date-filter-compat';\nimport { PartnerBanner } from '@/components/ui/partner-banner';`,
  'business filter import',
);
replaceOnce(
  `import { formatIndianCurrency } from '@/lib/format';`,
  `import { formatIndianCurrency } from '@/lib/format';\nimport { type PartnerBusinessRangeSummary } from '@/lib/home';`,
  'business range type import',
);
replaceOnce(
  `  const router = useRouter();\n  const { cacheScopeKey } = usePartnerSession();`,
  `  const router = useRouter();\n  const { cacheScopeKey } = usePartnerSession();\n  const [rangeSelection, setRangeSelection] = useState<{ summary: PartnerBusinessRangeSummary; label: string } | null>(null);`,
  'range selection state',
);
replaceOnce(
  `          <View style={styles.hero}>`,
  `          <View style={styles.rangeFilterRow}>\n            <PartnerBusinessDateFilterCompat onChange={setRangeSelection} />\n          </View>\n\n          <View style={styles.hero}>`,
  'business filter placement',
);
replaceOnce(
  `                <Text style={styles.heroEyebrow}>{monthLabel(performance.current_month).toUpperCase()}</Text>\n                <Text style={styles.heroValue}>{formatIndianCurrency(performance.premium_this_month)}</Text>`,
  `                <Text style={styles.heroEyebrow}>{(rangeSelection?.label ?? monthLabel(performance.current_month)).toUpperCase()}</Text>\n                <Text style={styles.heroValue}>{formatIndianCurrency(rangeSelection?.summary.premium ?? performance.premium_this_month)}</Text>`,
  'filtered hero premium',
);
replaceOnce(
  `              <TrendBadge\n                value={Number(performance.premium_change_percent || 0)}\n                hasPrevious={Number(performance.premium_last_month || 0) > 0}\n              />`,
  `              <TrendBadge\n                value={Number(rangeSelection?.summary.premium_change_percent ?? performance.premium_change_percent ?? 0)}\n                hasPrevious={Number(rangeSelection?.summary.premium_previous_period ?? performance.premium_last_month ?? 0) > 0}\n              />`,
  'filtered hero trend',
);
replaceOnce(
  `            <View style={styles.heroStats}>\n              <HeroStat value={performance.policies_this_month} label="Policies" />\n              <HeroStat value={performance.total_customers} label="Customers" />\n              <HeroStat value={network.total_partners} label={network.total_partners === 1 ? 'Partner family' : 'Partner families'} />\n            </View>`,
  `            <View style={styles.heroStats}>\n              <HeroStat value={rangeSelection?.summary.policies ?? performance.policies_this_month} label="Policies" />\n              <HeroStat value={rangeSelection?.summary.customers ?? performance.total_customers} label="Customers" />\n              {rangeSelection ? (\n                <HeroStat value={rangeSelection.summary.claims} label="Claims" />\n              ) : (\n                <HeroStat value={network.total_partners} label={network.total_partners === 1 ? 'Partner family' : 'Partner families'} />\n              )}\n            </View>`,
  'filtered hero stats',
);
replaceOnce(
  `  hero: {`,
  `  rangeFilterRow: { marginBottom: 9, flexDirection: 'row', justifyContent: 'flex-end' },\n  hero: {`,
  'range filter style',
);

fs.writeFileSync(target, source);
