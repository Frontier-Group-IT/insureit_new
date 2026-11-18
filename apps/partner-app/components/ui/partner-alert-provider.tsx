import { useEffect, useState, type ReactNode } from 'react';

import { PartnerConfirmDialog, type PartnerDialogAction, type PartnerDialogKind } from '@/components/ui/partner-confirm-dialog';

type AlertChoice = {
  text?: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: (value?: string) => void;
  isPreferred?: boolean;
  singleLineNormalLabel?: boolean;
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
  if (/unable|failed|error|invalid|unavailable|could not/.test(title)) return 'error';
  if (/saved|created|uploaded|booked|success|approved|completed|updated|submitted|sent|added|verified|issued|deleted|removed/.test(title)) return 'success';
  if (/delete|discard|remove|revoke/.test(title)) return 'delete';
  if (/warning|verify|check|missing|required|action required/.test(title)) return 'warning';
  return notice.buttons && notice.buttons.length > 1 ? 'confirm' : 'info';
}

/**
 * Passive success notifications do not require an acknowledgement.
 * Explicit navigation/continuation actions remain manual so a timer never skips a choice.
 */
function isPassiveSuccessNotice(notice: Notice): boolean {
  if (noticeKind(notice) !== 'success') return false;
  if (!notice.buttons?.length) return true;
  return notice.buttons.length === 1 &&
    !notice.buttons[0].onPress &&
    !notice.buttons[0].style &&
    (notice.buttons[0].text ?? 'OK').trim().toLowerCase() === 'ok';
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
  // Only passive successes auto-close; cleanup prevents stale timers from closing a newer alert.
  useEffect(() => {
    if (!notice || !isPassiveSuccessNotice(notice)) return;
    const timeout = setTimeout(() => {
      setNotice(current => current === notice ? null : current);
      notice.options?.onDismiss?.();
    }, 1000);
    return () => clearTimeout(timeout);
  }, [notice]);
  const close = () => {
    setNotice(null);
    notice?.options?.onDismiss?.();
  };
  const autoDismissSuccess = Boolean(notice && isPassiveSuccessNotice(notice));
  const choices: PartnerDialogAction[] = (notice?.buttons?.length
    ? notice.buttons.map((choice, index) => ({
      label: choice.text ?? (index === 0 ? 'OK' : 'Confirm'),
      secondary: choice.style === 'cancel',
      singleLineNormalLabel: choice.singleLineNormalLabel,
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
        actions={autoDismissSuccess ? [] : choices}
        onCancel={close}
        dismissible={notice?.options?.cancelable === true}
      />
    </>
  );
}
