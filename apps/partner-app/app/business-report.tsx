import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Animated, Easing, Platform, RefreshControl, StyleSheet, Text, View, type ImageSourcePropType, type NativeScrollEvent, type NativeSyntheticEvent, type TextProps } from 'react-native';
import { useActivityMotion } from '@/components/activity-motion';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerCasePageHeader } from '@/components/partner-case-page-header';
import { PartnerStackBottomNavigation } from '@/components/partner-stack-bottom-navigation';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerBusinessReportNet, type PartnerBusinessPerformance } from '@/lib/business';
import { formatIndianCurrency } from '@/lib/format';
import { partnerTheme } from '@/lib/theme';
import { usePartnerQuery } from '@/lib/use-partner-query';
import { usePartnerSession } from '@/providers/partner-session-provider';

type Accent = 'blue' | 'purple' | 'green';

export default function BusinessReportScreen() {
  const router = useRouter();
  const { cacheScopeKey } = usePartnerSession();
  const fetchReport = useCallback(() => getPartnerBusinessReportNet(), []);
  const report = usePartnerQuery<PartnerBusinessPerformance>({
    scopeKey: cacheScopeKey,
    key: 'business:report:net:v1',
    fetcher: fetchReport,
    staleTimeMs: 90_000,
  });

  const { motion } = useActivityMotion();
  const [productVisible, setProductVisible] = useState(false);
  const productY = useRef(Infinity);
  const viewportBottom = useRef(0);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    viewportBottom.current = event.nativeEvent.contentOffset.y + event.nativeEvent.layoutMeasurement.height;
    if (viewportBottom.current >= productY.current) setProductVisible(true);
  }, []);
  const header = useReveal(motion, 0, 350);

  return (
    <PartnerScreen
      title="Business Report"
      hideTopBar
      navyStatusBar
      bottomNavigationNavy
      bottomNavigation={<PartnerStackBottomNavigation activeTab="business" />}
      scrollProps={{
        onScroll,
        onLayout: event => { viewportBottom.current = Math.max(viewportBottom.current, event.nativeEvent.layout.height); if (viewportBottom.current >= productY.current) setProductVisible(true); },
        refreshControl: (
          <RefreshControl
            refreshing={report.refreshing}
            onRefresh={() => void report.refresh()}
            tintColor={partnerTheme.colors.brand}
            colors={[partnerTheme.colors.brand]}
          />
        ),
      }}
    >
      <PartnerCasePageHeader title="Business Report" icon="business-outline" onBack={() => router.back()} titleOpacity={header} />
      {report.loading && !report.data ? (
        <ReportSkeleton motion={motion} />
      ) : !report.data ? (
        <PartnerStateView
          state="error"
          title="Business report unavailable"
          message={report.error || 'Business report could not be loaded.'}
          actionLabel="Try again"
          onAction={() => void report.refresh()}
        />
      ) : (
        <>
          <View style={styles.summaryGrid}>
            <ReportCard artwork={require('../assets/partner/business-report/premium-wallet-3d.png')} accent="blue" label="MTD Net Premium" value={report.data.premium_this_month} motion={motion} delay={150} currency />
            <ReportCard artwork={require('../assets/partner/business-report/policies-approved-3d.png')} accent="purple" label="MTD Policies" value={report.data.policies_this_month} motion={motion} delay={270} />
            <ReportCard artwork={require('../assets/partner/business-report/customers-shield-3d.png')} accent="green" label="Customers" value={report.data.total_customers} motion={motion} delay={390} />
          </View>

          <SectionHeading title="Last 6 Months · Net Premium" icon="stats-chart" tone="blue" aside="Last 6 Months" motion={motion} delay={750} />
          <View style={styles.reportCard}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderLabel, styles.nameColumn]}>Month</Text>
              <Text style={[styles.tableHeaderLabel, styles.countColumn]}>Policies</Text>
              <Text style={[styles.tableHeaderLabel, styles.amountColumn]}>Net Premium</Text>
            </View>
            {report.data.trend.slice(-6).map((item, index, rows) => (
              <ReportRow
                key={item.month}
                title={formatMonth(item.month)}
                count={item.policies}
                amount={formatIndianCurrency(item.premium)}
                tone="blue"
                motion={motion} delay={850 + index * 70} current={item.month.slice(0, 7) === report.data.current_month.slice(0, 7)}
                last={index === rows.length - 1}
              />
            ))}
          </View>

          <View onLayout={event => { productY.current = event.nativeEvent.layout.y; if (viewportBottom.current >= productY.current) setProductVisible(true); }}>
          <SectionHeading title="Business by Product · Net Premium" icon="layers" tone="purple" motion={motion && productVisible} delay={0} />
          <View style={styles.reportCard}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderLabel, styles.nameColumn]}>Product</Text>
              <Text style={[styles.tableHeaderLabel, styles.countColumn]}>Policies</Text>
              <Text style={[styles.tableHeaderLabel, styles.amountColumn]}>Net Premium</Text>
            </View>
            {report.data.business_mix.length ? report.data.business_mix.map((item, index, rows) => (
              <ReportRow
                key={item.label}
                title={humanize(item.label)}
                count={item.policies}
                amount={formatIndianCurrency(item.premium)}
                tone="purple"
                motion={motion && productVisible && index < 6} delay={index * 70}
                last={index === rows.length - 1}
              />
            )) : <Text style={styles.empty}>No product mix available.</Text>}
          </View>
          </View>
          <View pointerEvents="none" style={styles.footerWave} />
        </>
      )}
    </PartnerScreen>
  );
}

