import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { PartnerButton } from '@/components/ui/partner-button';
import { partnerTheme } from '@/lib/theme';

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
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close dialog" onPress={onCancel} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={styles.dialog}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <View style={styles.action}>
              <PartnerButton label={cancelLabel} onPress={onCancel} variant="secondary" />
            </View>
            <View style={styles.action}>
              <PartnerButton label={confirmLabel} onPress={onConfirm} variant={destructive ? 'danger' : 'primary'} loading={busy} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(17, 24, 39, 0.48)',
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    borderRadius: partnerTheme.radius.xl,
    padding: 20,
    backgroundColor: partnerTheme.colors.surface,
  },
  title: { color: partnerTheme.colors.ink, ...partnerTheme.typography.sectionTitle },
  message: { marginTop: 8, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.body },
  actions: { marginTop: 20, flexDirection: 'row', gap: 10 },
  action: { flex: 1 },
});
