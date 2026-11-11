import type { ComponentProps, ReactNode } from 'react';
import { Image, type ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { resolvePartnerScreenArtwork } from '@/lib/partner-screen-artwork';
import { partnerTheme } from '@/lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function PartnerTopBar({
  title,
  eyebrow,
  subtitle,
  onBack,
  backDisabled = false,
  artwork,
  action,
  actionIcon,
  actionLabel = 'Action',
  onAction,
  showArtwork = true,
  iconName,
  navy = false,
  edgeToEdge = false,
}: {
  title: string;
  navy?: boolean;
  /** A full-width screen has no parent gutter to counteract. */
  edgeToEdge?: boolean;
  eyebrow?: string;
  subtitle?: string;
  onBack?: () => void;
  backDisabled?: boolean;
  artwork?: ImageSourcePropType;
  action?: ReactNode;
  actionIcon?: IconName;
  actionLabel?: string;
  onAction?: () => void;
  showArtwork?: boolean;
  iconName?: IconName;
}) {
  const resolvedArtwork = showArtwork && !iconName ? (artwork ?? resolvePartnerScreenArtwork({ title, eyebrow })) : undefined;

  return (
    <View style={[styles.root, navy && styles.navyRoot, edgeToEdge && styles.edgeToEdge]}>
      {onBack ? (
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          accessibilityState={{ disabled: backDisabled }}
          disabled={backDisabled}
          hitSlop={4}
          onPress={onBack}
          style={({ pressed }) => [styles.iconButton, backDisabled && styles.disabled, pressed && !backDisabled && styles.pressed]}
        >
          <Ionicons name="arrow-back" size={20} color={navy ? "#FFFFFF" : backDisabled ? partnerTheme.colors.inkSubtle : partnerTheme.colors.ink} />
        </Pressable>
      ) : null}

      {iconName ? (
        <View style={styles.plainIconWrap}>
          <Ionicons name={iconName} size={27} color={navy ? '#FFFFFF' : '#17365D'} />
        </View>
      ) : null}
      {resolvedArtwork ? (
        <View style={styles.artworkWrap}>
          <Image source={resolvedArtwork} style={styles.artwork} resizeMode="contain" />
        </View>
      ) : null}

      <View style={styles.copy}>
        {eyebrow ? <Text numberOfLines={1} style={[styles.eyebrow, navy && styles.navyText]}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" numberOfLines={1} style={[styles.title, navy && styles.navyText]}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={[styles.subtitle, navy && styles.navyText]}>{subtitle}</Text> : null}
      </View>

      {action ? <View style={styles.action}>{action}</View> : null}
      {!action && actionIcon && onAction ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          hitSlop={4}
          onPress={onAction}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Ionicons name={actionIcon} size={20} color={navy ? "#FFFFFF" : partnerTheme.colors.ink} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: partnerTheme.spacing.sm,
  },
  navyRoot: { backgroundColor: '#071E49', marginHorizontal: -partnerTheme.spacing.lg, paddingHorizontal: partnerTheme.spacing.lg },
  navyText: { color: '#FFFFFF' },
  edgeToEdge: { marginHorizontal: 0, paddingHorizontal: partnerTheme.spacing.lg },
  plainIconWrap: { width: 38, alignItems: 'center', justifyContent: 'center' },
  artworkWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artwork: {
    width: 38,
    height: 38,
  },
  copy: { flex: 1, minWidth: 0 },
  eyebrow: {
    marginBottom: 1,
    color: partnerTheme.colors.brand,
    letterSpacing: 1.15,
    ...partnerTheme.typography.eyebrow,
  },
  title: {
    color: partnerTheme.colors.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    marginTop: 1,
    color: partnerTheme.colors.inkMuted,
    ...partnerTheme.typography.caption,
  },
  iconButton: {
    width: partnerTheme.control.minTouchTarget,
    height: partnerTheme.control.minTouchTarget,
    borderRadius: partnerTheme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: {
    minWidth: partnerTheme.control.minTouchTarget,
    minHeight: partnerTheme.control.minTouchTarget,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: partnerTheme.colors.pressed },
  disabled: { opacity: 0.45 },
});