const native = Platform.OS !== 'web';

function useReveal(motion: boolean, delay: number, duration = 380) {
  const value = useRef(new Animated.Value(1)).current;
  const played = useRef(false);
  useEffect(() => {
    if (!motion) { value.setValue(1); return; }
    if (played.current) return;
    played.current = true;
    value.setValue(0);
    const animation = Animated.timing(value, { toValue: 1, delay, duration, easing: Easing.out(Easing.cubic), useNativeDriver: native, isInteraction: false });
    animation.start();
    return () => { animation.stop(); value.setValue(1); };
  }, [motion, delay, duration, value]);
  return value;
}

function entrance(value: Animated.Value, distance = 5, scale = 0.98) {
  return { opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }), transform: [
    { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) },
    { scale: value.interpolate({ inputRange: [0, 1], outputRange: [scale, 1] }) },
  ] };
}

function ReportCounter({ value, currency = false, motion, ...props }: TextProps & { value: number | string; currency?: boolean; motion: boolean }) {
  const target = Number(value);
  const [shown, setShown] = useState(target);
  const previous = useRef(0);
  const format = (n: number) => currency ? formatIndianCurrency(n) : String(Math.round(n));
  const exact = currency ? formatIndianCurrency(value) : String(value);
  useEffect(() => {
    if (!Number.isFinite(target) || !motion) { setShown(target); return; }
    const from = previous.current;
    if (from === target) { setShown(target); return; }
    let frame = 0, start: number | undefined, last = -Infinity;
    const tick = (now: number) => {
      start ??= now;
      const progress = Math.max(0, Math.min(1, (now - start - 400) / 1500));
      if (now - last >= 40 || progress === 1) {
        previous.current = from + (target - from) * Easing.out(Easing.cubic)(progress);
        setShown(progress === 1 ? target : previous.current);
        last = now;
      }
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); previous.current = target; };
  }, [target, motion]);
  const display = !motion || !Number.isFinite(target) || shown === target ? exact : format(shown);
  return <Text {...props} accessibilityLabel={exact}>{display}</Text>;
}

function ReportCard({ artwork, accent, label, value, motion, delay, currency }: {
  artwork: ImageSourcePropType;
  accent: Accent;
  label: string;
  value: number | string;
  motion: boolean;
  delay: number;
  currency?: boolean;
}) {
  const accentColor = accent === 'purple' ? '#9951ED' : accent === 'green' ? '#159B58' : '#1687F6';
  const reveal = useReveal(motion, delay);
  const border = useReveal(motion, 600, 800);
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!motion) { float.setValue(0); return; }
    const animation = Animated.sequence([Animated.delay(delay + 350), ...[1, 0, 1, 0].map(toValue => Animated.timing(float, { toValue, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: native, isInteraction: false }))]);
    animation.start();
    return () => { animation.stop(); float.setValue(0); };
  }, [motion, delay, float]);
  return (
    <Animated.View style={[styles.summaryCard, accent === 'purple' ? styles.purpleCard : accent === 'green' ? styles.greenCard : styles.blueCard, entrance(reveal)]}>
      <Animated.Image source={artwork} style={[styles.summaryArtwork, { transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }, { scale: float.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] }) }] }]} resizeMode="contain" accessibilityIgnoresInvertColors />
      <ReportCounter value={value} currency={currency} motion={motion} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.64} style={styles.value} />
      <Text numberOfLines={2} style={styles.label}>{label}</Text>
      <View style={[styles.cardAccent, { overflow: 'hidden' }]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: accentColor, transform: [{ scaleX: border }], transformOrigin: 'left center' }]} />
      </View>
    </Animated.View>
  );
}

