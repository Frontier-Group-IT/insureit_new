import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

function recordString(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === 'string' ? value : '';
}

function recordNumber(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === 'number' ? value : Number(value ?? 0);
}

function money(value: number) {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(value % 10000000 ? 2 : 0)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(value % 100000 ? 2 : 0)} L`;
  return `₹${value.toLocaleString('en-IN')}`;
}

function modeLabel(mode: string) {
  return mode === 'managed_auction' ? 'Managed auction' : mode === 'fixed_price' ? 'Fixed price' : 'Private offers';
}

export function ExchangeOfferReviewSheet({
  visible,
  listing,
  bids,
  busy,
  onClose,
  onAcceptLeading,
  onRejectLeading,
}: {
  visible: boolean;
  listing: Record<string, unknown> | null;
  bids: Array<Record<string, unknown>>;
  busy: boolean;
  onClose: () => void;
  onAcceptLeading: (listingId: string) => void;
  onRejectLeading: (listingId: string) => void;
}) {
  if (!listing) return null;

  const listingId = recordString(listing, 'listing_id');
  const mode = recordString(listing, 'selling_mode') || 'open_bidding';
  const leading = bids.find((bid) => recordString(bid, 'status') === 'leading') ?? null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismiss} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.flex}>
              <Text style={styles.eyebrow}>{mode === 'managed_auction' ? 'BID REVIEW' : 'OFFER REVIEW'}</Text>
              <Text numberOfLines={1} style={styles.title}>{recordString(listing, 'title') || 'Vehicle listing'}</Text>
              <Text style={styles.subtitle}>{modeLabel(mode)} • {bids.length} response{bids.length === 1 ? '' : 's'}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={20} color="#0F1D33" />
            </Pressable>
          </View>

          {bids.length ? (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
              {bids.map((bid, index) => {
                const status = recordString(bid, 'status');
                const isLeading = status === 'leading';
                return (
                  <View key={recordString(bid, 'bid_id') || String(index)} style={[styles.offerRow, isLeading && styles.offerRowLeading]}>
                    <View style={[styles.rank, isLeading && styles.rankLeading]}>
                      <Text style={[styles.rankText, isLeading && styles.rankTextLeading]}>{index + 1}</Text>
                    </View>
                    <View style={styles.flex}>
                      <View style={styles.offerTitleRow}>
                        <Text style={styles.buyer}>{recordString(bid, 'bidder_alias') || 'Verified buyer'}</Text>
                        {isLeading ? <View style={styles.leadingPill}><Text style={styles.leadingText}>{mode === 'managed_auction' ? 'LEADING' : 'BEST OFFER'}</Text></View> : null}
                      </View>
                      <Text style={styles.amount}>{money(recordNumber(bid, 'amount'))}</Text>
                      <Text style={styles.status}>{status ? status.replace(/_/g, ' ') : 'received'}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><MaterialCommunityIcons name="handshake-outline" size={25} color="#164BB8" /></View>
              <Text style={styles.emptyTitle}>No active responses</Text>
              <Text style={styles.emptyCopy}>Buyer offers or auction bids will appear here when they arrive.</Text>
            </View>
          )}

          <View style={styles.footer}>
            <View style={styles.privacy}>
              <MaterialCommunityIcons name="shield-lock-outline" size={17} color="#164BB8" />
              <Text style={styles.privacyText}>Buyer identity remains masked until the managed deal process progresses.</Text>
            </View>
            {leading ? (
              <View style={styles.decisionRow}>
                {mode === 'open_bidding' ? (
                  <Pressable
                    disabled={busy}
                    onPress={() => onRejectLeading(listingId)}
                    style={({ pressed }) => [styles.rejectButton, pressed && styles.pressed, busy && styles.disabled]}
                  >
                    <MaterialCommunityIcons name="close-circle-outline" size={17} color="#B93A55" />
                    <Text style={styles.rejectButtonText}>Reject offer</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  disabled={busy}
                  onPress={() => onAcceptLeading(listingId)}
                  style={({ pressed }) => [styles.acceptButton, mode === 'open_bidding' && styles.acceptButtonHalf, pressed && styles.pressed, busy && styles.disabled]}
                >
                  <MaterialCommunityIcons name="check-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.acceptButtonText}>{mode === 'managed_auction' ? 'Accept leading bid' : 'Accept best offer'}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(8,16,29,0.45)' },
  dismiss: { flex: 1 },
  sheet: { maxHeight: '78%', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, paddingTop: 9, paddingBottom: 18, backgroundColor: '#FFFFFF' },
  handle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#CAD1DB', marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  eyebrow: { color: '#164BB8', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.7 },
  title: { marginTop: 4, color: '#0F1D33', fontSize: 16, fontWeight: '900' },
  subtitle: { marginTop: 4, color: '#7A8799', fontSize: 8.4, fontWeight: '700' },
  closeButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F5F8' },

  list: { marginTop: 14 },
  listContent: { gap: 8, paddingBottom: 4 },
  offerRow: { minHeight: 82, borderRadius: 16, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8F9FB', borderWidth: 1, borderColor: '#E5E9EF' },
  offerRowLeading: { backgroundColor: '#EEF4FF', borderColor: '#AFC7EC' },
  rank: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8ECF1' },
  rankLeading: { backgroundColor: '#164BB8' },
  rankText: { color: '#738095', fontSize: 9, fontWeight: '900' },
  rankTextLeading: { color: '#FFFFFF' },
  offerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  buyer: { color: '#26364D', fontSize: 9.5, fontWeight: '900' },
  leadingPill: { height: 21, borderRadius: 11, paddingHorizontal: 7, justifyContent: 'center', backgroundColor: '#DCE9FD' },
  leadingText: { color: '#164BB8', fontSize: 6.5, fontWeight: '900' },
  amount: { marginTop: 5, color: '#0F1D33', fontSize: 15, fontWeight: '900' },
  status: { marginTop: 2, color: '#8490A0', fontSize: 7.5, fontWeight: '700', textTransform: 'capitalize' },

  empty: { marginTop: 15, padding: 24, borderRadius: 17, alignItems: 'center', backgroundColor: '#F8F9FB' },
  emptyIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF4FF' },
  emptyTitle: { marginTop: 8, color: '#0F1D33', fontSize: 10.5, fontWeight: '900' },
  emptyCopy: { marginTop: 4, color: '#7B8798', fontSize: 8.2, lineHeight: 11.5, textAlign: 'center', fontWeight: '700' },

  footer: { marginTop: 13 },
  privacy: { borderRadius: 13, padding: 9, flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: '#F0F5FF' },
  privacyText: { flex: 1, color: '#657694', fontSize: 7.8, lineHeight: 11, fontWeight: '700' },
  decisionRow: { marginTop: 9, flexDirection: 'row', gap: 8 },
  rejectButton: { flex: 1, height: 50, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FCEEF2', borderWidth: 1, borderColor: '#F1C8D2' },
  rejectButtonText: { color: '#B93A55', fontSize: 9, fontWeight: '900' },
  acceptButton: { flex: 1, height: 50, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#164BB8' },
  acceptButtonHalf: { flex: 1 },
  acceptButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  pressed: { opacity: 0.84, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.55 },
});

export default ExchangeOfferReviewSheet;
