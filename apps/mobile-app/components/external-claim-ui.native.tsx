import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SELF_MANAGED_MILESTONES, type ClaimMilestoneKey } from '@/lib/claim-service-mode';
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

const stageIcons: Array<keyof typeof MaterialCommunityIcons.glyphMap> = [
  'car-emergency',
  'clipboard-check-outline',
  'car-wrench',
  'clipboard-check-multiple-outline',
  'tools',
  'receipt-text-outline',
  'clipboard-plus-outline',
  'truck-check-outline',
  'cash-check',
];

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
  const icon = stageIcons[Math.max(0, currentIndex)] ?? stageIcons[0];
  const { claimNo, insurerName, vehicleNo, policyNo, vehicleMeta } = props;

  return (
    <View style={styles.card}>
      <View style={styles.glowLarge} />
      <View style={styles.glowSmall} />

      <View style={styles.headerRow}>
        <View style={[styles.iconBadge, styles.stageBadge]}>
          <MaterialCommunityIcons name={icon} size={16} color="#FFFFFF" />
        </View>
        <Text style={styles.headerTitle} numberOfLines={1}>{stage.label}</Text>
        <Text style={styles.claimNoValue} numberOfLines={1}>{claimNo || 'New claim'}</Text>
      </View>

      <View style={styles.headerDivider} />

      <View style={styles.infoGrid}>
        <View style={styles.infoSection}>
          <View style={styles.mainInfoRow}>
            <View style={[styles.iconBadge, styles.vehicleBadge]}>
              <MaterialCommunityIcons name="car-outline" size={16} color="#0A3A86" />
            </View>
            <Text style={styles.mainInfoLine} numberOfLines={1}>
              <Text style={styles.mainInfoLabel}>Vehicle: </Text>
              <Text style={styles.mainInfoValue}>{vehicleNo || 'Vehicle'}</Text>
            </Text>
          </View>

          <View style={styles.secondaryInfoRow}>
            <View style={[styles.iconBadge, styles.makeModelBadge]} accessible={false}>
              <MaterialCommunityIcons name="car-info" size={16} color="#2C6FD5" />
            </View>
            <Text accessibilityLabel={`Make and model: ${vehicleMeta || 'Not available'}`} style={styles.secondaryValue} numberOfLines={1}>{vehicleMeta || '—'}</Text>
          </View>
        </View>

        <View style={styles.sectionDivider} />

        <View style={styles.infoSection}>
          <View style={styles.mainInfoRow}>
            <View style={[styles.iconBadge, styles.policyBadge]}>
              <MaterialCommunityIcons name="file-document-outline" size={16} color="#0B7A57" />
            </View>
            <Text style={styles.mainInfoLine} numberOfLines={1}>
              <Text style={[styles.mainInfoLabel, styles.policyMainLabel]}>Policy: </Text>
              <Text style={styles.mainInfoValue}>{policyNo || '—'}</Text>
            </Text>
          </View>

          <View style={styles.secondaryInfoRow}>
            <View style={[styles.iconBadge, styles.insurerBadge]} accessible={false}>
              <MaterialCommunityIcons name="office-building-outline" size={16} color="#8A5A0A" />
            </View>
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
    borderRadius: 18,
    backgroundColor: '#062D70',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    marginBottom: 10,
    shadowColor: '#062D70',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  glowLarge: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#0C58C8', right: -95, top: -105, opacity: 0.26 },
  glowSmall: { position: 'absolute', width: 110, height: 110, borderRadius: 55, borderWidth: 1, borderColor: 'rgba(120,169,255,0.16)', right: -20, top: -62 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  iconBadge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stageBadge: { backgroundColor: '#0B51BE' },
  headerTitle: { flex: 1, minWidth: 0, color: '#FFFFFF', fontSize: 17, lineHeight: 21, fontWeight: '900' },
  claimNoValue: { maxWidth: '38%', color: '#FFFFFF', fontSize: 13.5, lineHeight: 17, fontWeight: '900', textAlign: 'right', letterSpacing: 0.1 },
  headerDivider: { height: 1, backgroundColor: 'rgba(174,204,255,0.24)', marginTop: 8, marginBottom: 8 },
  infoGrid: { flexDirection: 'row', alignItems: 'stretch', minWidth: 0 },
  infoSection: { flex: 1, minWidth: 0, paddingHorizontal: 4 },
  sectionDivider: { width: 1, backgroundColor: 'rgba(174,204,255,0.18)', marginHorizontal: 5, marginVertical: 1 },
  mainInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  vehicleBadge: { backgroundColor: '#EAF2FF' },
  policyBadge: { backgroundColor: '#E8F7F1' },
  mainInfoLine: { flex: 1, minWidth: 0, color: '#FFFFFF', fontSize: 10.4, lineHeight: 14 },
  mainInfoLabel: { color: '#D8E7FF', fontWeight: '800' },
  policyMainLabel: { color: '#A9E7D0' },
  mainInfoValue: { color: '#FFFFFF', fontWeight: '900' },
  secondaryInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, minWidth: 0 },
  makeModelBadge: { backgroundColor: '#E8F1FF' },
  insurerBadge: { backgroundColor: '#FFF2D8' },
  secondaryValue: { flex: 1, minWidth: 0, color: '#EAF2FF', fontSize: 8.8, lineHeight: 11.5, fontWeight: '700' },
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
