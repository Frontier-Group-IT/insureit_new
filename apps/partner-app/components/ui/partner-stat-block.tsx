import { StyleSheet, Text, View } from 'react-native';

import { partnerTheme } from '@/lib/theme';

export function PartnerStatBlock({
  value,
  label,
  helper,
  align = 'left',
}: {
  value: string | number;
  label: string;
  helper?: string;
  align?: 'left' | 'center' | 'right';
}) {
  return (
    <View
      accessibilityLabel={[label, String(value), helper].filter(Boolean).join('. ')}
      style={[styles.root, align === 'center' && styles.center, align === 'right' && styles.right]}
    >
      <Text numberOfLines={1} style={[styles.value, align === 'center' && styles.textCenter, align === 'right' && styles.textRight]}>
        {value}
      </Text>
      <Text numberOfLines={1} style={[styles.label, align === 'center' && styles.textCenter, align === 'right' && styles.textRight]}>
        {label}
      </Text>
      {helper ? (
        <Text numberOfLines={1} style={[styles.helper, align === 'center' && styles.textCenter, align === 'right' && styles.textRight]}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minWidth: 0,
    gap: 1,
  },
  center: { alignItems: 'center' },
  right: { alignItems: 'flex-end' },
  value: {
    color: partnerTheme.colors.ink,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '800',
  },
  label: {
    color: partnerTheme.colors.inkMuted,
    ...partnerTheme.typography.caption,
  },
  helper: {
    color: partnerTheme.colors.inkMuted,
    ...partnerTheme.typography.meta,
  },
  textCenter: { textAlign: 'center' },
  textRight: { textAlign: 'right' },
});
