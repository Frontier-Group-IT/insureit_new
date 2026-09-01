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
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: 'transparent',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: partnerTheme.colors.line,
  },
  item: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingHorizontal: 7,
    paddingVertical: 7,
  },
  itemBorder: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: partnerTheme.colors.line,
  },
  value: {
    color: partnerTheme.colors.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '600',
  },
  label: {
    marginTop: 2,
    color: partnerTheme.colors.inkMuted,
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '500',
  },
  warning: { color: partnerTheme.colors.warning },
  danger: { color: partnerTheme.colors.danger },
  success: { color: partnerTheme.colors.success },
});
