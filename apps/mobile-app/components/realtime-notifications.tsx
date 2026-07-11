import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Href, usePathname, useRouter } from 'expo-router';
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { getProfile, isValidProfile } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, palette, radii, roleTheme } from '@/lib/theme';
import type { Notification, Profile } from '@/lib/types';

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
  const { unreadCount } = useRealtimeNotifications();
  const href = pathname.startsWith('/customer') ? '/customer/notifications' : '/staff/notifications';
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(href)} style={styles.bellButton}>
      <MaterialCommunityIcons name={unreadCount > 0 ? 'bell-ring-outline' : 'bell-outline'} size={21} color={color} />
      {unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
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
