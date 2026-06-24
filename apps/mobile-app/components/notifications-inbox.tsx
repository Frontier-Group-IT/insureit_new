import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { notificationAudienceFilter, useRealtimeNotifications } from '@/components/realtime-notifications';
import { EmptyState, LoadingState, Message, Screen } from '@/components/ui';
import { getCurrentSession, getProfile, isValidProfile } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, palette, roleTheme } from '@/lib/theme';
import type { Notification } from '@/lib/types';

type NotificationCategory = 'all' | 'claims' | 'policies' | 'documents' | 'payments' | 'support';

type CategoryMeta = {
  key: NotificationCategory;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tone: string;
  soft: string;
};

const CATEGORIES: CategoryMeta[] = [
  { key: 'all', label: 'All', icon: 'bell-outline', tone: roleTheme.customer.accent, soft: '#EAF8F0' },
  { key: 'claims', label: 'Claims', icon: 'briefcase-check-outline', tone: '#276EF1', soft: '#EAF2FF' },
  { key: 'policies', label: 'Policies', icon: 'shield-check-outline', tone: '#0F766E', soft: '#E6F7F4' },
  { key: 'documents', label: 'Documents', icon: 'file-document-check-outline', tone: '#6750D8', soft: '#F0EDFF' },
  { key: 'payments', label: 'Payments', icon: 'credit-card-check-outline', tone: '#B7791F', soft: '#FFF5DB' },
  { key: 'support', label: 'Support', icon: 'headset', tone: '#0B63CE', soft: '#E8F1FF' },
];

