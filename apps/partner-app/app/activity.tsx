import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerStateView } from '@/components/ui/partner-state-view';
import { getPartnerInsurerLogoSource } from '@/lib/catalog-logos';
import {
  getPartnerActivity,
  getPartnerActivityReadKeys,
  markPartnerActivityRead,
  partnerActivityEventKey,
  type PartnerActivityData,
  type PartnerActivityItem,
} from '@/lib/engagement';
import { PartnerAssets } from '@/lib/partner-assets';
import { partnerTheme } from '@/lib/theme';

export default function ActivityScreen() {
  const router = useRouter();
  const [data, setData] = useState<PartnerActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [activityFilter, setActivityFilter] = useState<'unread' | 'read' | 'all'>('unread');
  const [readKeys, setReadKeys] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const nextData = await getPartnerActivity(100);
      const nextReadKeys = await getPartnerActivityReadKeys(nextData.items);
      setData(nextData);
      setReadKeys(nextReadKeys);
      const unreadCount = nextData.items.reduce(
        (count, item) => count + (nextReadKeys.has(partnerActivityEventKey(item)) ? 0 : 1),
        0,
      );
      setActivityFilter(unreadCount > 0 ? 'unread' : 'all');
    } catch {
      setData(null);
      setError('Recent activity could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const all = data?.items.length ?? 0;
    const read = data?.items.reduce(
      (count, item) => count + (readKeys.has(partnerActivityEventKey(item)) ? 1 : 0),
      0,
    ) ?? 0;
    return { all, read, unread: Math.max(0, all - read) };
  }, [data, readKeys]);

  const filteredItems = useMemo(() => {
    if (!data) return [];
    const normalizedQuery = query.trim().toLowerCase();

    return data.items.filter((item) => {
      const isRead = readKeys.has(partnerActivityEventKey(item));
      if (activityFilter === 'unread' && isRead) return false;
      if (activityFilter === 'read' && !isRead) return false;
      if (!normalizedQuery) return true;

      const searchable = [
        labelFor(item.kind),
        item.title,
        item.subtitle,
        item.meta,
        item.kind,
      ].join(' ').toLowerCase();

      return searchable.includes(normalizedQuery);
    });
  }, [activityFilter, data, query, readKeys]);

  function openActivity(item: PartnerActivityItem) {
    const key = partnerActivityEventKey(item);
    const wasRead = readKeys.has(key);

    if (!wasRead) {
      setReadKeys((current) => {
        const next = new Set(current);
        next.add(key);
        return next;
      });
      void markPartnerActivityRead(item).catch(() => {
        setReadKeys((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
      });
    }

    router.push(item.route as never);
  }

  return (
    <PartnerScreen title="What changed" hideTopBar>
      <View style={styles.hero}>
        <View style={styles.heroShapeOne} />
        <View style={styles.heroShapeTwo} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <View style={styles.heroIcon}>
          <Ionicons name="megaphone" size={23} color="#4A35F1" />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.heroEyebrow}>ACTIVITY</Text>
          <Text style={styles.heroTitle}>What changed</Text>
        </View>
      </View>

      <View style={styles.body}>
        {loading ? (
          <PartnerStateView state="loading" title="Loading recent activity" />
        ) : error || !data ? (
          <PartnerStateView
            state="error"
            title="Activity is temporarily unavailable"
            message={error || 'Recent activity could not be loaded.'}
            actionLabel="Try again"
            onAction={() => void load()}
          />
        ) : <>
          {data.attention.length ? <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Needs attention</Text>
            </View>
            <View style={styles.attentionList}>
              {data.attention.slice(0, 3).map((item) => (
                <Pressable
                  key={`${item.kind}-${item.title}`}
                  onPress={() => router.push(item.route as never)}
                  style={styles.attentionCard}
                >
                  <View style={styles.attentionIcon}>
                    <Image source={PartnerAssets.status.opportunityAlert} style={styles.attentionArtwork} resizeMode="contain" />
                  </View>
                  <View style={styles.attentionDivider} />
                  <View style={styles.attentionBody}>
                    <Text style={styles.attentionTitle}>{item.title}</Text>
                    <Text style={styles.attentionText}>{item.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={21} color="#06155E" />
                </Pressable>
              ))}
            </View>
          </> : null}

          <View style={styles.recentHeader}>
            <Text style={styles.sectionTitle}>Recent activity</Text>
            <Text style={styles.today}> · Today</Text>
          </View>

          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={20} color="#61728A" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search all activity..."
              placeholderTextColor="#8390A4"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={styles.searchInput}
              accessibilityLabel="Search all activity"
            />
            {query ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear activity search"
                hitSlop={8}
                onPress={() => setQuery('')}
                style={styles.searchClear}
              >
                <Ionicons name="close-circle-outline" size={18} color="#96A1B2" />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.filterTabs}>
            {([
              ['unread', 'Unread', counts.unread],
              ['read', 'Read', counts.read],
              ['all', 'All', counts.all],
            ] as const).map(([key, label, count]) => {
              const active = activityFilter === key;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setActivityFilter(key)}
                  style={[styles.filterTab, active && styles.filterTabActive]}
                >
                  <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>
                    {label} ({count})
                  </Text>
                  {active ? <View style={styles.filterIndicator} /> : null}
                </Pressable>
              );
            })}
          </View>

          {filteredItems.length ? (
            <View style={styles.activityList}>
              {filteredItems.map((item) => {
                const insurerLogo = getPartnerInsurerLogoSource(item.meta);
                return (
                  <Pressable
                    key={`${item.kind}-${item.entity_id}-${item.event_at}`}
                    onPress={() => openActivity(item)}
                    style={styles.itemCard}
                  >
                    <View style={styles.logoTile}>
                      <Image
                        source={insurerLogo ?? activityAsset(item.kind)}
                        style={insurerLogo ? styles.insurerLogo : styles.eventArtworkImage}
                        resizeMode="contain"
                      />
                    </View>

                    <View style={styles.itemBody}>
                      <View style={styles.itemTop}>
                        <View style={styles.kindPill}>
                          <Text style={[styles.kind, toneText(item.tone)]}>{labelFor(item.kind)}</Text>
                        </View>
                        <Text style={styles.date}>{formatDate(item.event_at)}</Text>
                      </View>
                      <Text numberOfLines={1} style={styles.title}>{item.title}</Text>
                      <Text numberOfLines={1} style={styles.subtitle}>{item.subtitle}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <PartnerStateView
              state="empty"
              asset={PartnerAssets.status.announcement}
              title={query ? "No matching activity" : activityFilter === "unread" ? "No unread activity" : activityFilter === "read" ? "No read activity" : "No recent activity"}
              message={query ? "Try another search term or activity filter." : activityFilter === "unread" ? "You are caught up. New activity will appear here." : "New policy, claim, intake and learning events will appear here when they are recorded."}
            />
          )}
        </>}
      </View>
    </PartnerScreen>
  );
}

function activityAsset(kind: PartnerActivityData['items'][number]['kind']) {
  if (kind === 'policy') return PartnerAssets.status.policyActive;
  if (kind === 'claim') return PartnerAssets.navigation.claims;
  if (kind === 'intake') return PartnerAssets.navigation.policyIntake;
  return PartnerAssets.actions.policyChecklist;
}

function labelFor(kind: PartnerActivityData['items'][number]['kind']) {
  if (kind === 'policy') return 'POLICY';
  if (kind === 'claim') return 'CLAIM';
  if (kind === 'intake') return 'OPERATIONS';
  return 'LEARN';
}

function toneText(tone: PartnerActivityData['items'][number]['tone']) {
  if (tone === 'service') return styles.textService;
  if (tone === 'attention') return styles.textAttention;
  if (tone === 'learn') return styles.textLearn;
  if (tone === 'operations') return styles.textOps;
  return styles.textBusiness;
}

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

const styles = StyleSheet.create({
  hero: {
    height: 76,
    marginHorizontal: -partnerTheme.spacing.lg,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    backgroundColor: '#0879DF',
  },
  heroShapeOne: {
    position: 'absolute',
    width: 220,
    height: 140,
    right: -56,
    top: -72,
    borderRadius: 70,
    backgroundColor: 'rgba(22, 129, 231, 0.92)',
    transform: [{ rotate: '-18deg' }],
  },
  heroShapeTwo: {
    position: 'absolute',
    width: 190,
    height: 100,
    right: 54,
    bottom: -70,
    borderRadius: 50,
    backgroundColor: 'rgba(32, 106, 215, 0.52)',
    transform: [{ rotate: '-21deg' }],
  },
  backButton: {
    width: 34,
    height: 44,
    marginRight: 7,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  heroIcon: {
    width: 39,
    height: 39,
    marginRight: 10,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  heroText: { justifyContent: 'center' },
  heroEyebrow: {
    color: '#D9E7FF',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  heroTitle: {
    marginTop: 1,
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
  },
  body: {
    marginHorizontal: -partnerTheme.spacing.lg,
    paddingHorizontal: 18,
    paddingTop: 9,
    paddingBottom: 10,
    backgroundColor: '#F3F6FB',
  },
  sectionHeader: { marginTop: 0, marginBottom: 7 },
  sectionTitle: {
    color: '#0A1024',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  attentionList: { gap: 8 },
  attentionCard: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#FFF9EA',
    borderWidth: 1,
    borderColor: '#F2DCA9',
  },
  attentionIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attentionArtwork: { width: 41, height: 41 },
  attentionDivider: {
    width: 1,
    height: 31,
    marginHorizontal: 10,
    backgroundColor: '#E9D6AC',
  },
  attentionBody: { flex: 1, minWidth: 0 },
  attentionTitle: {
    color: '#10152A',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
  },
  attentionText: {
    marginTop: 2,
    color: '#667084',
    fontSize: 9.5,
    lineHeight: 13,
  },
  recentHeader: {
    marginTop: 10,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  searchWrap: {
    height: 43,
    marginBottom: 7,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D4DCE7',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 41,
    paddingVertical: 0,
    color: '#17213E',
    fontSize: 11.5,
    fontWeight: '600',
  },
  searchClear: {
    width: 24,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterTabs: {
    height: 42,
    marginBottom: 8,
    overflow: 'hidden',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D4DCE7',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
  },
  filterTab: {
    position: 'relative',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  filterTabActive: {
    backgroundColor: '#EEF4FD',
  },
  filterTabText: {
    color: '#778399',
    fontSize: 10.5,
    fontWeight: '800',
  },
  filterTabTextActive: {
    color: '#163F73',
    fontWeight: '900',
  },
  filterIndicator: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: '#3478C5',
  },
  today: {
    color: '#8390AA',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  activityList: { gap: 5 },
  itemCard: {
    minHeight: 63,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 8,
    backgroundColor: '#FFFFFF',
    shadowColor: '#1A2A52',
    shadowOpacity: 0.035,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  logoTile: {
    width: 52,
    height: 50,
    marginRight: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBFCFF',
  },
  insurerLogo: { width: 44, height: 30 },
  eventArtworkImage: { width: 32, height: 32 },
  itemBody: { flex: 1, minWidth: 0 },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  kindPill: {
    alignSelf: 'flex-start',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: '#F0EFFF',
  },
  kind: {
    fontSize: 9.5,
    lineHeight: 11,
    fontWeight: '800',
    letterSpacing: 0.25,
  },
  textBusiness: { color: '#5542E9' },
  textService: { color: '#5542E9' },
  textAttention: { color: '#9A6500' },
  textLearn: { color: '#A3630D' },
  textOps: { color: '#667085' },
  date: {
    color: '#71809C',
    fontSize: 9.5,
    lineHeight: 11,
  },
  title: {
    marginTop: 2,
    color: '#08122E',
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 1,
    color: '#68758E',
    fontSize: 9.5,
    lineHeight: 12,
  },
});
