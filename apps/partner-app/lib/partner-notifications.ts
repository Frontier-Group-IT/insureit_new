import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const PARTNER_CHANNEL_ID = 'partner-updates';
const ALLOWED_NOTIFICATION_PREFIXES = [
  '/(tabs)/claims',
  '/(tabs)/policies',
  '/renewals',
  '/customers',
  '/policy-intakes',
  '/policy-intake-new',
  '/claim/',
  '/policy/',
  '/customer/',
  '/activity',
  '/support',
] as const;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function configurePartnerNotificationChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(PARTNER_CHANNEL_ID, {
    name: 'INSUREIT Partner updates',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 180],
    lightColor: '#3156B8',
    sound: null,
  });
}

export async function getPartnerNotificationPermission() {
  try {
    const permissions = await Notifications.getPermissionsAsync();
    return permissions.status;
  } catch {
    return 'undetermined' as const;
  }
}

export async function requestPartnerNotificationPermission() {
  try {
    await configurePartnerNotificationChannel();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return { granted: true as const, status: current.status };
    const requested = await Notifications.requestPermissionsAsync();
    return { granted: requested.granted, status: requested.status };
  } catch {
    return { granted: false as const, status: 'undetermined' as const };
  }
}

export function normalizePartnerNotificationPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const path = value.trim();
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  return ALLOWED_NOTIFICATION_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix)) ? path : null;
}

function responsePath(response: Notifications.NotificationResponse | null | undefined) {
  return normalizePartnerNotificationPath(response?.notification.request.content.data?.url);
}

export async function getInitialPartnerNotificationPath() {
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    return responsePath(response);
  } catch {
    return null;
  }
}

export function observePartnerNotificationResponses(onPath: (path: string) => void) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const path = responsePath(response);
    if (path) onPath(path);
  });
}
