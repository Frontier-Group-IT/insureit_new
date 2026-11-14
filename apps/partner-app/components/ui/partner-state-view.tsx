import type { ComponentProps } from 'react';
import { Image, type ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
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
    return <PartnerSkeletonList title={title || 'Loading'} />;
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

/** Reusable skeleton for full-page and list loading. Status/error/empty states stay unchanged. */
export function PartnerSkeletonList({ title = 'Loading', rows = 6 }: { title?: string; rows?: number }) {
  return (
    <View style={styles.skeletonList} accessibilityRole="progressbar" accessibilityLabel={title}>
      {Array.from({ length: Math.max(1, Math.min(10, rows)) }, (_, index) => (
        <View key={index} style={styles.skeletonCard} importantForAccessibility="no-hide-descendants">
          <View style={styles.skeletonLogo} />
          <View style={styles.skeletonText}>
            <View style={styles.skeletonTitleLine} />
            <View style={styles.skeletonSubtitleLine} />
            <View style={styles.skeletonDetailLine} />
          </View>
          <View style={styles.skeletonBadge} />
        </View>
      ))}
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
  skeletonList: { width: '100%', gap: 8, paddingVertical: 8, paddingHorizontal: 3 },
  skeletonCard: { minHeight: 66, paddingHorizontal: 11, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E2E9F3', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 11 },
  skeletonLogo: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#EDEFF3' },
  skeletonText: { flex: 1, gap: 6 },
  skeletonTitleLine: { width: '64%', height: 8, borderRadius: 4, backgroundColor: '#EDEFF3' },
  skeletonSubtitleLine: { width: '83%', height: 7, borderRadius: 4, backgroundColor: '#F0F2F5' },
  skeletonDetailLine: { width: '53%', height: 7, borderRadius: 4, backgroundColor: '#F0F2F5' },
  skeletonBadge: { width: 48, height: 25, borderRadius: 8, backgroundColor: '#EDEFF3' },
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