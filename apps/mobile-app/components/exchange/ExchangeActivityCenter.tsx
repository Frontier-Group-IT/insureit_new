import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ExchangeActivity } from '@/lib/exchange';

type ActivityTab = 'buying' | 'selling' | 'saved' | 'deals';

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
  if (mode === 'fixed_price') return 'Fixed price';
  if (mode === 'managed_auction') return 'Auction';
  return 'Open to offers';
}

function statusLabel(value: string) {
  return value ? value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) : 'In progress';
}

export function ExchangeActivityCenter({
  activity,
  refreshing,
  onRefresh,
  onBrowse,
  onSell,
  onOpenListing,
  onOpenDeal,
  onWithdrawOffer,
  onReviewBids,
  onRespondContact,
  onConfirmDeal,
}: {
  activity: ExchangeActivity;
  refreshing: boolean;
  onRefresh: () => void;
  onBrowse: () => void;
  onSell: () => void;
  onOpenListing: (listingId: string) => void;
  onOpenDeal: (dealId: string) => void;
  onWithdrawOffer: (bidId: string) => void;
  onReviewBids: (row: Record<string, unknown>) => void;
  onRespondContact: (requestId: string, accept: boolean) => void;
  onConfirmDeal: (dealId: string) => void;
}) {
  const [tab, setTab] = useState<ActivityTab>('buying');

  const buyingContacts = useMemo(
    () => activity.contact_requests.filter((row) => recordString(row, 'side') === 'buyer'),
    [activity.contact_requests],
  );
  const sellingContacts = useMemo(
    () => activity.contact_requests.filter((row) => recordString(row, 'side') === 'seller'),
    [activity.contact_requests],
  );

  const counts: Record<ActivityTab, number> = {
    buying: activity.bids.length + buyingContacts.length,
    selling: activity.listings.length + sellingContacts.length,
    saved: activity.favorites.length,
    deals: activity.deals.length,
  };

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>MY EXCHANGE</Text>
        <Text style={styles.title}>Your marketplace activity</Text>
        <Text style={styles.subtitle}>Track what you are buying, selling, saving and closing without mixing every action into one feed.</Text>

        <View style={styles.summary}>
          <Summary value={activity.bids.length} label="Offers" />
          <Summary value={activity.listings.length} label="Listings" />
          <Summary value={activity.favorites.length} label="Saved" />
          <Summary value={activity.deals.length} label="Deals" />
        </View>
      </View>

      <View style={styles.tabs}>
        {([
          ['buying', 'Buying'],
          ['selling', 'Selling'],
          ['saved', 'Saved'],
          ['deals', 'Deals'],
        ] as Array<[ActivityTab, string]>).map(([value, label]) => (
          <Pressable key={value} onPress={() => setTab(value)} style={[styles.tab, tab === value && styles.tabActive]}>
            <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{label}</Text>
            {counts[value] > 0 ? (
              <View style={[styles.tabCount, tab === value && styles.tabCountActive]}>
                <Text style={[styles.tabCountText, tab === value && styles.tabCountTextActive]}>{counts[value]}</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>

      {tab === 'buying' ? (
        <View style={styles.section}>
          <SectionTitle title="Buying activity" copy="Offers, bids and buyer contact requests" />
          {activity.bids.length === 0 && buyingContacts.length === 0 ? (
            <EmptyState icon="truck-outline" title="Nothing in Buying yet" copy="Explore verified commercial vehicles and make an offer when something fits." action="Browse vehicles" onPress={onBrowse} />
          ) : (
            <View style={styles.rows}>
              {activity.bids.map((row) => {
                const bidId = recordString(row, 'bid_id');
                const listingId = recordString(row, 'listing_id');
                const mode = recordString(row, 'selling_mode');
                const status = recordString(row, 'status');
                const canWithdraw = mode === 'open_bidding' && ['leading', 'outbid'].includes(status);
                return (
                  <View key={bidId || listingId} style={styles.row}>
                    <RowIcon icon={mode === 'managed_auction' ? 'gavel' : 'handshake-outline'} tone={mode === 'managed_auction' ? 'orange' : 'blue'} />
                    <Pressable onPress={() => listingId && onOpenListing(listingId)} style={styles.rowBody}>
                      <Text numberOfLines={1} style={styles.rowTitle}>{recordString(row, 'title') || 'Exchange vehicle'}</Text>
                      <Text style={styles.rowMeta}>{modeLabel(mode)} • {statusLabel(status)}</Text>
                      <Text style={styles.rowValue}>{money(recordNumber(row, 'amount'))}</Text>
                    </Pressable>
                    {canWithdraw ? (
                      <Pressable onPress={() => bidId && onWithdrawOffer(bidId)} style={styles.withdrawPill}>
                        <Text style={styles.withdrawText}>WITHDRAW</Text>
                      </Pressable>
                    ) : (
                      <MaterialCommunityIcons name="chevron-right" size={21} color="#A0A9B8" />
                    )}
                  </View>
                );
              })}

              {buyingContacts.map((row) => {
                const listingId = recordString(row, 'listing_id');
                return (
                  <Pressable key={recordString(row, 'request_id')} onPress={() => listingId && onOpenListing(listingId)} style={styles.row}>
                    <RowIcon icon="phone-in-talk-outline" tone="green" />
                    <View style={styles.rowBody}>
                      <Text numberOfLines={1} style={styles.rowTitle}>{recordString(row, 'title') || 'Managed contact'}</Text>
                      <Text style={styles.rowMeta}>{statusLabel(recordString(row, 'status'))}</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={21} color="#A0A9B8" />
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      ) : null}

      {tab === 'selling' ? (
        <View style={styles.section}>
          <SectionTitle title="Selling activity" copy="Listings, buyer interest and seller actions" />
          {activity.listings.length === 0 && sellingContacts.length === 0 ? (
            <EmptyState icon="truck-plus-outline" title="No active selling work" copy="List a commercial vehicle directly from your InsureIT fleet." action="Sell a vehicle" onPress={onSell} />
          ) : (
            <View style={styles.rows}>
              {activity.listings.map((row) => {
                const listingId = recordString(row, 'listing_id');
                const status = recordString(row, 'status');
                const mode = recordString(row, 'selling_mode');
                const bidCount = recordNumber(row, 'bid_count');
                return (
                  <View key={listingId} style={styles.row}>
                    <RowIcon icon="sale" tone="blue" />
                    <Pressable onPress={() => listingId && onOpenListing(listingId)} style={styles.rowBody}>
                      <Text numberOfLines={1} style={styles.rowTitle}>{recordString(row, 'title') || 'Vehicle listing'}</Text>
                      <Text style={styles.rowMeta}>{modeLabel(mode)} • {statusLabel(status)}</Text>
                      <Text style={styles.rowValue}>{money(recordNumber(row, 'asking_price'))}</Text>
                    </Pressable>
                    {status === 'live' && bidCount > 0 && mode !== 'fixed_price' ? (
                      <Pressable onPress={() => onReviewBids(row)} style={styles.actionPill}>
                        <Text style={styles.actionPillText}>{mode === 'managed_auction' ? 'BIDS' : 'OFFERS'} {bidCount}</Text>
                      </Pressable>
                    ) : (
                      <View style={styles.statusPill}><Text style={styles.statusPillText}>{statusLabel(status)}</Text></View>
                    )}
                  </View>
                );
              })}

              {sellingContacts.map((row) => {
                const requestId = recordString(row, 'request_id');
                const status = recordString(row, 'status');
                return (
                  <View key={requestId} style={styles.row}>
                    <RowIcon icon="phone-in-talk-outline" tone="green" />
                    <View style={styles.rowBody}>
                      <Text numberOfLines={1} style={styles.rowTitle}>{recordString(row, 'title') || 'Buyer contact request'}</Text>
                      <Text style={styles.rowMeta}>{statusLabel(status)}</Text>
                    </View>
                    {status === 'pending' ? (
                      <View style={styles.stackActions}>
                        <Pressable onPress={() => onRespondContact(requestId, true)} style={styles.acceptPill}><Text style={styles.acceptText}>Accept</Text></Pressable>
                        <Pressable onPress={() => onRespondContact(requestId, false)} style={styles.declinePill}><Text style={styles.declineText}>Decline</Text></Pressable>
                      </View>
                    ) : (
                      <View style={styles.statusPill}><Text style={styles.statusPillText}>{statusLabel(status)}</Text></View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      ) : null}

      {tab === 'saved' ? (
        <View style={styles.section}>
          <SectionTitle title="Saved vehicles" copy="Your shortlist for later review" />
          {activity.favorites.length === 0 ? (
            <EmptyState icon="heart-outline" title="No saved vehicles" copy="Tap the heart on any Exchange listing to keep it here." action="Browse inventory" onPress={onBrowse} />
          ) : (
            <View style={styles.rows}>
              {activity.favorites.map((row) => {
                const listingId = recordString(row, 'listing_id');
                return (
                  <Pressable key={listingId} onPress={() => listingId && onOpenListing(listingId)} style={styles.row}>
                    <RowIcon icon="heart-outline" tone="red" />
                    <View style={styles.rowBody}>
                      <Text numberOfLines={1} style={styles.rowTitle}>{recordString(row, 'title') || 'Exchange vehicle'}</Text>
                      <Text style={styles.rowMeta}>{modeLabel(recordString(row, 'selling_mode'))} • {recordString(row, 'city') || 'Marketplace'}</Text>
                      <Text style={styles.rowValue}>{money(recordNumber(row, 'asking_price'))}</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={21} color="#A0A9B8" />
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      ) : null}

      {tab === 'deals' ? (
        <View style={styles.section}>
          <SectionTitle title="Deals" copy="Confirmed transactions and next steps" />
          {activity.deals.length === 0 ? (
            <EmptyState icon="handshake-outline" title="No deals yet" copy="Accepted offers and confirmed Exchange transactions will appear here." action="Explore vehicles" onPress={onBrowse} />
          ) : (
            <View style={styles.rows}>
              {activity.deals.map((row) => {
                const dealId = recordString(row, 'deal_id');
                const listingId = recordString(row, 'listing_id');
                const status = recordString(row, 'status');
                const side = recordString(row, 'side');
                return (
                  <View key={dealId} style={styles.row}>
                    <RowIcon icon="handshake-outline" tone="orange" />
                    <Pressable onPress={() => dealId ? onOpenDeal(dealId) : listingId && onOpenListing(listingId)} style={styles.rowBody}>
                      <Text numberOfLines={1} style={styles.rowTitle}>{recordString(row, 'title') || 'Exchange deal'}</Text>
                      <Text style={styles.rowMeta}>{side === 'buying' ? 'Buying' : 'Selling'} • {statusLabel(status)}</Text>
                      <Text style={styles.rowValue}>{money(recordNumber(row, 'agreed_price'))}</Text>
                    </Pressable>
                    {side === 'buying' && status === 'seller_accepted' ? (
                      <Pressable onPress={() => onConfirmDeal(dealId)} style={styles.actionPill}><Text style={styles.actionPillText}>CONFIRM</Text></Pressable>
                    ) : (
                      <View style={styles.statusPill}><Text style={styles.statusPillText}>{statusLabel(status)}</Text></View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      ) : null}

      <View style={styles.supportCard}>
        <View style={styles.supportIcon}><MaterialCommunityIcons name="shield-account-outline" size={22} color="#FFFFFF" /></View>
        <View style={styles.flex}>
          <Text style={styles.supportTitle}>Exchange stays managed</Text>
          <Text style={styles.supportCopy}>Private contact, inspections and transaction steps remain coordinated through InsureIT.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function Summary({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function SectionTitle({ title, copy }: { title: string; copy: string }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCopy}>{copy}</Text>
    </View>
  );
}

function EmptyState({
  icon,
  title,
  copy,
  action,
  onPress,
}: {
  icon: 'truck-outline' | 'truck-plus-outline' | 'heart-outline' | 'handshake-outline';
  title: string;
  copy: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><MaterialCommunityIcons name={icon} size={24} color="#164BB8" /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyCopy}>{copy}</Text>
      <Pressable onPress={onPress} style={styles.emptyAction}><Text style={styles.emptyActionText}>{action}</Text></Pressable>
    </View>
  );
}

function RowIcon({ icon, tone }: { icon: 'gavel' | 'handshake-outline' | 'phone-in-talk-outline' | 'sale' | 'heart-outline'; tone: 'blue' | 'green' | 'orange' | 'red' }) {
  const bg = tone === 'green' ? '#E8F7F1' : tone === 'orange' ? '#FFF2E6' : tone === 'red' ? '#FCEEF2' : '#EEF4FF';
  const fg = tone === 'green' ? '#0D7C58' : tone === 'orange' ? '#C56A12' : tone === 'red' ? '#D7385E' : '#164BB8';
  return <View style={[styles.rowIcon, { backgroundColor: bg }]}><MaterialCommunityIcons name={icon} size={21} color={fg} /></View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 14, paddingBottom: 36, backgroundColor: '#F7F8FA' },
  hero: { borderRadius: 22, padding: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E5EC' },
  eyebrow: { color: '#164BB8', fontSize: 7.8, fontWeight: '900', letterSpacing: 0.8 },
  title: { marginTop: 5, color: '#0F1D33', fontSize: 20, fontWeight: '900' },
  subtitle: { marginTop: 6, color: '#748195', fontSize: 9, lineHeight: 13, fontWeight: '700' },
  summary: { marginTop: 14, flexDirection: 'row', borderRadius: 15, overflow: 'hidden', backgroundColor: '#F7F8FA' },
  summaryItem: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: '#E5E9EF' },
  summaryValue: { color: '#0F1D33', fontSize: 14, fontWeight: '900' },
  summaryLabel: { marginTop: 2, color: '#8793A4', fontSize: 7.2, fontWeight: '800' },

  tabs: { marginTop: 12, minHeight: 48, borderRadius: 16, padding: 4, flexDirection: 'row', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E5EC' },
  tab: { flex: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  tabActive: { backgroundColor: '#EEF4FF' },
  tabText: { color: '#758296', fontSize: 8.5, fontWeight: '800' },
  tabTextActive: { color: '#164BB8', fontWeight: '900' },
  tabCount: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF1F4' },
  tabCountActive: { backgroundColor: '#164BB8' },
  tabCountText: { color: '#778497', fontSize: 6.8, fontWeight: '900' },
  tabCountTextActive: { color: '#FFFFFF' },

  section: { marginTop: 12, borderRadius: 20, padding: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E5EC' },
  sectionTitle: { color: '#0F1D33', fontSize: 13.5, fontWeight: '900' },
  sectionCopy: { marginTop: 3, color: '#7A8799', fontSize: 8.3, fontWeight: '700' },
  rows: { marginTop: 11, gap: 8 },
  row: { minHeight: 76, borderRadius: 15, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#F8F9FB', borderWidth: 1, borderColor: '#E5E9EF' },
  rowIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowTitle: { color: '#0F1D33', fontSize: 9.8, fontWeight: '900' },
  rowMeta: { marginTop: 3, color: '#7A8799', fontSize: 7.8, fontWeight: '700' },
  rowValue: { marginTop: 5, color: '#26364D', fontSize: 10.5, fontWeight: '900' },

  actionPill: { minHeight: 30, borderRadius: 15, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#164BB8' },
  actionPillText: { color: '#FFFFFF', fontSize: 6.9, fontWeight: '900' },
  statusPill: { maxWidth: 90, minHeight: 28, borderRadius: 14, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDF0F4' },
  statusPillText: { color: '#647286', textAlign: 'center', fontSize: 6.5, fontWeight: '900' },
  stackActions: { gap: 4 },
  acceptPill: { minHeight: 28, borderRadius: 14, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DFF4EA' },
  acceptText: { color: '#0D7C58', fontSize: 6.8, fontWeight: '900' },
  declinePill: { minHeight: 28, borderRadius: 14, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F3F6' },
  declineText: { color: '#657286', fontSize: 6.8, fontWeight: '900' },
  withdrawPill: { minHeight: 29, borderRadius: 15, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FCEEF2' },
  withdrawText: { color: '#B93A55', fontSize: 6.7, fontWeight: '900' },

  empty: { marginTop: 11, padding: 22, borderRadius: 16, alignItems: 'center', backgroundColor: '#F8F9FB' },
  emptyIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF4FF' },
  emptyTitle: { marginTop: 9, color: '#0F1D33', fontSize: 10.5, fontWeight: '900' },
  emptyCopy: { marginTop: 4, color: '#7B8798', textAlign: 'center', fontSize: 8.2, lineHeight: 11.5, fontWeight: '700' },
  emptyAction: { marginTop: 10, minHeight: 36, borderRadius: 18, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#164BB8' },
  emptyActionText: { color: '#FFFFFF', fontSize: 8.3, fontWeight: '900' },

  supportCard: { marginTop: 12, borderRadius: 19, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0F1D33' },
  supportIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#164BB8' },
  supportTitle: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  supportCopy: { marginTop: 3, color: '#B4BFCE', fontSize: 8, lineHeight: 11.5, fontWeight: '700' },
});

export default ExchangeActivityCenter;
