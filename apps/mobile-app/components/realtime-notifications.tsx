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

type CustomerNotificationFilter = 'all' | 'claim' | 'policies' | 'vehicle';

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
  const [panelMounted, setPanelMounted] = useState(false);
  const [panelLoading, setPanelLoading] = useState(false);
  const panelOpacity = useRef(new Animated.Value(0)).current;
  const panelTranslateY = useRef(new Animated.Value(-8)).current;
  const [panelMessage, setPanelMessage] = useState('');
  const [panelNotifications, setPanelNotifications] = useState<Notification[]>([]);
  const [panelFilter, setPanelFilter] = useState<CustomerNotificationFilter>('all');
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

  function openCustomerPanel() {
    setPanelFilter('all');
    setPanelMounted(true);
    panelOpacity.setValue(0);
    panelTranslateY.setValue(-8);
    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(panelOpacity, { toValue: 1, duration: 190, useNativeDriver: true }),
        Animated.timing(panelTranslateY, { toValue: 0, duration: 190, useNativeDriver: true }),
      ]).start();
    });
    void loadCustomerNotifications();
  }

  function closeCustomerPanel() {
    Animated.parallel([
      Animated.timing(panelOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(panelTranslateY, { toValue: -8, duration: 160, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setPanelMounted(false);
    });
  }

  function togglePanel() {
    if (!customerMode) {
      router.push('/staff/notifications');
      return;
    }
    if (panelMounted) {
      closeCustomerPanel();
      return;
    }
    openCustomerPanel();
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

    closeCustomerPanel();
    router.push(route);
  }

  const panelUnreadCount = panelNotifications.filter((item) => item.status === 'unread').length;
  const filteredPanelNotifications = panelFilter === 'all'
    ? panelNotifications
    : panelNotifications.filter((notification) => customerNotificationCategory(notification) === panelFilter);

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
          visible={panelMounted}
          transparent
          animationType="none"
          statusBarTranslucent
          onRequestClose={closeCustomerPanel}
        >
          <Animated.View style={[styles.notificationPanelBackdrop, { opacity: panelOpacity }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeCustomerPanel} />
            <Animated.View
              style={[
                styles.notificationPanel,
                { top: insets.top + 62, opacity: panelOpacity, transform: [{ translateY: panelTranslateY }] },
              ]}
            >
              <View style={styles.notificationPanelHeader}>
                <Text style={styles.notificationPanelTitle}>Notifications</Text>
                {panelUnreadCount > 0 ? <Text style={styles.notificationPanelCount}>{panelUnreadCount} unread</Text> : null}
              </View>

              <View style={styles.notificationFilterRow}>
                {([
                  ['all', 'All'],
                  ['claim', 'Claim'],
                  ['policies', 'Policies'],
                  ['vehicle', 'Vehicle'],
                ] as const).map(([key, label]) => {
                  const active = panelFilter === key;
                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => setPanelFilter(key)}
                      style={[styles.notificationFilterPill, active && styles.notificationFilterPillActive]}
                    >
                      <Text style={[styles.notificationFilterText, active && styles.notificationFilterTextActive]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {panelLoading ? (
                <View style={styles.notificationSkeletonWrap}>
                  {[0, 1, 2].map((item) => (
                    <View key={item} style={styles.notificationSkeletonRow}>
                      <View style={styles.notificationSkeletonDot} />
                      <View style={styles.notificationSkeletonCopy}>
                        <View style={styles.notificationSkeletonTitle} />
                        <View style={styles.notificationSkeletonMessage} />
                      </View>
                    </View>
                  ))}
                </View>
              ) : panelMessage ? (
                <View style={styles.notificationPanelState}>
                  <Text style={styles.notificationPanelStateText}>{panelMessage}</Text>
                </View>
              ) : !panelNotifications.length ? (
                <View style={styles.notificationPanelState}>
                  <Text style={styles.notificationPanelStateText}>No notifications yet.</Text>
                </View>
              ) : !filteredPanelNotifications.length ? (
                <View style={styles.notificationPanelState}>
                  <Text style={styles.notificationPanelStateText}>No {panelFilter === 'claim' ? 'claim' : panelFilter} notifications yet.</Text>
                </View>
              ) : (
                <ScrollView
                  style={styles.notificationPanelList}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {filteredPanelNotifications.map((notification, index) => {
                    const unread = notification.status === 'unread';
                    const category = customerNotificationCategory(notification);
                    const icon = customerNotificationIcon(category);
                    return (
                      <Pressable
                        key={notification.id}
                        accessibilityRole="button"
                        onPress={() => void openPanelNotification(notification)}
                        style={({ pressed }) => [
                          styles.notificationPanelRow,
                          unread && styles.notificationPanelRowUnread,
                          pressed && styles.notificationPanelRowPressed,
                          index === filteredPanelNotifications.length - 1 && styles.notificationPanelRowLast,
                        ]}
                      >
                        <View style={[styles.notificationTypeIcon, category === 'claim' && styles.notificationTypeIconClaim, category === 'policies' && styles.notificationTypeIconPolicy, category === 'vehicle' && styles.notificationTypeIconVehicle]}>
                          <MaterialCommunityIcons name={icon} size={14} color={category === 'claim' ? '#0A43A3' : category === 'policies' ? '#7A4D00' : category === 'vehicle' ? '#167C69' : '#667085'} />
                        </View>
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
            </Animated.View>
          </Animated.View>
        </Modal>
      ) : null}
    </>
  );
}

function customerNotificationIcon(category: Exclude<CustomerNotificationFilter, 'all'> | null) {
  if (category === 'claim') return 'shield-check-outline' as const;
  if (category === 'policies') return 'file-document-outline' as const;
  if (category === 'vehicle') return 'car-outline' as const;
  return 'bell-outline' as const;
}

function customerNotificationCategory(notification: Notification): Exclude<CustomerNotificationFilter, 'all'> | null {
  if (notification.claim_id) return 'claim';

  const text = `${notification.title} ${notification.message}`.toLowerCase();
  if (/policy|renewal|endorsement|premium|insurer|insurance/.test(text)) return 'policies';
  if (/vehicle|registration|\brc\b|fitness|\bpuc\b|permit|road tax|challan/.test(text)) return 'vehicle';
  return null;
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
  notificationFilterRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E4ECF5', backgroundColor: '#FBFDFF' },
  notificationFilterPill: { minHeight: 30, borderRadius: 999, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F6FA', borderWidth: 1, borderColor: '#E0E7EF' },
  notificationFilterPillActive: { backgroundColor: palette.navy, borderColor: palette.navy },
  notificationFilterText: { color: '#667085', fontSize: 10.5, fontWeight: '800' },
  notificationFilterTextActive: { color: '#FFFFFF', fontWeight: '900' },
  notificationPanelCount: { color: roleTheme.customer.accent, fontSize: 11, fontWeight: '900' },
  notificationPanelList: { maxHeight: 378 },
  notificationPanelRow: { minHeight: 72, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E4ECF5' },
  notificationPanelRowUnread: { backgroundColor: '#F2F7FF' },
  notificationPanelRowPressed: { opacity: 0.72, transform: [{ scale: 0.995 }] },
  notificationPanelRowLast: { borderBottomWidth: 0 },
  notificationTypeIcon: { width: 26, height: 26, borderRadius: 8, backgroundColor: '#F3F6FA', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', marginTop: 1, flexShrink: 0 },
  notificationTypeIconClaim: { backgroundColor: '#EEF4FF' },
  notificationTypeIconPolicy: { backgroundColor: '#FFF7E8' },
  notificationTypeIconVehicle: { backgroundColor: '#ECF9F5' },
  notificationPanelCopy: { flex: 1, minWidth: 0 },
  notificationPanelTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  notificationPanelRowTitle: { flex: 1, minWidth: 0, color: palette.ink, fontSize: 13, lineHeight: 17, fontWeight: '700' },
  notificationPanelRowTitleUnread: { fontWeight: '900' },
  notificationPanelTime: { color: palette.slate, fontSize: 10, lineHeight: 16, fontWeight: '700' },
  notificationPanelMessage: { color: palette.slate, fontSize: 11.5, lineHeight: 16, fontWeight: '600', marginTop: 3 },
  notificationPanelUnreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#276EF1' },
  notificationPanelState: { minHeight: 86, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  notificationPanelStateText: { color: palette.slate, fontSize: 12.5, fontWeight: '700', textAlign: 'center' },
  notificationSkeletonWrap: { paddingVertical: 4 },
  notificationSkeletonRow: { minHeight: 72, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E9EFF6' },
  notificationSkeletonDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D5E0EC' },
  notificationSkeletonCopy: { flex: 1, gap: 8 },
  notificationSkeletonTitle: { height: 11, width: '62%', borderRadius: 6, backgroundColor: '#E8EEF5' },
  notificationSkeletonMessage: { height: 9, width: '88%', borderRadius: 5, backgroundColor: '#F0F4F8' },
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
