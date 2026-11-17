import type { AlertButton, AlertOptions } from 'react-native';

/** Shared in-app replacement for React Native Alert.alert.
 * Preserves existing action handlers and button order while rendering
 * identical feedback on iOS, Android and Expo web.
 */
export type PartnerAlertRequest = {
  id: number;
  title: string;
  message: string;
  buttons: AlertButton[];
  options?: AlertOptions;
};
let nextId = 0;
const queue: PartnerAlertRequest[] = [];
let receiver: ((alert: PartnerAlertRequest) => void) | null = null;
let active = false;

function flush() {
  if (receiver && !active && queue.length > 0) { active = true; receiver(queue.shift()!); }
}
export function connectPartnerAlerts(callback: (alert: PartnerAlertRequest) => void) {
  receiver = callback;
  flush();
  return () => { if (receiver === callback) receiver = null; };
}
export function nextPartnerAlert() { active = false; flush(); }
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
    const normalizedButtons = buttons?.length ? buttons : [{ text: 'OK' }];
    queue.push({ id: ++nextId, title, message: message ?? '', buttons: normalizedButtons, options });
    flush();
  },
};
