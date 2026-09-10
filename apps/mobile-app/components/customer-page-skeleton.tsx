import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

type CustomerSkeletonVariant = 'dashboard' | 'list' | 'detail' | 'form';

export function CustomerPageSkeleton({ pathname, label = 'Loading page' }: { pathname: string; label?: string }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 760,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 760,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 0.92],
  });
  const variant = skeletonVariantFor(pathname);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={styles.stage}
    >
      <Animated.View style={[styles.canvas, { opacity }]}>
        {variant === 'dashboard' ? <DashboardSkeleton /> : null}
        {variant === 'list' ? <ListSkeleton /> : null}
        {variant === 'detail' ? <DetailSkeleton /> : null}
        {variant === 'form' ? <FormSkeleton /> : null}
      </Animated.View>
    </View>
  );
}

function skeletonVariantFor(pathname: string): CustomerSkeletonVariant {
  if (pathname === '/customer/home' || pathname === '/customer/group') return 'dashboard';

  if (
    [
      '/customer/policies',
      '/customer/vehicles',
      '/customer/claims',
      '/customer/renewals',
      '/customer/support',
      '/customer/notifications',
      '/customer/group/accounts',
      '/customer/group/fleet',
      '/customer/group/policies',
      '/customer/group/claims',
    ].some((route) => pathname === route || pathname.startsWith(`${route}/`))
  ) return 'list';

  if (
    [
      '/customer/policy-detail',
      '/customer/vehicle-detail',
      '/customer/claim-detail',
      '/customer/self-managed-claim-detail',
      '/customer/self-managed-milestone',
      '/customer/self-managed-documents',
      '/customer/self-managed-spot-status',
      '/customer/internal-claim-stage',
      '/customer/internal-spot-status',
      '/customer/upload-documents',
      '/customer/support-ticket-detail',
      '/customer/service-enquiry-detail',
      '/customer/group/account-detail',
    ].some((route) => pathname === route || pathname.startsWith(`${route}/`))
  ) return 'detail';

  return 'form';
}

function DashboardSkeleton() {
  return (
    <>
      <View style={styles.headingWide} />
      <View style={styles.headingSub} />
      <View style={styles.heroCard}>
        <View style={styles.pill} />
        <View style={styles.heroTitle} />
        <View style={styles.lineWide} />
        <View style={styles.lineMedium} />
      </View>
      <View style={styles.quickRow}>
        {Array.from({ length: 4 }).map((_, index) => (
          <View key={index} style={[styles.quickCard, index < 3 && styles.quickGap]}>
            <View style={styles.iconBlock} />
            <View style={styles.quickLine} />
          </View>
        ))}
      </View>
      <View style={styles.twoColumnRow}>
        <View style={[styles.summaryCard, styles.columnGap]}>
          <View style={styles.summaryTitle} />
          <View style={styles.metric} />
          <View style={styles.lineMedium} />
        </View>
        <View style={styles.summaryCard}>
          <View style={styles.summaryTitle} />
          <View style={styles.metricShort} />
          <View style={styles.lineMedium} />
        </View>
      </View>
      <View style={styles.listCard}>
        <View style={styles.rowIcon} />
        <View style={styles.rowCopy}>
          <View style={styles.lineMedium} />
          <View style={styles.lineShort} />
        </View>
      </View>
    </>
  );
}

function ListSkeleton() {
  return (
    <>
      <View style={styles.headingWide} />
      <View style={styles.headingSub} />
      <View style={styles.searchBar} />
      <View style={styles.filterRow}>
        <View style={styles.filterPillWide} />
        <View style={styles.filterPill} />
        <View style={styles.filterPillWide} />
      </View>
      {Array.from({ length: 3 }).map((_, index) => (
        <View key={index} style={styles.listCard}>
          <View style={styles.rowIcon} />
          <View style={styles.rowCopy}>
            <View style={styles.lineWide} />
            <View style={styles.lineMedium} />
            <View style={styles.metaRow}>
              <View style={styles.metaBlock} />
              <View style={styles.metaBlock} />
            </View>
          </View>
        </View>
      ))}
    </>
  );
}

function DetailSkeleton() {
  return (
    <>
      <View style={styles.detailHero}>
        <View style={styles.detailTopRow}>
          <View style={styles.detailIcon} />
          <View style={styles.detailHeadingCopy}>
            <View style={styles.headingWide} />
            <View style={styles.lineMedium} />
          </View>
        </View>
        <View style={styles.detailMetricRow}>
          <View style={styles.detailMetric} />
          <View style={styles.detailMetric} />
          <View style={styles.detailMetric} />
        </View>
      </View>
      <View style={styles.sectionCard}>
        <View style={styles.summaryTitle} />
        {Array.from({ length: 4 }).map((_, index) => (
          <View key={index} style={styles.detailRow}>
            <View style={styles.detailLabel} />
            <View style={styles.detailValue} />
          </View>
        ))}
      </View>
      <View style={styles.sectionCard}>
        <View style={styles.summaryTitle} />
        <View style={styles.lineWide} />
        <View style={styles.lineMedium} />
        <View style={styles.actionBlock} />
      </View>
    </>
  );
}

