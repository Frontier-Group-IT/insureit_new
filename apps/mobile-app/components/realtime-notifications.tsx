import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Href, usePathname, useRouter } from 'expo-router';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getCurrentSession, getProfile, isValidProfile } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, palette, radii, roleTheme } from '@/lib/theme';
import type { Notification, Profile } from '@/lib/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ClaimNotification = {
  id: string;
  claimId: string;
  title: string;
  message: string;
  createdAt: string;
  route: Href;
};

type NotificationContextValue = {
  latest: ClaimNotification | null;
  unreadCount: number;
  markSeen: () => void;
  refreshUnreadCount: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue>({
  latest: null,
  unreadCount: 0,
  markSeen: () => undefined,
  refreshUnreadCount: async () => undefined,
});

export function RealtimeNotificationProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [latest, setLatest] = useState<ClaimNotification | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastShownRef = useRef('');

  useEffect(() => {
    let active = true;

    async function loadProfile(userId?: string) {
      if (!userId) {
        if (active) {
          setProfile(null);
          setLatest(null);
          setUnreadCount(0);
        }
        return;
      }
      try {
        const nextProfile = await getProfile(userId);
        if (active) setProfile(isValidProfile(nextProfile) ? nextProfile : null);
      } catch (error) {
        console.warn('Realtime profile lookup failed.', error);
        if (active) {
          setProfile(null);
          setLatest(null);
          setUnreadCount(0);
        }
      }
    }

    supabase.auth.getSession().then(({ data }) => loadProfile(data.session?.user.id)).catch(() => loadProfile());
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadProfile(session?.user.id);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!profile) return undefined;

    void refreshUnreadCountFor(profile.id);

    const channel = supabase
      .channel(`claim-notifications-${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const notification = payload.new as Notification;
          if (!notification?.claim_id || !isNotificationForProfile(notification, profile.id)) return;
          showNotification(notification, profile.role === 'customer');
          void refreshUnreadCountFor(profile.id);
        },
      )
      .subscribe();

    function showNotification(notification: Notification, isCustomer: boolean) {
      const claimId = notification.claim_id ?? '';
      const signature = `${claimId}:${notification.title}:${notification.message}`;
      if (lastShownRef.current === signature) return;
      lastShownRef.current = signature;
      const route = isCustomer
        ? ({ pathname: '/customer/claim-detail', params: { id: claimId } } as const)
        : ({ pathname: '/staff/claim-detail', params: { id: claimId } } as const);

      setLatest({
        id: notification.id,
        claimId,
        title: notification.title,
        message: notification.message,
        createdAt: notification.created_at ?? new Date().toISOString(),
        route,
      });
      setUnreadCount((current) => Math.min(current + 1, 99));
    }

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile]);

  async function refreshUnreadCountFor(profileId: string) {
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .or(notificationAudienceFilter(profileId))
      .eq('status', 'unread');
    setUnreadCount(Math.min(count ?? 0, 99));
  }

  const value = useMemo(() => ({
    latest,
    unreadCount,
    markSeen: () => {
      setUnreadCount(0);
      if (profile) {
        void supabase
          .from('notifications')
          .update({ status: 'read' })
          .or(notificationAudienceFilter(profile.id))
          .eq('status', 'unread');
      }
    },
    refreshUnreadCount: async () => {
      if (profile) await refreshUnreadCountFor(profile.id);
    },
  }), [latest, profile, unreadCount]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationBanner
        notification={latest}
        onOpen={(route) => {
          setUnreadCount(0);
          router.push(route);
        }}
      />
    </NotificationContext.Provider>
  );
}

export function notificationAudienceFilter(profileId: string) {
  return `profile_id.eq.${profileId},and(profile_id.is.null,claim_id.not.is.null)`;
}

export function isNotificationForProfile(notification: Notification, profileId: string) {
  return notification.profile_id === profileId || (notification.profile_id === null && Boolean(notification.claim_id));
}
export function useRealtimeNotifications() {
  return useContext(NotificationContext);
}

export function NotificationBell({ color = palette.ink }: { color?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { unreadCount, refreshUnreadCount } = useRealtimeNotifications();
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelMessage, setPanelMessage] = useState('');
  const [panelNotifications, setPanelNotifications] = useState<Notification[]>([]);
  const customerMode = pathname.startsWith('/customer');

  async function loadCustomerNotifications() {
    setPanelLoading(true);
    setPanelMessage('');
    try {
      const session = await getCurrentSession();
      if (!session?.user) {
        setPanelNotifications([]);
        setPanelMessage('Please sign in again to view notifications.');
        return;
      }
      const nextProfile = await getProfile(session.user.id);
      if (!isValidProfile(nextProfile) || nextProfile.role !== 'customer') {
        setPanelNotifications([]);
        setPanelMessage('Notifications are not available for this account.');
        return;
      }
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(notificationAudienceFilter(nextProfile.id))
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) {
        setPanelNotifications([]);
        setPanelMessage('Notifications could not be loaded.');
        return;
      }
      setPanelNotifications(data ?? []);
      await refreshUnreadCount();
    } catch (error) {
      console.warn('Customer notification panel load failed.', error);
      setPanelNotifications([]);
      setPanelMessage('Notifications could not be loaded.');
    } finally {
      setPanelLoading(false);
    }
  }

  function togglePanel() {
    if (!customerMode) {
      router.push('/staff/notifications');
      return;
    }
    if (panelOpen) {
      setPanelOpen(false);
      return;
    }
    setPanelOpen(true);
    void loadCustomerNotifications();
  }

  async function openPanelNotification(notification: Notification) {
    if (notification.status === 'unread') {
      const { error } = await supabase.from('notifications').update({ status: 'read' }).eq('id', notification.id);
      if (!error) {
        setPanelNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, status: 'read' } : item));
        await refreshUnreadCount();
      }
    }

    if (!notification.claim_id) return;

    const { data: linkedClaim } = await supabase
      .from('claims')
      .select('claim_service_mode')
      .eq('id', notification.claim_id)
      .maybeSingle();

    const route = linkedClaim?.claim_service_mode === 'self_managed'
      ? ({ pathname: '/customer/self-managed-claim-detail', params: { id: notification.claim_id } } as Href)
      : ({ pathname: '/customer/claim-detail', params: { id: notification.claim_id } } as Href);

    setPanelOpen(false);
    router.push(route);
  }

  const panelUnreadCount = panelNotifications.filter((item) => item.status === 'unread').length;

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={togglePanel} style={styles.bellButton}>
        <MaterialCommunityIcons name={unreadCount > 0 ? 'bell-ring-outline' : 'bell-outline'} size={21} color={color} />
        {unreadCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        ) : null}
      </Pressable>

      {customerMode ? (
        <Modal
          visible={panelOpen}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setPanelOpen(false)}
        >
          <Pressable style={styles.notificationPanelBackdrop} onPress={() => setPanelOpen(false)}>
            <Pressable
              onPress={(event) => event.stopPropagation()}
              style={[styles.notificationPanel, { top: insets.top + 62 }]}
            >
              <View style={styles.notificationPanelHeader}>
                <Text style={styles.notificationPanelTitle}>Notifications</Text>
                {panelUnreadCount > 0 ? <Text style={styles.notificationPanelCount}>{panelUnreadCount} unread</Text> : null}
              </View>

              {panelLoading ? (
                <View style={styles.notificationPanelState}>
                  <Text style={styles.notificationPanelStateText}>Loading notifications...</Text>
                </View>
              ) : panelMessage ? (
                <View style={styles.notificationPanelState}>
                  <Text style={styles.notificationPanelStateText}>{panelMessage}</Text>
                </View>
              ) : !panelNotifications.length ? (
                <View style={styles.notificationPanelState}>
                  <Text style={styles.notificationPanelStateText}>No notifications yet.</Text>
                </View>
              ) : (
                <ScrollView
                  style={styles.notificationPanelList}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {panelNotifications.map((notification, index) => {
                    const unread = notification.status === 'unread';
                    return (
                      <Pressable
                        key={notification.id}
                        accessibilityRole="button"
                        onPress={() => void openPanelNotification(notification)}
                        style={[
                          styles.notificationPanelRow,
                          unread && styles.notificationPanelRowUnread,
                          index === panelNotifications.length - 1 && styles.notificationPanelRowLast,
                        ]}
                      >
                        <View style={styles.notificationPanelCopy}>
                          <View style={styles.notificationPanelTitleRow}>
                            <Text
                              numberOfLines={2}
                              style={[styles.notificationPanelRowTitle, unread && styles.notificationPanelRowTitleUnread]}
                            >
                              {notification.title}
                            </Text>
                            <Text style={styles.notificationPanelTime}>{formatPanelNotificationTime(notification.created_at)}</Text>
                          </View>
                          <Text numberOfLines={2} style={styles.notificationPanelMessage}>{notification.message}</Text>
                        </View>
                        {unread ? <View style={styles.notificationPanelUnreadDot} /> : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
}

function formatPanelNotificationTime(value?: string) {
  if (!value) return 'Now';
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  if (sameDay) return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function NotificationBanner({ notification, onOpen }: { notification: ClaimNotification | null; onOpen: (route: Href) => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!notification) return undefined;
    setVisible(true);
    opacity.setValue(0);
    translateY.setValue(-16);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -16, duration: 220, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setVisible(false);
      });
    }, 5200);

    return () => clearTimeout(timer);
  }, [notification, opacity, translateY]);

  if (!notification || !visible) return null;

  return (
    <Animated.View pointerEvents="box-none" style={[styles.bannerWrap, { opacity, transform: [{ translateY }] }]}>
      <Pressable accessibilityRole="button" onPress={() => onOpen(notification.route)} style={styles.banner}>
        <View style={styles.bannerIcon}>
          <MaterialCommunityIcons name="bell-badge-outline" size={22} color={roleTheme.ops.accent} />
        </View>
        <View style={styles.bannerCopy}>
          <Text style={styles.bannerEyebrow}>Claim update</Text>
          <Text style={styles.bannerTitle} numberOfLines={1}>{notification.title}</Text>
          <Text style={styles.bannerMessage} numberOfLines={2}>{notification.message}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={23} color={palette.slate} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bellButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  notificationPanelBackdrop: { flex: 1, backgroundColor: 'rgba(7,29,73,0.08)' },
  notificationPanel: { position: 'absolute', left: 12, right: 12, maxHeight: 430, overflow: 'hidden', borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D9E5F2', shadowColor: '#071D49', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 14 },
  notificationPanelHeader: { minHeight: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D9E5F2' },
  notificationPanelTitle: { color: palette.ink, fontSize: 14, fontWeight: '900' },
  notificationPanelCount: { color: roleTheme.customer.accent, fontSize: 11, fontWeight: '900' },
  notificationPanelList: { maxHeight: 378 },
  notificationPanelRow: { minHeight: 72, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E4ECF5' },
  notificationPanelRowUnread: { backgroundColor: '#F2F7FF' },
  notificationPanelRowLast: { borderBottomWidth: 0 },
  notificationPanelCopy: { flex: 1, minWidth: 0 },
  notificationPanelTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  notificationPanelRowTitle: { flex: 1, minWidth: 0, color: palette.ink, fontSize: 13, lineHeight: 17, fontWeight: '700' },
  notificationPanelRowTitleUnread: { fontWeight: '900' },
  notificationPanelTime: { color: palette.slate, fontSize: 10, lineHeight: 16, fontWeight: '700' },
  notificationPanelMessage: { color: palette.slate, fontSize: 11.5, lineHeight: 16, fontWeight: '600', marginTop: 3 },
  notificationPanelUnreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#276EF1' },
  notificationPanelState: { minHeight: 86, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  notificationPanelStateText: { color: palette.slate, fontSize: 12.5, fontWeight: '700', textAlign: 'center' },
  badge: { position: 'absolute', top: 7, right: 6, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: palette.surface },
  badgeText: { color: palette.surface, fontSize: 9, fontWeight: '900' },
  bannerWrap: { position: 'absolute', top: 58, left: 14, right: 14, zIndex: 100 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 86, padding: 14, borderRadius: radii.lg, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, shadowColor: '#0B1220', shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  bannerIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.blueSoft },
  bannerCopy: { flex: 1 },
  bannerEyebrow: { color: roleTheme.ops.accent, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  bannerTitle: { color: palette.ink, fontSize: 15, fontWeight: '900', marginTop: 2 },
  bannerMessage: { color: palette.slate, fontSize: 13, lineHeight: 18, marginTop: 2 },
});
