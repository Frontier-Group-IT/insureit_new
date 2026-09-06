import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getCurrentSession } from '@/lib/partner-session';

const PARTNER_CHANNEL_ID = 'partner-updates';
const PARTNER_PROJECT_ID = '8ade82c1-4c96-4f09-b90b-802270fb406d';
const PARTNER_APP_VERSION = '0.2.0';
const portalUrl = (process.env.EXPO_PUBLIC_PORTAL_URL || 'https://portal.insureit.in').replace(/\/$/, '');
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

export async function registerPartnerPushDevice() {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return { registered: false as const, reason: 'unsupported' as const };
  }

  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return { registered: false as const, reason: 'permission' as const };

  const configuredProjectId = Constants.expoConfig?.extra?.eas?.projectId;
  const configuredVersion = Constants.expoConfig?.version;
  if (configuredProjectId !== PARTNER_PROJECT_ID || configuredVersion !== PARTNER_APP_VERSION) {
    return { registered: false as const, reason: 'build_identity' as const };
  }

  const pushToken = await Notifications.getExpoPushTokenAsync({ projectId: PARTNER_PROJECT_ID });
  await partnerPushDeviceRequest({
    action: 'register',
    expo_push_token: pushToken.data,
    platform: Platform.OS,
    project_id: PARTNER_PROJECT_ID,
    app_version: PARTNER_APP_VERSION,
  });

  return { registered: true as const };
}

export async function unregisterPartnerPushDevice() {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return;
    const configuredProjectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (configuredProjectId !== PARTNER_PROJECT_ID) return;
    const pushToken = await Notifications.getExpoPushTokenAsync({ projectId: PARTNER_PROJECT_ID });
    await partnerPushDeviceRequest({ action: 'unregister', expo_push_token: pushToken.data });
  } catch {
    // Sign-out must continue even when push cleanup is unavailable.
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

async function partnerPushDeviceRequest(body: Record<string, unknown>) {
  const session = await getCurrentSession();
  if (!session?.access_token) throw new Error('Your session has expired. Sign in again.');

  const response = await fetch(`${portalUrl}/api/partner/push-devices`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || 'Partner notification registration failed.');
  }
}
