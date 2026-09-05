import type { ComponentProps } from 'react';
import { ActivityIndicator, Image, type ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { PartnerButton } from '@/components/ui/partner-button';
import { PartnerAssets } from '@/lib/partner-assets';
import { partnerTheme } from '@/lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function PartnerStateView({
  state,
  title,
  message,
  icon,
  asset,
  actionLabel,
  onAction,
}: {
  state: 'loading' | 'empty' | 'error' | 'offline' | 'unauthorized';
  title?: string;
  message?: string;
  icon?: IconName;
  asset?: ImageSourcePropType;
  actionLabel?: string;
  onAction?: () => void;
}) {
  if (state === 'loading') {
    return (
      <View style={styles.base} accessibilityRole="progressbar" accessibilityLabel={title || 'Loading'}>
        <ActivityIndicator color={partnerTheme.colors.brand} />
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    );
  }

  const resolvedAsset = asset ?? defaultAsset(state);
  const resolvedIcon = icon
    ?? (state === 'offline'
      ? 'cloud-offline-outline'
      : state === 'unauthorized'
        ? 'lock-closed-outline'
        : state === 'error'
          ? 'alert-circle-outline'
          : 'file-tray-outline');

  return (
    <View style={[styles.base, resolvedAsset ? styles.assetBase : null]} accessibilityLiveRegion="polite">
      {resolvedAsset ? (
        <View style={styles.assetTitleRow}>
          <View style={[styles.icon, styles.assetIcon]}>
            <Image source={resolvedAsset} style={styles.assetImage} resizeMode="contain" />
          </View>
          <Text style={[styles.title, styles.assetTitle]}>{title || defaultTitle(state)}</Text>
        </View>
      ) : (
        <>
          <View style={styles.icon}>
            <Ionicons name={resolvedIcon} size={26} color={state === 'error' ? partnerTheme.colors.danger : partnerTheme.colors.brand} />
          </View>
          <Text style={styles.title}>{title || defaultTitle(state)}</Text>
        </>
      )}
      {message ? <Text style={[styles.message, resolvedAsset ? styles.assetMessage : null]}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <PartnerButton label={actionLabel} onPress={onAction} variant="secondary" fullWidth={false} />
        </View>
      ) : null}
    </View>
  );
}

function defaultAsset(state: Exclude<Parameters<typeof PartnerStateView>[0]['state'], 'loading'>) {
  if (state === 'offline') return PartnerAssets.emptyStates.offline;
  if (state === 'error') return PartnerAssets.emptyStates.validationError;
  if (state === 'unauthorized') return PartnerAssets.emptyStates.incompleteDetails;
  return undefined;
}

function defaultTitle(state: Exclude<Parameters<typeof PartnerStateView>[0]['state'], 'loading'>) {
  if (state === 'offline') return 'You are offline';
  if (state === 'unauthorized') return 'Access unavailable';
  if (state === 'error') return 'Something went wrong';
  return 'Nothing here yet';
}

const styles = StyleSheet.create({
  base: {
    minHeight: 190,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: partnerTheme.radius.lg,
    padding: partnerTheme.spacing.xl,
    backgroundColor: partnerTheme.colors.surface,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
  },
  assetBase: { minHeight: 150, alignItems: 'stretch' },
  assetTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: partnerTheme.colors.surfaceMuted,
  },
  assetIcon: { backgroundColor: 'transparent' },
  assetImage: { width: 42, height: 42 },
  title: { marginTop: 12, color: partnerTheme.colors.ink, textAlign: 'center', ...partnerTheme.typography.cardTitle },
  assetTitle: { flexShrink: 1, marginTop: 0, textAlign: 'left' },
  message: { marginTop: 5, maxWidth: 300, color: partnerTheme.colors.inkMuted, textAlign: 'center', ...partnerTheme.typography.caption },
  assetMessage: { alignSelf: 'center' },
  action: { marginTop: 14 },
});