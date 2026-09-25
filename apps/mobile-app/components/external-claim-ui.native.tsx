import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { SELF_MANAGED_MILESTONES, type ClaimMilestoneKey } from '@/lib/claim-service-mode';
import { getInsurerLogoSource, getVehicleBrandLogoSource } from '@/lib/catalog-logos';
import { supabase } from '@/lib/supabase';

const sharedUi = require('./external-claim-ui.tsx') as Record<string, any>;

export const ClaimProgressStrip = sharedUi.ClaimProgressStrip;
export const ClaimStageSummaryCard = sharedUi.ClaimStageSummaryCard;
export const ClaimContextStrip = sharedUi.ClaimContextStrip;
export const ClaimFormSection = sharedUi.ClaimFormSection;
export const ClaimChoice = sharedUi.ClaimChoice;
export const ClaimInlineNote = sharedUi.ClaimInlineNote;
export const ClaimFinancialSummary = sharedUi.ClaimFinancialSummary;
export const ClaimPrimaryAction = sharedUi.ClaimPrimaryAction;
export const ClaimSecondaryAction = sharedUi.ClaimSecondaryAction;
export const ClaimMetaRow = sharedUi.ClaimMetaRow;

type ClaimIdentityCardProps = {
  claimNo?: string | null;
  insurerName?: string | null;
  vehicleNo?: string | null;
  policyNo?: string | null;
  vehicleMeta?: string | null;
};

type ClaimActionBarProps = {
  primaryLabel: string;
  primaryIcon?: keyof typeof MaterialCommunityIcons.glyphMap;
  primaryDisabled?: boolean;
  onPrimary: () => void;
  onAssistance: () => void;
};

type StageProgressRecord = {
  milestone_key: ClaimMilestoneKey;
  milestone_status: string;
};

function isSelfManagedStagePath(pathname: string) {
  return pathname === '/customer/self-managed-claim'
    || pathname === '/customer/self-managed-spot-status'
    || pathname === '/customer/self-managed-milestone';
}

function stageIndexFor(pathname: string, milestoneKey: ClaimMilestoneKey | null) {
  if (pathname === '/customer/self-managed-claim') return 0;
  if (pathname === '/customer/self-managed-spot-status') return 1;
  if (pathname === '/customer/self-managed-milestone' && milestoneKey) {
    return SELF_MANAGED_MILESTONES.findIndex((item) => item.key === milestoneKey);
  }
  return -1;
}

export function ExternalClaimStageHeader(props: Record<string, unknown>) {
  const pathname = usePathname();
  if (isSelfManagedStagePath(pathname)) return null;
  const SharedExternalClaimStageHeader = sharedUi.ExternalClaimStageHeader;
  return <SharedExternalClaimStageHeader {...props} />;
}

