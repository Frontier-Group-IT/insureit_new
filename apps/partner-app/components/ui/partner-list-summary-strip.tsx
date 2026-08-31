import { StyleSheet, Text, View } from 'react-native';

import { partnerTheme } from '@/lib/theme';

export type PartnerListSummaryItem = {
  key: string;
  label: string;
  value: string | number;
  tone?: 'default' | 'warning' | 'danger' | 'success';
};

export function PartnerListSummaryStrip({ items }: { items: PartnerListSummaryItem[] }) {
  return (
    <View style={styles.wrap}>
      {items.map((item, index) => (
        <View
          accessibilityLabel={`${item.label}. ${item.value}`}
          key={item.key}
          style={[styles.item, index < items.length - 1 && styles.itemBorder]}
        >
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={[
              styles.value,
              item.tone === 'warning' && styles.warning,
              item.tone === 'danger' && styles.danger,
              item.tone === 'success' && styles.success,
            ]}
          >
            {item.value}
          </Text>
          <Text numberOfLines={1} style={styles.label}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 15,
    backgroundColor: partnerTheme.colors.surface,
    overflow: 'hidden',
  },
  item: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  itemBorder: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: partnerTheme.colors.line,
  },
  value: {
    color: partnerTheme.colors.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
  },
  label: {
    marginTop: 3,
    color: partnerTheme.colors.inkMuted,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '500',
  },
  warning: { color: partnerTheme.colors.warning },
  danger: { color: partnerTheme.colors.danger },
  success: { color: partnerTheme.colors.success },
});
