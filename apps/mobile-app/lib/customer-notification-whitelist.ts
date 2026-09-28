import type { Notification } from '@/lib/types';

export const CUSTOMER_NOTIFICATION_TITLES = [
  'Claim status updated',
  'Claim number updated',
  'Surveyor appointed',
  'Surveyor details updated',
  'Action required on claim document',
  'Claim document updated',
  'Survey completed',
  'Claim approved',
  'Repair update',
  'Billing updated',
  'Delivery order updated',
  'Vehicle ready for delivery',
  'Claim settlement updated',
  'Claim completed',
  'Policy renewal due',
  'Policy updated',
  'Vehicle updated',
] as const;

const APPROVED_CUSTOMER_NOTIFICATION_TITLES = new Set<string>(
  CUSTOMER_NOTIFICATION_TITLES.map(normalizeNotificationTitle),
);

export function isApprovedCustomerNotification(notification: Pick<Notification, 'title'>) {
  return APPROVED_CUSTOMER_NOTIFICATION_TITLES.has(normalizeNotificationTitle(notification.title));
}

export function approvedCustomerNotifications<T extends Pick<Notification, 'title'>>(notifications: T[]) {
  return notifications.filter(isApprovedCustomerNotification);
}

function normalizeNotificationTitle(value?: string | null) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}
