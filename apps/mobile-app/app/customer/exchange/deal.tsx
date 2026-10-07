import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { confirmExchangeDeal, getExchangeDealDetail, type ExchangeDealDetail } from '@/lib/exchange';

const milestones: Array<{
  key: ExchangeDealDetail['status'];
  label: string;
  copy: string;
  timestamp: keyof ExchangeDealDetail | null;
}> = [
  { key: 'seller_accepted', label: 'Seller accepted', copy: 'The seller accepted the selected buyer response.', timestamp: 'created_at' },
  { key: 'buyer_confirmed', label: 'Buyer confirmed', copy: 'Buyer confirmation locks the transaction into the managed process.', timestamp: 'buyer_confirmed_at' },
  { key: 'inspection_pending', label: 'Inspection', copy: 'Vehicle inspection is coordinated through InsureIT Exchange.', timestamp: null },
  { key: 'inspection_complete', label: 'Inspection complete', copy: 'The managed inspection has been marked complete.', timestamp: 'inspection_completed_at' },
  { key: 'payment_pending', label: 'Payment', copy: 'Payment coordination is pending.', timestamp: null },
  { key: 'handover_pending', label: 'Payment confirmed', copy: 'Payment has been confirmed and handover is next.', timestamp: 'payment_confirmed_at' },
  { key: 'rc_transfer_pending', label: 'Vehicle handed over', copy: 'Handover is complete and RC transfer remains.', timestamp: 'handover_completed_at' },
  { key: 'completed', label: 'RC transfer complete', copy: 'The Exchange transaction is complete.', timestamp: 'completed_at' },
];

const statusOrder = milestones.map((item) => item.key);

