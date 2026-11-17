import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { connectPartnerAlerts, nextPartnerAlert, type PartnerAlertRequest } from '@/lib/partner-alert';

export type PartnerFeedbackType = 'error' | 'success' | 'warning' | 'confirm' | 'delete' | 'info';
type Action = { label: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'destructive'; busy?: boolean };
const NAVY = '#19395D';

export function getPartnerFeedbackType(title: string, labels: string[] = []): PartnerFeedbackType {
  const t = title.toLowerCase();
  if (/delete|remove|discard|revoke|reject|permanent/.test(t) || labels.some(x => /^(delete|remove|discard|reject)$/i.test(x))) return 'delete';
  if (/saved|success|created|completed|approved|submitted|sent|verified|booked|updated/.test(t)) return 'success';
  if (/unable|failed|error|invalid|denied|unavailable|missing|not saved|could not/.test(t)) return 'error';
  if (/check|warning|required|attention|verify|issue|pending/.test(t)) return 'warning';
  if (labels.length > 1) return 'confirm';
  return 'info';
}

export function PartnerFeedbackDialog({
  visible, type = 'info', title, message, actions, busy = false, onDismiss,
}: {
  visible: boolean;
  type?: PartnerFeedbackType;
  title: string;
  message: string;
  actions: Action[];
  busy?: boolean;
  onDismiss?: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { if (!visible) setSubmitting(false); }, [visible]);
  const isBusy = busy || submitting;
  const icon: ComponentProps<typeof Ionicons>['name'] = type === 'success' ? 'checkmark-circle-outline' :
    type === 'delete' ? 'trash-outline' :
    type === 'error' ? 'close-circle-outline' :
    type === 'info' ? 'information-circle-outline' : 'alert-circle-outline';
  const iconColor = type === 'success' ? '#16865C' : type === 'delete' || type === 'error' ? '#C83C45' : '#E68A41';
  const iconBg = type === 'success' ? '#E7F6EF' : type === 'delete' || type === 'error' ? '#FCEAED' : '#FFF0E7';
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={() => { if (!isBusy) onDismiss?.(); }}
    statusBarTranslucent>
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} disabled={!onDismiss || isBusy} onPress={onDismiss}
        accessibilityLabel="Dismiss popup" accessibilityRole="button"/>
      <View style={styles.card} accessibilityViewIsModal accessibilityRole="alert" accessible
        accessibilityLabel={title} accessibilityHint={message}>
        <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={28} color={iconColor}/>
        </View>
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <View style={styles.divider}/>
        <View style={[styles.actions, actions.length > 2 && styles.actionStack]}>
          {actions.map((action, index) => <Pressable
            key={index}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            accessibilityState={{ disabled: isBusy, busy: isBusy }}
            disabled={isBusy}
            onPress={() => {
              if (isBusy) return;
              setSubmitting(true);
              try { action.onPress(); } finally { setSubmitting(false); }
            }}
            style={({ pressed }) => [
              styles.button,
              action.kind === 'secondary' ? styles.secondaryButton : action.kind === 'destructive' ? styles.deleteButton : styles.primaryButton,
              pressed && styles.pressed,
              actions.length === 1 && styles.fullWidthButton,
            ]}>
            {action.busy ? <ActivityIndicator size="small" color={action.kind === 'secondary' ? NAVY : '#FFFFFF'}/> :
              <Text style={[styles.buttonText, action.kind === 'secondary' && styles.secondaryText]} numberOfLines={2}>{action.label}</Text>}
          </Pressable>)}
        </View>
      </View>
    </View>
  </Modal>;
}

/** Single top-level host handles legacy Alert.alert calls without native OS alerts. */
export function PartnerAlertHost() {
  const [current, setCurrent] = useState<PartnerAlertRequest | null>(null);
  const currentRef = useRef<PartnerAlertRequest | null>(null);
  useEffect(() => {
    return connectPartnerAlerts(request => {
      // Keep multiple simultaneous alerts in FIFO order, without dropping any.
      currentRef.current = request;
      setCurrent(request);
    });
  }, []);
  const close = (button?: PartnerAlertRequest['buttons'][number]) => {
    if (!currentRef.current) return;
    const done = currentRef.current;
    currentRef.current = null;
    setCurrent(null);
    done.options?.onDismiss?.();
    button?.onPress?.();
    // Defer the next queued alert until the existing modal has dismissed.
    // React's next event loop tick is enough for this state transition.
    Promise.resolve().then(nextPartnerAlert);
  };
  const buttons = current?.buttons ?? [];
  const cancel = buttons.find(b => b.style === 'cancel');
  const mapped = buttons.length <= 1
    ? [{ label: buttons[0]?.text || 'OK', onPress: () => close(buttons[0]), kind: 'primary' as const }]
    : [...(cancel ? [cancel] : []), ...buttons.filter(b => b !== cancel)].map((button, index) => ({
      label: button.text || (index === 0 ? 'Cancel' : 'OK'),
      onPress: () => close(button),
      kind: (button.style === 'destructive' ? 'destructive' : button.style === 'cancel' ? 'secondary' : 'primary') as 'primary' | 'secondary' | 'destructive',
    }));
  return <PartnerFeedbackDialog visible={!!current} title={current?.title ?? ''} message={current?.message ?? ''}
    type={getPartnerFeedbackType(current?.title ?? '', buttons.map(b => b.text ?? ''))}
    actions={mapped}
    onDismiss={current?.options?.cancelable ? () => close(cancel) : undefined}/>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(12, 30, 57, 0.53)' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, width: '100%', maxWidth: 430, alignItems: 'center', overflow: 'hidden', paddingTop: 24 },
  iconCircle: { height: 56, width: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: NAVY, textAlign: 'center', marginTop: 18, paddingHorizontal: 20 },
  message: { fontSize: 13, lineHeight: 20, color: '#748399', textAlign: 'center', marginTop: 12, marginBottom: 22, paddingHorizontal: 25 },
  divider: { height: 1, backgroundColor: '#E7EBF1', alignSelf: 'stretch', marginTop: 18 },
  actions: { alignSelf: 'stretch', flexDirection: 'row', paddingHorizontal: 18, paddingVertical: 14, gap: 10 },
  actionStack: { flexDirection: 'column' },
  button: { flex: 1, minHeight: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9 },
  fullWidthButton: { flex: 1 },
  primaryButton: { backgroundColor: NAVY },
  secondaryButton: { backgroundColor: '#FFFFFF', borderColor: '#CBD6E4', borderWidth: 1 },
  deleteButton: { backgroundColor: '#C83C45' },
  buttonText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '700', textAlign: 'center' },
  secondaryText: { color: NAVY },
  pressed: { opacity: 0.82 },
});
