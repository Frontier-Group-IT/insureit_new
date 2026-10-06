import { Image, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { partnerTheme } from '@/lib/theme';

export function PartnerProfileAvatar({
  name,
  uri,
  size = 36,
  backgroundColor = partnerTheme.colors.surface,
  textColor = partnerTheme.colors.brandStrong,
  style,
  textStyle,
}: {
  name: string;
  uri?: string | null;
  size?: number;
  backgroundColor?: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const radius = size / 2;

  return (
    <View
      accessibilityLabel={`${name || 'Partner'} profile photo`}
      style={[styles.base, { width: size, height: size, borderRadius: radius, backgroundColor }, style]}
    >
      {uri ? (
        <Image source={{ uri }} style={styles.image} resizeMode="cover" />
      ) : (
        <Text style={[styles.text, { color: textColor, fontSize: Math.max(10, Math.round(size * 0.32)) }, textStyle]}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'IP';
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  text: {
    fontWeight: '800',
  },
});
