import { StyleSheet, View } from 'react-native';

import { partnerTheme } from '@/lib/theme';

export function PartnerDivider({ inset = 0 }: { inset?: number }) {
  return <View style={[styles.divider, { marginLeft: inset }]} />;
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: partnerTheme.colors.line,
  },
});