function SectionHeading({ title, icon, tone, aside, motion, delay }: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'blue' | 'purple';
  aside?: string;
  motion: boolean;
  delay: number;
}) {
  const reveal = useReveal(motion, delay);
  return (
    <Animated.View style={[styles.sectionHeading, entrance(reveal, 3)]}>
      <Animated.View style={{ transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }}>
        <Ionicons name={icon} size={21} color={tone === 'purple' ? '#8547E9' : '#1577DD'} />
      </Animated.View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {aside ? <View style={styles.periodTag}><Text style={styles.periodText}>{aside}</Text></View> : null}
    </Animated.View>
  );
}

function ReportRow({ title, count, amount, tone, last, motion, delay, current = false }: {
  title: string;
  count: number;
  amount: string;
  tone: 'blue' | 'purple';
  last: boolean;
  motion: boolean;
  delay: number;
  current?: boolean;
}) {
  const reveal = useReveal(motion, delay, 300);
  const flash = useRef(new Animated.Value(0)).current;
  const flashed = useRef(false);
  const changed = useRef(new Animated.Value(1)).current;
  const prior = useRef({ count, amount });
  useEffect(() => {
    if (!motion || !current || flashed.current) return;
    flashed.current = true;
    const animation = Animated.sequence([Animated.delay(1400), Animated.timing(flash, { toValue: 0.65, duration: 200, useNativeDriver: native, isInteraction: false }), Animated.timing(flash, { toValue: 0, duration: 700, useNativeDriver: native, isInteraction: false })]);
    animation.start();
    return () => { animation.stop(); flash.setValue(0); };
  }, [motion, current, flash]);
  useEffect(() => {
    const different = prior.current.count !== count || prior.current.amount !== amount;
    prior.current = { count, amount };
    if (!motion || !different) return;
    changed.setValue(0.65);
    const animation = Animated.timing(changed, { toValue: 1, duration: 280, useNativeDriver: native, isInteraction: false });
    animation.start();
    return () => { animation.stop(); changed.setValue(1); };
  }, [count, amount, motion, changed]);
  return (
    <Animated.View style={[styles.row, last && styles.lastRow, entrance(reveal, 3, 1)]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: '#E4F2FF', opacity: flash }]} />
      <Text numberOfLines={2} style={[styles.rowName, styles.nameColumn]}>{title}</Text>
      <View style={styles.countColumn}>
        <Animated.View style={[styles.countPill, tone === 'purple' ? styles.purplePill : styles.bluePill, { opacity: changed, transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={styles.countText}>{count} policies</Text>
        </Animated.View>
      </View>
      <Animated.Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={[styles.rowAmount, styles.amountColumn, { opacity: changed }]}>{amount}</Animated.Text>
    </Animated.View>
  );
}

function ReportSkeleton({ motion }: { motion: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!motion) return;
    const animation = Animated.loop(Animated.sequence([0.8, 0].map(toValue => Animated.timing(pulse, { toValue, duration: 700, useNativeDriver: native, isInteraction: false }))));
    animation.start();
    return () => { animation.stop(); pulse.setValue(0); };
  }, [motion, pulse]);
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  return <View accessibilityRole="progressbar" accessibilityLabel="Loading business report">
    <View style={styles.summaryGrid}>
      {([styles.blueCard, styles.purpleCard, styles.greenCard]).map((color, index) => <View key={index} style={[styles.summaryCard, color]}>
        <Animated.View style={[styles.skeleton, { width: 67, height: 64, opacity }]} />
        <Animated.View style={[styles.skeleton, { width: '85%', height: 14, marginTop: 8, opacity }]} />
        <Animated.View style={[styles.skeleton, { width: '65%', height: 12, marginTop: 6, opacity }]} />
      </View>)}
    </View>
    <SectionHeading title="Last 6 Months · Net Premium" icon="stats-chart" tone="blue" aside="Last 6 Months" motion={false} delay={0} />
    <View style={styles.reportCard}>
      <View style={styles.tableHeader}><Text style={[styles.tableHeaderLabel, styles.nameColumn]}>Month</Text><Text style={[styles.tableHeaderLabel, styles.countColumn]}>Policies</Text><Text style={[styles.tableHeaderLabel, styles.amountColumn]}>Net Premium</Text></View>
      {Array.from({ length: 6 }, (_, index) => <View key={index} style={[styles.row, index === 5 && styles.lastRow]}>{[styles.nameColumn, styles.countColumn, styles.amountColumn].map((column, i) => <Animated.View key={i} style={[column, styles.skeleton, { height: 12, opacity }]} />)}</View>)}
    </View>
  </View>;
}

