import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { partnerTheme } from '@/lib/theme';

export function PartnerBottomActionBar({
  children,
  accessory,
}: {
  children: ReactNode;
  accessory?: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.shell, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
      <View style={styles.actions}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    paddingTop: 10,
    paddingHorizontal: 16,
    backgroundColor: partnerTheme.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: partnerTheme.colors.line,
  },
  accessory: {
    marginBottom: 8,
  },
  actions: {
    minHeight: partnerTheme.control.buttonHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
