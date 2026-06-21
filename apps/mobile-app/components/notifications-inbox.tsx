import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppBadge } from '@/components/design-system';
import { notificationAudienceFilter, useRealtimeNotifications } from '@/components/realtime-notifications';
import { Button, Card, EmptyState, LoadingState, Message, Screen } from '@/components/ui';
import { getCurrentSession, getProfile, isValidProfile } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { palette, radii, roleTheme } from '@/lib/theme';
import type { Notification } from '@/lib/types';

export function NotificationsInbox({ audience }: { audience: 'customer' | 'staff' }) {
  const router = useRouter();
  const { refreshUnreadCount } = useRealtimeNotifications();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

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
    <Screen title="Notifications" subtitle={`${unreadCount} unread`}>
      {message ? <Message type="error">{message}</Message> : null}
      {unreadCount ? <Button label="Mark all as read" variant="secondary" onPress={() => void markAllRead()} /> : null}
      {!notifications.length ? (
        <EmptyState title="No notifications" body="New notifications will appear here." />
      ) : notifications.map((notification) => (
        <Card key={notification.id} accessibilityRole="button" onPress={() => void openNotification(notification)} style={[styles.notificationCard, notification.status === 'unread' ? styles.unreadCard : styles.readCard]}>
          <View style={styles.notificationTop}>
            <View style={[styles.notificationIcon, notification.status === 'unread' && styles.unreadIcon]}>
              <MaterialCommunityIcons name={notification.status === 'unread' ? 'bell-ring-outline' : 'bell-check-outline'} size={20} color={notification.status === 'unread' ? roleTheme.ops.accent : palette.slate} />
            </View>
            <View style={styles.notificationCopy}>
              <Text style={[styles.notificationTitle, notification.status === 'unread' && styles.unreadTitle]}>{notification.title}</Text>
              <Text style={styles.notificationTime}>{formatDateTime(notification.created_at)}</Text>
            </View>
            <AppBadge label={notification.status === 'unread' ? 'Unread' : 'Read'} tone={notification.status === 'unread' ? 'warning' : 'neutral'} />
          </View>
          <Text style={styles.notificationMessage}>{notification.message}</Text>
        </Card>
      ))}
    </Screen>
  );
}

function formatDateTime(value?: string) {
  if (!value) return 'Just now';
  return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  notificationCard: { marginBottom: 8 },
  unreadCard: { borderColor: '#BFD8FF', backgroundColor: '#F4F8FF' },
  readCard: { opacity: 0.82 },
  notificationTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notificationIcon: { width: 38, height: 38, borderRadius: radii.sm, backgroundColor: palette.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  unreadIcon: { backgroundColor: palette.blueSoft },
  notificationCopy: { flex: 1, minWidth: 0 },
  notificationTitle: { color: palette.ink, fontSize: 15, fontWeight: '700' },
  unreadTitle: { fontWeight: '900' },
  notificationTime: { color: palette.muted, fontSize: 11, fontWeight: '600', marginTop: 2 },
  notificationMessage: { color: palette.slate, fontSize: 13, fontWeight: '500', lineHeight: 19, marginTop: 9 },
});