function formatMonth(value: string) {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\\b\\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  skeleton: { backgroundColor: '#DDE7F3', borderRadius: 7 },
  summaryGrid: { marginTop: 14, flexDirection: 'row', gap: 7 },
  summaryCard: { flex: 1, minWidth: 0, minHeight: 138, paddingHorizontal: 5, paddingTop: 9, paddingBottom: 15, alignItems: 'center', borderRadius: 18, borderWidth: 1, borderColor: '#E4E9F3', overflow: 'hidden', ...partnerTheme.shadowSoft },
  blueCard: { backgroundColor: '#EFF7FF' },
  purpleCard: { backgroundColor: '#F7F3FF' },
  greenCard: { backgroundColor: '#F0FAF7' },
  summaryArtwork: { width: 67, height: 64 },
  value: { fontVariant: ['tabular-nums'], width: '100%', textAlign: 'center', color: '#08295C', fontSize: 15, lineHeight: 22, fontWeight: '800', marginTop: 3 },
  label: { color: '#506487', fontSize: 10.5, lineHeight: 14, fontWeight: '600', textAlign: 'center', marginTop: 3 },
  cardAccent: { position: 'absolute', bottom: 0, left: 10, right: 10, height: 4, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  sectionHeading: { marginTop: 23, marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: { color: '#0B2657', fontSize: 13.5, lineHeight: 18, fontWeight: '800', flexShrink: 1, flexGrow: 1 },
  periodTag: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 16, backgroundColor: '#E4F0FF', flexShrink: 0 },
  periodText: { fontSize: 10, color: '#0D468F', fontWeight: '700' },
  reportCard: { borderRadius: 17, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1EAF5', ...partnerTheme.shadowSoft },
  tableHeader: { minHeight: 34, backgroundColor: '#F3F8FF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, gap: 6 },
  tableHeaderLabel: { fontSize: 10, lineHeight: 14, color: '#72819B', fontWeight: '700' },
  nameColumn: { flex: 1.05, minWidth: 0 },
  countColumn: { flex: 1.02, minWidth: 0 },
  amountColumn: { flex: 1.52, minWidth: 0, textAlign: 'right' },
  row: { minHeight: 50, paddingVertical: 9, paddingHorizontal: 11, gap: 6, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5EDF8' },
  lastRow: { borderBottomWidth: 0 },
  rowName: { color: '#0D2855', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  rowAmount: { fontVariant: ['tabular-nums'], color: '#0B285F', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  countPill: { borderRadius: 14, paddingVertical: 5, paddingHorizontal: 4, alignItems: 'center' },
  bluePill: { backgroundColor: '#E4F2FF' },
  purplePill: { backgroundColor: '#EFE3FF' },
  countText: { fontVariant: ['tabular-nums'], fontSize: 9.5, lineHeight: 12, fontWeight: '700', color: '#173775', textAlign: 'center' },
  empty: { paddingVertical: 18, paddingHorizontal: 12, color: '#8795A9', ...partnerTheme.typography.caption },
  footerWave: { height: 24, marginTop: 27, marginHorizontal: -partnerTheme.spacing.lg, backgroundColor: '#E2F1FF', borderTopLeftRadius: 110, borderTopRightRadius: 80 },
});