export function ClaimIdentityCard(props: ClaimIdentityCardProps) {
  const pathname = usePathname();
  const params = useLocalSearchParams<{ key?: string }>();
  const milestoneKey = typeof params.key === 'string' ? params.key as ClaimMilestoneKey : null;

  if (!isSelfManagedStagePath(pathname)) {
    const SharedClaimIdentityCard = sharedUi.ClaimIdentityCard;
    return <SharedClaimIdentityCard {...props} />;
  }

  const currentIndex = stageIndexFor(pathname, milestoneKey);
  const stage = SELF_MANAGED_MILESTONES[currentIndex] ?? SELF_MANAGED_MILESTONES[0];
  const { claimNo, insurerName, vehicleNo, policyNo, vehicleMeta } = props;
  const vehicleMake = vehicleMeta?.split('·')[0]?.trim() || '';
  const vehicleLogo = getVehicleBrandLogoSource(vehicleMake);
  const insurerLogo = getInsurerLogoSource(insurerName);

  return (
    <View style={styles.card}>
      <View style={styles.glowLarge} />
      <View style={styles.glowSmall} />

      <View style={styles.headerRow}>
        <View style={styles.stageBadge}>
          <Image source={require('../assets/claims/claim-intimation.png')} style={styles.stageArtwork} resizeMode="contain" />
        </View>
        <Text style={styles.headerTitle} numberOfLines={1}>{stage.label}</Text>
        <Text style={styles.claimNoValue} numberOfLines={1}>{claimNo || 'New claim'}</Text>
      </View>

      <View style={styles.headerDivider} />

      <View style={styles.infoGrid}>
        <View style={styles.infoSection}>
          <View style={styles.logoTile}>
            <Image source={vehicleLogo || require('../assets/claims/fleet-vehicle.png')} style={vehicleLogo ? styles.brandLogo : styles.fallbackArtwork} resizeMode="contain" />
          </View>
          <View style={styles.infoCopy}>
            <Text style={styles.primaryValue} numberOfLines={1}>{vehicleNo || 'Vehicle'}</Text>
            <Text accessibilityLabel={`Make and model: ${vehicleMeta || 'Not available'}`} style={styles.secondaryValue} numberOfLines={1}>{vehicleMeta || '—'}</Text>
          </View>
        </View>

        <View style={styles.sectionDivider} />

        <View style={styles.infoSection}>
          <View style={styles.logoTile}>
            <Image source={insurerLogo || require('../assets/claims/policy.png')} style={insurerLogo ? styles.brandLogo : styles.fallbackArtwork} resizeMode="contain" />
          </View>
          <View style={styles.infoCopy}>
            <Text style={styles.primaryValue} numberOfLines={1}>{policyNo || '—'}</Text>
            <Text accessibilityLabel={`Insurance company: ${insurerName || 'Not available'}`} style={styles.secondaryValue} numberOfLines={2}>{insurerName || 'Insurance company'}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export function ClaimActionBar({ primaryLabel, primaryIcon = 'arrow-right', primaryDisabled, onPrimary, onAssistance }: ClaimActionBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<{ id?: string; key?: string }>();
  const claimId = typeof params.id === 'string' ? params.id : '';
  const milestoneKey = typeof params.key === 'string' ? params.key as ClaimMilestoneKey : null;
  const currentIndex = useMemo(() => stageIndexFor(pathname, milestoneKey), [milestoneKey, pathname]);
  const [progress, setProgress] = useState<StageProgressRecord[]>([]);
  void onAssistance;

  useEffect(() => {
    if (!isSelfManagedStagePath(pathname) || !claimId) {
      setProgress([]);
      return;
    }
    let active = true;
    void (async () => {
      const { data } = await (supabase as any)
        .from('claim_milestones')
        .select('milestone_key,milestone_status')
        .eq('claim_id', claimId);
      if (active) setProgress((data ?? []) as StageProgressRecord[]);
    })();
    return () => { active = false; };
  }, [claimId, pathname]);

  if (!isSelfManagedStagePath(pathname) || currentIndex < 0) {
    const SharedClaimActionBar = sharedUi.ClaimActionBar;
    return <SharedClaimActionBar primaryLabel={primaryLabel} primaryIcon={primaryIcon} primaryDisabled={primaryDisabled} onPrimary={onPrimary} onAssistance={onAssistance} />;
  }

  const completedKeys = new Set(
    progress
      .filter((item) => item.milestone_status === 'completed' || item.milestone_status === 'not_applicable')
      .map((item) => item.milestone_key),
  );
  const previousEnabled = Boolean(claimId) && currentIndex > 0;

  function openPrevious() {
    if (!previousEnabled) return;
    const previous = SELF_MANAGED_MILESTONES[currentIndex - 1];
    if (!previous) return;
    if (previous.key === 'spot_intimation') {
      router.push({ pathname: '/customer/self-managed-claim', params: { id: claimId } });
      return;
    }
    if (previous.key === 'spot_status') {
      router.push({ pathname: '/customer/self-managed-spot-status', params: { id: claimId } });
      return;
    }
    router.push({ pathname: '/customer/self-managed-milestone', params: { id: claimId, key: previous.key } });
  }

  return (
    <View style={styles.actionSection}>
      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous claim stage"
          accessibilityState={{ disabled: !previousEnabled }}
          disabled={!previousEnabled}
          onPress={openPrevious}
          style={[styles.previousButton, !previousEnabled && styles.buttonDisabled]}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color={previousEnabled ? '#0A43A3' : '#AEB9C8'} />
          <Text style={[styles.previousText, !previousEnabled && styles.disabledText]}>Previous</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: Boolean(primaryDisabled) }}
          disabled={primaryDisabled}
          onPress={onPrimary}
          style={[styles.primaryButton, primaryDisabled && styles.buttonDisabled]}
        >
          <Text style={styles.primaryText}>{primaryLabel}</Text>
          <MaterialCommunityIcons name={primaryIcon} size={21} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={styles.bottomDots} accessibilityLabel={`Claim progress step ${currentIndex + 1} of ${SELF_MANAGED_MILESTONES.length}`}>
        {SELF_MANAGED_MILESTONES.map((item, index) => {
          const completed = completedKeys.has(item.key);
          const current = index === currentIndex;
          return <View key={item.key} style={[styles.dot, completed && styles.dotCompleted, current && styles.dotCurrent]} />;
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    borderRadius: 15,
    backgroundColor: '#073A86',
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: 8,
    marginBottom: 10,
    shadowColor: '#062D70',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  glowLarge: { position: 'absolute', width: 135, height: 135, borderRadius: 68, backgroundColor: '#0C58C8', right: -72, top: -79, opacity: 0.22 },
  glowSmall: { position: 'absolute', width: 84, height: 84, borderRadius: 42, borderWidth: 1, borderColor: 'rgba(120,169,255,0.14)', right: -8, top: -48 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 25 },
  stageBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#0B51BE', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stageArtwork: { width: 17, height: 17 },
  headerTitle: { flex: 1, minWidth: 0, color: '#FFFFFF', fontSize: 12.5, lineHeight: 16, fontWeight: '900' },
  claimNoValue: { maxWidth: '36%', color: '#FFFFFF', fontSize: 10.5, lineHeight: 13, fontWeight: '900', textAlign: 'right', letterSpacing: 0.1 },
  headerDivider: { height: 1, backgroundColor: 'rgba(174,204,255,0.22)', marginTop: 5, marginBottom: 6 },
  infoGrid: { flexDirection: 'row', alignItems: 'stretch', minWidth: 0, minHeight: 48 },
  infoSection: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 2 },
  sectionDivider: { width: 1, backgroundColor: 'rgba(174,204,255,0.16)', marginHorizontal: 6, marginVertical: 1 },
  logoTile: { width: 38, height: 38, borderRadius: 8, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  brandLogo: { width: 30, height: 30 },
  fallbackArtwork: { width: 25, height: 25 },
  infoCopy: { flex: 1, minWidth: 0, justifyContent: 'center' },
  primaryValue: { color: '#FFFFFF', fontSize: 10.2, lineHeight: 13, fontWeight: '900' },
  secondaryValue: { color: '#EAF2FF', fontSize: 8.2, lineHeight: 10.5, fontWeight: '700', marginTop: 2 },
  actionSection: { marginTop: 0, marginBottom: 6 },
  actionRow: { flexDirection: 'row', alignItems: 'stretch', gap: 9 },
  previousButton: { flex: 1, minHeight: 52, borderRadius: 15, borderWidth: 1, borderColor: '#AFC8EA', backgroundColor: '#F9FBFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 10 },
  previousText: { color: '#0A43A3', fontSize: 11, lineHeight: 14, fontWeight: '900' },
  primaryButton: { flex: 1, minHeight: 52, borderRadius: 15, backgroundColor: '#07327B', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 10, shadowColor: '#07327B', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  primaryText: { color: '#FFFFFF', fontSize: 12, lineHeight: 15, fontWeight: '900', textAlign: 'center', flexShrink: 1 },
  buttonDisabled: { opacity: 0.5 },
  disabledText: { color: '#AEB9C8' },
  bottomDots: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingTop: 9 },
  dot: { width: 8, height: 8, borderRadius: 999, borderWidth: 1, borderColor: '#D0D8E3', backgroundColor: '#EEF1F5' },
  dotCompleted: { borderColor: '#43A96C', backgroundColor: '#43A96C' },
  dotCurrent: { width: 11, height: 11, borderColor: '#0A43A3', backgroundColor: '#2D78E5' },
});
