import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PartnerButton } from '@/components/ui/partner-button';
import { partnerTheme } from '@/lib/theme';

export type PartnerDialogKind = 'info' | 'success' | 'error' | 'warning' | 'confirm' | 'delete';
export type PartnerDialogAction = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  secondary?: boolean;
};

const KIND_ICON: Record<PartnerDialogKind, keyof typeof Ionicons.glyphMap> = {
  info: 'information-circle-outline',
  success: 'checkmark-circle-outline',
  error: 'alert-circle-outline',
  warning: 'warning-outline',
  confirm: 'help-circle-outline',
  delete: 'trash-outline',
};

const KIND_COLOR: Record<PartnerDialogKind, string> = {
  info: '#28598E',
  success: '#13845E',
  error: '#B72E41',
  warning: '#A56A16',
  confirm: '#28598E',
  delete: '#B72E41',
};

/**
 * Shared Partner notification / confirmation surface.
 * Backwards-compatible with the original two-action confirm dialog.
 * Input forms, OTP, dates and selectors intentionally use their own modals.
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
  kind = destructive ? 'delete' : 'confirm',
  actions,
  dismissible = true,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm?: () => void;
  kind?: PartnerDialogKind;
  actions?: PartnerDialogAction[];
  dismissible?: boolean;
}) {
  const displayedActions: PartnerDialogAction[] = actions ?? [
    { label: cancelLabel, onPress: onCancel, secondary: true },
    { label: confirmLabel, onPress: onConfirm ?? onCancel, destructive },
  ];
  const dismiss = () => { if (!busy && dismissible) onCancel(); };
  const color = KIND_COLOR[kind];
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={dismiss} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss dialog"
          accessibilityHint="Dismisses this dialog without continuing"
          disabled={busy || !dismissible}
          onPress={dismiss}
          style={StyleSheet.absoluteFill}
        />
        <View accessible accessibilityRole="alert" accessibilityViewIsModal accessibilityLabel={title} accessibilityHint={message} style={styles.dialog}>
          <View style={[styles.iconCircle, { backgroundColor: color + '12' }]}>
            <Ionicons name={KIND_ICON[kind]} color={color} size={32} accessibilityLabel={kind} />
          </View>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          <ScrollView style={styles.messageScroll} contentContainerStyle={styles.messageWrap} showsVerticalScrollIndicator={false}>
            <Text style={styles.message}>{message}</Text>
          </ScrollView>
          <View style={styles.divider} />
          <View style={[styles.actions, displayedActions.length > 2 && styles.stackedActions]}>
            {displayedActions.map((action, index) => (
              <View style={[styles.action, displayedActions.length > 2 && styles.stackedAction]} key={index}>
                <PartnerButton
                  label={action.label}
                  onPress={action.onPress}
                  variant={action.destructive ? 'danger' : action.secondary ? 'secondary' : 'primary'}
                  loading={busy && index === displayedActions.length - 1}
                  disabled={busy}
                />
              </View>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20,
    backgroundColor: 'rgba(9, 24, 48, 0.55)',
  },
  dialog: {
    width: '100%', maxWidth: 400, maxHeight: '85%',
    borderRadius: 20, padding: 20, alignItems: 'center',
    backgroundColor: partnerTheme.colors.surface,
  },
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { color: partnerTheme.colors.ink, ...partnerTheme.typography.sectionTitle, textAlign: 'center' },
  messageScroll: { flexGrow: 0, alignSelf: 'stretch', maxHeight: 260 },
  messageWrap: { paddingTop: 10, paddingBottom: 3 },
  message: { color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.body, textAlign: 'center' },
  divider: { height: 1, backgroundColor: '#DCE5F1', marginTop: 18, marginBottom: 15, alignSelf: 'stretch' },
  actions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  stackedActions: { flexDirection: 'column' },
  action: { flex: 1 },
  stackedAction: { flex: 0, width: '100%' },
});
