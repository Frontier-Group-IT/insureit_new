import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { PartnerBottomSheet } from '@/components/ui/partner-bottom-sheet';
import { PartnerButton } from '@/components/ui/partner-button';

export function PartnerFilterSheet({
  visible,
  title = 'Filters',
  onClose,
  onReset,
  onApply,
  applyLabel = 'Apply',
  resetLabel = 'Reset',
  applyDisabled = false,
  children,
}: PropsWithChildren<{
  visible: boolean;
  title?: string;
  onClose: () => void;
  onReset: () => void;
  onApply: () => void;
  applyLabel?: string;
  resetLabel?: string;
  applyDisabled?: boolean;
}>) {
  return (
    <PartnerBottomSheet
      footer={
        <View style={styles.footerActions}>
          <View style={styles.reset}>
            <PartnerButton
              fullWidth
              label={resetLabel}
              onPress={onReset}
              variant="ghost"
            />
          </View>
          <View style={styles.apply}>
            <PartnerButton
              disabled={applyDisabled}
              fullWidth
              label={applyLabel}
              onPress={onApply}
            />
          </View>
        </View>
      }
      onClose={onClose}
      title={title}
      visible={visible}
    >
      {children}
    </PartnerBottomSheet>
  );
}

const styles = StyleSheet.create({
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reset: { flex: 0.7 },
  apply: { flex: 1.3 },
});