function FormSkeleton() {
  return (
    <>
      <View style={styles.headingWide} />
      <View style={styles.headingSub} />
      <View style={styles.formCard}>
        {Array.from({ length: 4 }).map((_, index) => (
          <View key={index} style={styles.fieldGroup}>
            <View style={styles.fieldLabel} />
            <View style={styles.fieldInput} />
          </View>
        ))}
        <View style={styles.actionBlock} />
      </View>
    </>
  );
}

const skeleton = { backgroundColor: '#DCE7F2' };
const surface = { backgroundColor: '#F6F9FC', borderColor: '#E0E8F1', borderWidth: 1 };

const styles = StyleSheet.create({
  stage: { width: '100%', alignSelf: 'stretch', paddingTop: 2, paddingBottom: 26 },
  canvas: { width: '100%', alignSelf: 'stretch' },
  headingWide: { ...skeleton, width: '48%', height: 20, borderRadius: 7 },
  headingSub: { ...skeleton, width: '72%', height: 10, borderRadius: 5, marginTop: 9, marginBottom: 18 },
  heroCard: { ...surface, minHeight: 142, borderRadius: 20, padding: 17 },
  pill: { ...skeleton, width: 76, height: 18, borderRadius: 999 },
  heroTitle: { ...skeleton, width: '58%', height: 21, borderRadius: 7, marginTop: 18 },
  lineWide: { ...skeleton, width: '82%', height: 10, borderRadius: 5, marginTop: 10 },
  lineMedium: { ...skeleton, width: '58%', height: 9, borderRadius: 5, marginTop: 8 },
  lineShort: { ...skeleton, width: '38%', height: 8, borderRadius: 4, marginTop: 7 },
  quickRow: { flexDirection: 'row', marginTop: 14 },
  quickCard: { ...surface, flex: 1, height: 82, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  quickGap: { marginRight: 8 },
  iconBlock: { ...skeleton, width: 28, height: 28, borderRadius: 9 },
  quickLine: { ...skeleton, width: '58%', height: 8, borderRadius: 4, marginTop: 9 },
  twoColumnRow: { flexDirection: 'row', marginTop: 14 },
  summaryCard: { ...surface, flex: 1, minHeight: 126, borderRadius: 18, padding: 14 },
  columnGap: { marginRight: 10 },
  summaryTitle: { ...skeleton, width: '42%', height: 14, borderRadius: 6 },
  metric: { ...skeleton, width: '46%', height: 26, borderRadius: 8, marginTop: 17 },
  metricShort: { ...skeleton, width: '32%', height: 26, borderRadius: 8, marginTop: 17 },
  searchBar: { ...surface, height: 48, borderRadius: 15, marginTop: 2 },
  filterRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 4 },
  filterPill: { ...skeleton, width: 68, height: 30, borderRadius: 999, marginRight: 8 },
  filterPillWide: { ...skeleton, width: 96, height: 30, borderRadius: 999, marginRight: 8 },
  listCard: { ...surface, minHeight: 112, borderRadius: 18, padding: 14, marginTop: 12, flexDirection: 'row', alignItems: 'flex-start' },
  rowIcon: { ...skeleton, width: 46, height: 46, borderRadius: 14 },
  rowCopy: { flex: 1, marginLeft: 12 },
  metaRow: { flexDirection: 'row', marginTop: 11 },
  metaBlock: { ...skeleton, width: '30%', height: 18, borderRadius: 6, marginRight: 10 },
  detailHero: { ...surface, minHeight: 150, borderRadius: 20, padding: 16 },
  detailTopRow: { flexDirection: 'row', alignItems: 'center' },
  detailIcon: { ...skeleton, width: 54, height: 54, borderRadius: 17 },
  detailHeadingCopy: { flex: 1, marginLeft: 12 },
  detailMetricRow: { flexDirection: 'row', marginTop: 18 },
  detailMetric: { ...skeleton, flex: 1, height: 38, borderRadius: 10, marginRight: 8 },
  sectionCard: { ...surface, minHeight: 150, borderRadius: 18, padding: 15, marginTop: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 },
  detailLabel: { ...skeleton, width: '32%', height: 9, borderRadius: 5 },
  detailValue: { ...skeleton, width: '46%', height: 11, borderRadius: 5 },
  actionBlock: { ...skeleton, width: '100%', height: 46, borderRadius: 14, marginTop: 18 },
  formCard: { ...surface, borderRadius: 20, padding: 15 },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { ...skeleton, width: '34%', height: 9, borderRadius: 5, marginBottom: 7 },
  fieldInput: { ...skeleton, width: '100%', height: 48, borderRadius: 14 },
});