export function NotificationsInbox({ audience }: { audience: 'customer' | 'staff' }) {
  const router = useRouter();
  const { refreshUnreadCount } = useRealtimeNotifications();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory>('all');

  const load = useCallback(async () => {
    setMessage('');
    const session = await getCurrentSession();
    if (!session?.user) return router.replace('/login');
    const nextProfile = await getProfile(session.user.id);
    if (!isValidProfile(nextProfile) || (audience === 'customer' && nextProfile.role !== 'customer') || (audience === 'staff' && nextProfile.role === 'customer')) {
      return router.replace('/access-denied');
    }
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .or(notificationAudienceFilter(nextProfile.id))
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      setMessage('Notifications could not be loaded.');
      setNotifications([]);
    } else {
      setNotifications(data ?? []);
      await refreshUnreadCount();
    }
    setLoading(false);
  }, [audience, refreshUnreadCount, router]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    void load();
  }, [load]));

  const unreadCount = useMemo(() => notifications.filter((item) => item.status === 'unread').length, [notifications]);
  const filteredNotifications = useMemo(() => {
    if (selectedCategory === 'all') return notifications;
    return notifications.filter((item) => categoryForNotification(item) === selectedCategory);
  }, [notifications, selectedCategory]);
  const groupedNotifications = useMemo(() => groupNotifications(filteredNotifications), [filteredNotifications]);
  const summaryCounts = useMemo(() => {
    return CATEGORIES.reduce<Record<NotificationCategory, number>>((current, category) => {
      current[category.key] = notifications.filter((item) => item.status === 'unread' && (category.key === 'all' || categoryForNotification(item) === category.key)).length;
      return current;
    }, { all: 0, claims: 0, policies: 0, documents: 0, payments: 0, support: 0 });
  }, [notifications]);

  async function openNotification(notification: Notification) {
    if (!notification.claim_id) {
      setMessage('This notification is not linked to a claim.');
      return;
    }
    const route = audience === 'customer'
      ? ({ pathname: '/customer/claim-detail', params: { id: notification.claim_id } } as const)
      : ({ pathname: '/staff/claim-detail', params: { id: notification.claim_id } } as const);
    router.push(route as Href);
    if (notification.status === 'unread') {
      void markRead([notification.id]);
    }
  }

  async function markAllRead() {
    const ids = notifications.filter((item) => item.status === 'unread').map((item) => item.id);
    await markRead(ids);
  }

  async function markRead(ids: string[]) {
    if (!ids.length) return;
    const { error } = await supabase.from('notifications').update({ status: 'read' }).in('id', ids);
    if (error) {
      setMessage('Could not mark notifications as read.');
      return;
    }
    setNotifications((current) => current.map((item) => ids.includes(item.id) ? { ...item, status: 'read' } : item));
    await refreshUnreadCount();
  }

  if (loading) return <Screen title="Notifications"><LoadingState label="Loading notifications" /></Screen>;

  return (
    <Screen title="Notifications" showTitleHeader={false}>
      {message ? <Message type="error">{message}</Message> : null}
      <View style={styles.pageHeader}>
        <View style={styles.headerIconButton}>
          <MaterialCommunityIcons name="menu" size={22} color={palette.ink} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.pageTitle}>Notifications</Text>
          <Text style={styles.pageSubtitle}>Stay informed. Stay in control.</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => void markAllRead()} style={styles.headerIconButton}>
          <MaterialCommunityIcons name="cog-outline" size={22} color={palette.ink} />
        </Pressable>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <Text style={styles.summaryTitle}>Unread Summary</Text>
          <Pressable accessibilityRole="button" onPress={() => setSelectedCategory('all')} style={styles.viewAllButton}>
            <Text style={styles.viewAllText}>View all</Text>
          </Pressable>
        </View>
        <View style={styles.summaryGrid}>
          {CATEGORIES.filter((category) => category.key !== 'all').map((category) => (
            <Pressable key={category.key} accessibilityRole="button" onPress={() => setSelectedCategory(category.key)} style={[styles.summaryTile, selectedCategory === category.key && styles.summaryTileActive]}>
              <View style={[styles.summaryTileIcon, { backgroundColor: category.soft }]}>
                <MaterialCommunityIcons name={category.icon} size={20} color={category.tone} />
              </View>
              <Text style={styles.summaryTileLabel} numberOfLines={1}>{category.label}</Text>
              <Text style={styles.summaryTileCount}>{twoDigit(summaryCounts[category.key])}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.filterRow}>
        {CATEGORIES.map((category) => {
          const active = selectedCategory === category.key;
          return (
            <Pressable key={category.key} accessibilityRole="button" onPress={() => setSelectedCategory(category.key)} style={[styles.filterPill, active && styles.filterPillActive]}>
              <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{category.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {!notifications.length ? (
        <EmptyState title="No notifications" body="New notifications will appear here." />
      ) : !filteredNotifications.length ? (
        <EmptyState title="No updates here" body="Try another notification category." />
      ) : (
        <View style={styles.timelineCard}>
          {groupedNotifications.map((group) => (
            <View key={group.label} style={styles.groupBlock}>
              <Text style={styles.groupLabel}>{group.label}</Text>
              {group.items.map((notification, index) => {
                const category = metaForNotification(notification);
                return (
                  <View key={notification.id} style={styles.timelineRow}>
                    <View style={styles.timelineRail}>
                      <View style={styles.timelineDot} />
                      {index !== group.items.length - 1 ? <View style={styles.timelineLine} /> : null}
                    </View>
                    <Pressable accessibilityRole="button" onPress={() => void openNotification(notification)} style={[styles.notificationCard, notification.status === 'unread' ? styles.unreadCard : styles.readCard]}>
                      <View style={[styles.notificationIcon, { backgroundColor: category.soft }]}>
                        <MaterialCommunityIcons name={category.icon} size={21} color={category.tone} />
                      </View>
                      <View style={styles.notificationCopy}>
                        <View style={styles.notificationTopLine}>
                          <Text style={[styles.notificationTitle, notification.status === 'unread' && styles.unreadTitle]} numberOfLines={2}>{notification.title}</Text>
                          <Text style={styles.notificationTime}>{formatNotificationTime(notification.created_at, group.label)}</Text>
                        </View>
                        <Text style={styles.notificationMessage} numberOfLines={2}>{notification.message}</Text>
                      </View>
                      {notification.status === 'unread' ? <View style={styles.unreadDot} /> : null}
                      <MaterialCommunityIcons name="chevron-right" size={22} color={palette.slate} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))}
          <View style={styles.caughtUpCard}>
            <View style={styles.caughtUpIcon}>
              <MaterialCommunityIcons name="bell-check-outline" size={22} color={palette.ink} />
            </View>
            <View style={styles.caughtUpCopy}>
              <Text style={styles.caughtUpTitle}>{unreadCount ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'} remaining` : 'You’re all caught up!'}</Text>
              <Text style={styles.caughtUpText}>We’ll notify you when there’s an update.</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => void markAllRead()} style={styles.preferencesButton}>
              <MaterialCommunityIcons name="cog-outline" size={16} color={roleTheme.customer.accent} />
              <Text style={styles.preferencesText}>Manage</Text>
            </Pressable>
          </View>
        </View>
      )}
    </Screen>
  );
}

function categoryForNotification(notification: Notification): NotificationCategory {
  const text = `${notification.title} ${notification.message}`.toLowerCase();
  if (text.includes('document') || text.includes('kyc') || text.includes('upload') || text.includes('verified')) return 'documents';
  if (text.includes('payment') || text.includes('paid') || text.includes('invoice') || text.includes('premium')) return 'payments';
  if (text.includes('policy') || text.includes('renewal') || text.includes('endorsement')) return 'policies';
  if (text.includes('support') || text.includes('query') || text.includes('ticket') || text.includes('replied')) return 'support';
  return 'claims';
}

function metaForNotification(notification: Notification) {
  return CATEGORIES.find((category) => category.key === categoryForNotification(notification)) ?? CATEGORIES[1];
}

function groupNotifications(notifications: Notification[]) {
  const groups = [
    { label: 'Today', items: [] as Notification[] },
    { label: 'Yesterday', items: [] as Notification[] },
    { label: 'Earlier', items: [] as Notification[] },
  ];
  notifications.forEach((notification) => {
    const bucket = bucketForDate(notification.created_at);
    groups.find((group) => group.label === bucket)?.items.push(notification);
  });
  return groups.filter((group) => group.items.length);
}

function bucketForDate(value?: string) {
  if (!value) return 'Today';
  const date = new Date(value);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return 'Earlier';
}

function formatNotificationTime(value?: string, group?: string) {
  if (!value) return 'Now';
  const date = new Date(value);
  if (group === 'Today') return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  if (group === 'Yesterday') return 'Yesterday';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function twoDigit(value: number) {
  return String(value).padStart(2, '0');
}

const styles = StyleSheet.create({
  pageHeader: { minHeight: 72, borderRadius: 24, padding: 14, marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: 'rgba(198,222,250,0.95)', flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#0C4A88', shadowOpacity: 0.08, shadowRadius: 14, elevation: 2 },
  headerIconButton: { width: 42, height: 42, borderRadius: 15, backgroundColor: '#F4FAFF', borderWidth: 1, borderColor: '#D6E7FA', alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0 },
  pageTitle: { color: palette.ink, fontSize: 24, fontWeight: '900', lineHeight: 30 },
  pageSubtitle: { color: palette.slate, fontSize: 13, fontWeight: '700', lineHeight: 18, marginTop: 1 },
  summaryCard: { borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: 'rgba(198,222,250,0.95)', padding: 13, marginBottom: 12, shadowColor: palette.ink, shadowOpacity: 0.06, shadowRadius: 14, elevation: 2 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  summaryTitle: { color: palette.ink, fontSize: 14, fontWeight: '900' },
  viewAllButton: { minHeight: 28, justifyContent: 'center', paddingHorizontal: 4 },
  viewAllText: { color: roleTheme.customer.accent, fontSize: 12, fontWeight: '900' },
  summaryGrid: { flexDirection: 'row', gap: 8 },
  summaryTile: { flex: 1, minHeight: 88, borderRadius: 16, backgroundColor: '#F8FCFF', borderWidth: 1, borderColor: '#E0ECF8', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, paddingVertical: 9 },
  summaryTileActive: { borderColor: '#8EC5FF', backgroundColor: '#F2FAFF' },
  summaryTileIcon: { width: 35, height: 35, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  summaryTileLabel: { color: palette.slate, fontSize: 10, fontWeight: '800', textAlign: 'center' },
  summaryTileCount: { color: palette.ink, fontSize: 20, fontWeight: '900', lineHeight: 25, marginTop: 1 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  filterPill: { flex: 1, minHeight: 36, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.82)', borderWidth: 1, borderColor: '#DCE8F4', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  filterPillActive: { backgroundColor: '#1F7AF3', borderColor: '#1F7AF3', shadowColor: '#1F7AF3', shadowOpacity: 0.22, shadowRadius: 8, elevation: 2 },
  filterPillText: { color: palette.slate, fontSize: 10.5, fontWeight: '900' },
  filterPillTextActive: { color: colors.white },
  timelineCard: { borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.72)', borderWidth: 1, borderColor: 'rgba(213,229,247,0.95)', padding: 12, shadowColor: palette.ink, shadowOpacity: 0.05, shadowRadius: 13, elevation: 2 },
  groupBlock: { marginBottom: 8 },
  groupLabel: { color: palette.ink, fontSize: 14, fontWeight: '900', marginBottom: 8, marginLeft: 2 },
  timelineRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  timelineRail: { width: 16, alignItems: 'center', paddingTop: 21 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#BFD4EA', borderWidth: 2, borderColor: '#F7FBFF' },
  timelineLine: { flex: 1, width: 2, minHeight: 56, backgroundColor: '#D5E2F0', marginTop: 3 },
  notificationCard: { flex: 1, minHeight: 84, borderRadius: 18, borderWidth: 1, borderColor: '#DCE8F4', padding: 11, marginBottom: 8, backgroundColor: '#FFFFFF', shadowColor: palette.ink, shadowOpacity: 0.035, shadowRadius: 9, elevation: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  unreadCard: { borderColor: '#BFD8FF', backgroundColor: '#F8FBFF' },
  readCard: { backgroundColor: '#FFFFFF' },
  notificationIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  notificationCopy: { flex: 1, minWidth: 0 },
  notificationTopLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  notificationTitle: { color: palette.ink, flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 18, fontWeight: '800' },
  unreadTitle: { fontWeight: '900' },
  notificationTime: { color: palette.slate, fontSize: 10.5, fontWeight: '800', lineHeight: 17 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6' },
  notificationMessage: { color: palette.slate, fontSize: 11.5, fontWeight: '700', lineHeight: 16, marginTop: 4 },
  caughtUpCard: { minHeight: 66, borderRadius: 18, backgroundColor: '#F6FAFF', borderWidth: 1, borderColor: '#D6E7FA', padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  caughtUpIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', alignItems: 'center', justifyContent: 'center' },
  caughtUpCopy: { flex: 1, minWidth: 0 },
  caughtUpTitle: { color: palette.ink, fontSize: 13, fontWeight: '900' },
  caughtUpText: { color: palette.slate, fontSize: 11.5, fontWeight: '700', marginTop: 2 },
  preferencesButton: { minHeight: 36, borderRadius: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#BFD8FF', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  preferencesText: { color: roleTheme.customer.accent, fontSize: 11, fontWeight: '900' },
});