function money(value: number) {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(value % 10000000 ? 2 : 0)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(value % 100000 ? 2 : 0)} L`;
  return `₹${value.toLocaleString('en-IN')}`;
}

function dateTime(value: unknown) {
  if (typeof value !== 'string' || !value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function ExchangeDealScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ dealId?: string | string[] }>();
  const dealId = Array.isArray(params.dealId) ? params.dealId[0] : params.dealId;

  const [deal, setDeal] = useState<ExchangeDealDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [dealId]);

  async function load(asRefresh = false) {
    if (!dealId) {
      setError('Deal reference is missing.');
      setLoading(false);
      return;
    }
    if (asRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setDeal(await getExchangeDealDetail(dealId));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Deal details are not available.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function confirmDeal() {
    if (!deal || busy || deal.side !== 'buying' || deal.status !== 'seller_accepted') return;
    setBusy(true);
    try {
      await confirmExchangeDeal(deal.deal_id);
      await load(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not confirm this deal.');
    } finally {
      setBusy(false);
    }
  }

  const currentIndex = useMemo(() => {
    if (!deal) return -1;
    if (deal.status === 'cancelled' || deal.status === 'disputed') return -1;
    return statusOrder.indexOf(deal.status);
  }, [deal]);

  if (loading && !deal) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header onBack={() => router.back()} />
        <View style={styles.center}>
          <View style={styles.centerIcon}><MaterialCommunityIcons name="handshake-outline" size={28} color="#164BB8" /></View>
          <Text style={styles.centerTitle}>Opening deal</Text>
          <Text style={styles.centerCopy}>Loading the managed Exchange transaction.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!deal || error) {
    return (
      <SafeAreaView style={styles.safe}>
        <Header onBack={() => router.back()} />
        <View style={styles.center}>
          <View style={styles.centerIcon}><MaterialCommunityIcons name="alert-circle-outline" size={28} color="#B46A12" /></View>
          <Text style={styles.centerTitle}>Deal unavailable</Text>
          <Text style={styles.centerCopy}>{error ?? 'Please try again.'}</Text>
          <Pressable onPress={() => void load()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const vehicleName = [deal.year, deal.make, deal.model].filter(Boolean).join(' ') || deal.title;
  const terminal = deal.status === 'completed' || deal.status === 'cancelled';
  const exceptional = deal.status === 'cancelled' || deal.status === 'disputed';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Header onBack={() => router.back()} />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
      >
        <View style={[styles.hero, exceptional && styles.heroWarning]}>
          <View style={styles.heroTop}>
            <View style={[styles.heroIcon, exceptional && styles.heroIconWarning]}>
              <MaterialCommunityIcons name={exceptional ? 'alert-outline' : 'handshake-outline'} size={25} color="#FFFFFF" />
            </View>
            <View style={styles.flex}>
              <Text style={styles.eyebrow}>{deal.side === 'buying' ? 'YOU ARE BUYING' : 'YOU ARE SELLING'}</Text>
              <Text style={styles.heroTitle}>{vehicleName}</Text>
              <Text style={styles.heroMeta}>{deal.deal_no} • {deal.masked_registration || deal.listing_no}</Text>
            </View>
          </View>

          <View style={styles.priceRow}>
            <View>
              <Text style={styles.priceLabel}>AGREED VALUE</Text>
              <Text style={styles.price}>{money(Number(deal.agreed_price))}</Text>
            </View>
            <View style={[styles.statusPill, exceptional && styles.statusPillWarning]}>
              <Text style={[styles.statusText, exceptional && styles.statusTextWarning]}>{statusLabel(deal.status)}</Text>
            </View>
          </View>
        </View>

        {deal.side === 'buying' && deal.status === 'seller_accepted' ? (
          <View style={styles.actionCard}>
            <View style={styles.actionIcon}><MaterialCommunityIcons name="check-decagram-outline" size={24} color="#164BB8" /></View>
            <View style={styles.flex}>
              <Text style={styles.actionTitle}>Confirm this deal</Text>
              <Text style={styles.actionCopy}>The seller has accepted your offer. Confirm to move into the managed inspection, payment and transfer process.</Text>
            </View>
            <Pressable disabled={busy} onPress={() => void confirmDeal()} style={[styles.confirmButton, busy && styles.disabled]}>
              <Text style={styles.confirmText}>{busy ? 'Confirming…' : 'Confirm'}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Deal progress</Text>
          <Text style={styles.sectionCopy}>Only milestones recorded by the Exchange workflow are shown as complete.</Text>

          <View style={styles.timeline}>
            {milestones.map((item, index) => {
              const done = !exceptional && currentIndex >= index;
              const active = !exceptional && currentIndex === index && !terminal;
              const timestamp = item.timestamp ? dateTime(deal[item.timestamp]) : null;
              return (
                <View key={item.key} style={styles.stepRow}>
                  <View style={styles.stepRail}>
                    <View style={[styles.stepDot, done && styles.stepDotDone, active && styles.stepDotActive]}>
                      {done ? <MaterialCommunityIcons name="check" size={12} color="#FFFFFF" /> : null}
                    </View>
                    {index < milestones.length - 1 ? <View style={[styles.stepLine, currentIndex > index && styles.stepLineDone]} /> : null}
                  </View>
                  <View style={styles.stepBody}>
                    <Text style={[styles.stepTitle, done && styles.stepTitleDone]}>{item.label}</Text>
                    <Text style={styles.stepCopy}>{item.copy}</Text>
                    {timestamp ? <Text style={styles.stepTime}>{timestamp}</Text> : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {exceptional ? (
          <View style={styles.issueCard}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#B46A12" />
            <View style={styles.flex}>
              <Text style={styles.issueTitle}>{deal.status === 'cancelled' ? 'Deal cancelled' : 'Deal under review'}</Text>
              <Text style={styles.issueCopy}>{deal.cancellation_reason || 'InsureIT Exchange is managing this transaction status. Contact support if you need clarification.'}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transaction safeguards</Text>
          <View style={styles.safeguards}>
            <Safeguard icon="shield-lock-outline" title="Private contact" copy="Buyer and seller contact stays managed through Exchange." />
            <Safeguard icon="clipboard-check-outline" title="Recorded milestones" copy="Inspection, payment, handover and RC-transfer updates are tied to the deal workflow." />
            <Safeguard icon="account-tie-outline" title="InsureIT coordination" copy="Operational next steps remain coordinated by the Exchange team." />
          </View>
        </View>

        <Pressable
          onPress={() => router.push({ pathname: '/customer/exchange/[listingId]', params: { listingId: deal.listing_id } })}
          style={({ pressed }) => [styles.vehicleButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="truck-outline" size={18} color="#164BB8" />
          <Text style={styles.vehicleButtonText}>Open vehicle listing</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color="#164BB8" />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} style={styles.headerButton}><MaterialCommunityIcons name="arrow-left" size={21} color="#0F1D33" /></Pressable>
      <View style={styles.headerCopy}><Text style={styles.headerTitle}>Exchange deal</Text><Text style={styles.headerSubtitle}>Managed transaction</Text></View>
      <View style={styles.headerButtonSpacer} />
    </View>
  );
}

function Safeguard({ icon, title, copy }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; copy: string }) {
  return (
    <View style={styles.safeguard}>
      <View style={styles.safeguardIcon}><MaterialCommunityIcons name={icon} size={19} color="#164BB8" /></View>
      <View style={styles.flex}><Text style={styles.safeguardTitle}>{title}</Text><Text style={styles.safeguardCopy}>{copy}</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8FA' },
  flex: { flex: 1 },
  content: { padding: 14, paddingBottom: 36 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.995 }] },
  disabled: { opacity: 0.55 },

  header: { minHeight: 68, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E9EF' },
  headerButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6F8' },
  headerButtonSpacer: { width: 40, height: 40 },
  headerCopy: { flex: 1, alignItems: 'center' },
  headerTitle: { color: '#0F1D33', fontSize: 14, fontWeight: '900' },
  headerSubtitle: { marginTop: 2, color: '#8793A4', fontSize: 7.8, fontWeight: '700' },

  center: { flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center' },
  centerIcon: { width: 54, height: 54, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF4FF' },
  centerTitle: { marginTop: 11, color: '#0F1D33', fontSize: 14, fontWeight: '900' },
  centerCopy: { marginTop: 5, color: '#7B8798', textAlign: 'center', fontSize: 8.7, lineHeight: 12.5, fontWeight: '700' },
  retry: { marginTop: 13, height: 40, borderRadius: 20, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#164BB8' },
  retryText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900' },

  hero: { borderRadius: 21, padding: 15, backgroundColor: '#0F1D33' },
  heroWarning: { backgroundColor: '#3D3021' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  heroIcon: { width: 47, height: 47, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#164BB8' },
  heroIconWarning: { backgroundColor: '#B46A12' },
  eyebrow: { color: '#91B9FF', fontSize: 7.2, fontWeight: '900', letterSpacing: 0.7 },
  heroTitle: { marginTop: 3, color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  heroMeta: { marginTop: 3, color: '#B7C1CF', fontSize: 8, fontWeight: '700' },
  priceRow: { marginTop: 15, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.13)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceLabel: { color: '#95A4B8', fontSize: 6.8, fontWeight: '900', letterSpacing: 0.5 },
  price: { marginTop: 3, color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  statusPill: { minHeight: 29, borderRadius: 15, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DCE9FD' },
  statusPillWarning: { backgroundColor: '#FFF1DE' },
  statusText: { color: '#164BB8', fontSize: 7, fontWeight: '900' },
  statusTextWarning: { color: '#9B5A0B' },

  actionCard: { marginTop: 11, borderRadius: 18, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#EEF4FF', borderWidth: 1, borderColor: '#D2E1F8' },
  actionIcon: { width: 43, height: 43, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  actionTitle: { color: '#0F1D33', fontSize: 10, fontWeight: '900' },
  actionCopy: { marginTop: 3, color: '#6F7D92', fontSize: 7.5, lineHeight: 10.5, fontWeight: '700' },
  confirmButton: { height: 35, borderRadius: 18, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#164BB8' },
  confirmText: { color: '#FFFFFF', fontSize: 7.8, fontWeight: '900' },

  section: { marginTop: 11, borderRadius: 19, padding: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E5EC' },
  sectionTitle: { color: '#0F1D33', fontSize: 12.5, fontWeight: '900' },
  sectionCopy: { marginTop: 3, color: '#8390A0', fontSize: 7.7, lineHeight: 10.5, fontWeight: '700' },

  timeline: { marginTop: 12 },
  stepRow: { minHeight: 78, flexDirection: 'row' },
  stepRail: { width: 31, alignItems: 'center' },
  stepDot: { width: 21, height: 21, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DCE1E7', borderWidth: 2, borderColor: '#FFFFFF' },
  stepDotDone: { backgroundColor: '#0D7C58' },
  stepDotActive: { backgroundColor: '#164BB8' },
  stepLine: { width: 2, flex: 1, backgroundColor: '#E1E5EA' },
  stepLineDone: { backgroundColor: '#8ACCB2' },
  stepBody: { flex: 1, paddingBottom: 13 },
  stepTitle: { color: '#7B8798', fontSize: 9.2, fontWeight: '900' },
  stepTitleDone: { color: '#24344B' },
  stepCopy: { marginTop: 3, color: '#8793A4', fontSize: 7.4, lineHeight: 10.5, fontWeight: '700' },
  stepTime: { marginTop: 4, color: '#0D7C58', fontSize: 6.9, fontWeight: '800' },

  issueCard: { marginTop: 11, borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FFF3E3', borderWidth: 1, borderColor: '#F0D2A8' },
  issueTitle: { color: '#7A4C11', fontSize: 9.3, fontWeight: '900' },
  issueCopy: { marginTop: 3, color: '#8B672F', fontSize: 7.6, lineHeight: 10.5, fontWeight: '700' },

  safeguards: { marginTop: 10, gap: 7 },
  safeguard: { minHeight: 64, borderRadius: 14, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8F9FB' },
  safeguardIcon: { width: 39, height: 39, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF4FF' },
  safeguardTitle: { color: '#26364D', fontSize: 8.8, fontWeight: '900' },
  safeguardCopy: { marginTop: 2, color: '#8190A2', fontSize: 7.2, lineHeight: 10, fontWeight: '700' },

  vehicleButton: { marginTop: 11, height: 46, borderRadius: 14, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#EEF4FF', borderWidth: 1, borderColor: '#D2E1F8' },
  vehicleButtonText: { flex: 1, color: '#164BB8', fontSize: 8.8, fontWeight: '900' },
});

