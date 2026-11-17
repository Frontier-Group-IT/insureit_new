import { useEffect, useState, type ReactNode } from 'react';

import { PartnerConfirmDialog, type PartnerDialogAction, type PartnerDialogKind } from '@/components/ui/partner-confirm-dialog';

type AlertChoice = {
  text?: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: (value?: string) => void;
  isPreferred?: boolean;
};
type AlertOptions = { cancelable?: boolean; onDismiss?: () => void };
type Notice = { title: string; message: string; buttons?: AlertChoice[]; options?: AlertOptions };

const pending: Notice[] = [];
let notify: (() => void) | null = null;
let activeNotice: Notice | null = null;

/**
 * A UI-only replacement for React Native Alert.alert.
 * Retains button order, callbacks and the native default of no backdrop dismiss.
 * This cannot turn OTP, selector or text-input modals into notifications.
 */
export function partnerAlert(title: string, message?: string, buttons?: AlertChoice[], options?: AlertOptions): void {
  const notice: Notice = { title, message: message ?? '', buttons, options };
  // Keep rapid duplicate notifications from obscuring important confirmations.
  if ((activeNotice?.title === notice.title && activeNotice.message === notice.message) ||
      pending.some(item => item.title === notice.title && item.message === notice.message)) return;
  pending.push(notice);
  notify?.();
}

function noticeKind(notice: Notice): PartnerDialogKind {
  const title = notice.title.toLowerCase();
  if (notice.buttons?.some(button => button.style === 'destructive')) return 'delete';
  if (/delete|discard|remove|revoke/.test(title)) return 'delete';
  if (/saved|created|uploaded|booked|success|approved|completed/.test(title)) return 'success';
  if (/unable|failed|error|invalid|unavailable|could not/.test(title)) return 'error';
  if (/warning|verify|check|missing|required|action required/.test(title)) return 'warning';
  return notice.buttons && notice.buttons.length > 1 ? 'confirm' : 'info';
}

/** One presenter at app root serves every Partner screen, including nested components. */
export function PartnerAlertProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  useEffect(() => {
    const flush = () => setNotice(current => current ?? pending.shift() ?? null);
    notify = flush;
    flush();
    return () => { if (notify === flush) notify = null; };
  }, []);
  useEffect(() => {
    activeNotice = notice;
    if (!notice && pending.length) notify?.();
    return () => { if (activeNotice === notice) activeNotice = null; };
  }, [notice]);
  const close = () => {
    setNotice(null);
    notice?.options?.onDismiss?.();
  };
  const choices: PartnerDialogAction[] = (notice?.buttons?.length
    ? notice.buttons.map((choice, index) => ({
      label: choice.text ?? (index === 0 ? 'OK' : 'Confirm'),
      secondary: choice.style === 'cancel',
      destructive: choice.style === 'destructive',
      onPress: () => {
        setNotice(null);
        choice.onPress?.();
      },
    }))
    : [{ label: 'OK', onPress: close }]);
  return (
    <>
      {children}
      <PartnerConfirmDialog
        visible={Boolean(notice)}
        title={notice?.title ?? ''}
        message={notice?.message ?? ''}
        kind={notice ? noticeKind(notice) : 'info'}
        actions={choices}
        onCancel={close}
        dismissible={notice?.options?.cancelable === true}
      />
    </>
  );
}
