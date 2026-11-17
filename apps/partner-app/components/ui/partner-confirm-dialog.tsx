import { PartnerFeedbackDialog } from '@/components/ui/partner-feedback-dialog';

/** Confirmation flows share the same reference popup as errors, success and alerts.
 * Existing button callbacks and destructive/busy behavior remain unchanged.
 */
export function PartnerConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return <PartnerFeedbackDialog
    visible={visible}
    type={destructive ? 'delete' : 'confirm'}
    title={title}
    message={message}
    busy={busy}
    onDismiss={onCancel}
    actions={[
      { label: cancelLabel, onPress: onCancel, kind: 'secondary' },
      { label: confirmLabel, onPress: onConfirm, kind: destructive ? 'destructive' : 'primary' },
    ]}
  />;
}
