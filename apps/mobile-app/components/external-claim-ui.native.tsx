import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const sharedUi = require('./external-claim-ui.tsx') as Record<string, any>;

export const ExternalClaimStageHeader = sharedUi.ExternalClaimStageHeader;
export const ClaimProgressStrip = sharedUi.ClaimProgressStrip;
export const ClaimStageSummaryCard = sharedUi.ClaimStageSummaryCard;
export const ClaimContextStrip = sharedUi.ClaimContextStrip;
export const ClaimFormSection = sharedUi.ClaimFormSection;
export const ClaimChoice = sharedUi.ClaimChoice;
export const ClaimInlineNote = sharedUi.ClaimInlineNote;
export const ClaimFinancialSummary = sharedUi.ClaimFinancialSummary;
export const ClaimPrimaryAction = sharedUi.ClaimPrimaryAction;
export const ClaimSecondaryAction = sharedUi.ClaimSecondaryAction;
export const ClaimActionBar = sharedUi.ClaimActionBar;
export const ClaimMetaRow = sharedUi.ClaimMetaRow;

let assistanceHintShownThisSession = false;

type ClaimIdentityCardProps = {
  claimNo?: string | null;
  insurerName?: string | null;
  vehicleNo?: string | null;
  policyNo?: string | null;
  vehicleMeta?: string | null;
};

export function ClaimIdentityCard(props: ClaimIdentityCardProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; key?: string }>();
  const milestoneKey = typeof params.key === 'string' ? params.key : '';
  const [assistanceHintVisible, setAssistanceHintVisible] = useState(false);

  useEffect(() => {
    if (milestoneKey !== 'claim_intimation' || assistanceHintShownThisSession) return;
    assistanceHintShownThisSession = true;
    setAssistanceHintVisible(true);
    const timer = setTimeout(() => setAssistanceHintVisible(false), 2800);
    return () => clearTimeout(timer);
  }, [milestoneKey]);

  if (milestoneKey !== 'claim_intimation') {
    const SharedClaimIdentityCard = sharedUi.ClaimIdentityCard;
    return <SharedClaimIdentityCard {...props} />;
  }

  const { claimNo, insurerName, vehicleNo, policyNo, vehicleMeta } = props;
  const claimId = typeof params.id === 'string' ? params.id : '';

  function openAssistance() {
    if (!claimId) return;
    setAssistanceHintVisible(false);
    router.push({ pathname: '/customer/request-claim-assistance', params: { id: claimId, returnStage: 'claim_intimation' } });
  }

  return (
    <View style={styles.card}>
      <View style={styles.glowLarge} />
      <View style={styles.glowSmall} />

      <View style={styles.headerRow}>
        <View style={styles.stageBadge}>
          <MaterialCommunityIcons name="car-emergency" size={18} color="#FFFFFF" />
        </View>
        <Text style={styles.headerTitle} numberOfLines={1}>Claim Intimation</Text>
        <View style={styles.assistanceWrap}>
          {assistanceHintVisible ? <View style={styles.assistanceTooltip} pointerEvents="none"><Text style={styles.assistanceTooltipText}>Need help? Tap here.</Text></View> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Get Assistance"
            accessibilityHint="Opens the existing claim assistance flow"
            disabled={!claimId}
            onPress={openAssistance}
            hitSlop={6}
            style={({ pressed }) => [styles.assistanceButton, pressed && styles.assistancePressed, !claimId && styles.assistanceDisabled]}
          >
            <MaterialCommunityIcons name="timeline-check-outline" size={20} color="#FFFFFF" />
            <Text style={styles.assistanceLabel}>Get Assistance</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.headerDivider} />

      <View style={styles.contentRow}>
        <View style={styles.claimSection}>
          <Text style={styles.sectionLabel}>CLAIM DETAILS</Text>
          <View style={styles.claimValueRow}>
            <View style={styles.claimIcon}>
              <MaterialCommunityIcons name="file-document-outline" size={12} color="#FFFFFF" />
            </View>
            <Text style={styles.claimValue} numberOfLines={1}>{claimNo || 'New claim'}</Text>
          </View>
          <Text style={styles.insurerMeta} numberOfLines={2}>{insurerName || 'Insurance company'}</Text>
        </View>

        <View style={styles.verticalDivider} />

        <View style={styles.vehicleSection}>
          <Text style={styles.sectionLabel}>CLAIM VEHICLE</Text>

          <View style={styles.detailRow}>
            <View style={styles.vehicleBadge}>
              <MaterialCommunityIcons name="car-outline" size={13} color="#083B9B" />
            </View>
            <Text style={styles.detailLine} numberOfLines={1}>
              <Text style={styles.detailLabel}>Vehicle: </Text>
              <Text style={styles.detailValue}>{vehicleNo || 'Vehicle'}</Text>
            </Text>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.policyBadge}>
              <MaterialCommunityIcons name="file-document-outline" size={13} color="#0B7A57" />
            </View>
            <Text style={styles.detailLine} numberOfLines={1}>
              <Text style={[styles.detailLabel, styles.policyLabel]}>Policy: </Text>
              <Text style={styles.detailValue}>{policyNo || '—'}</Text>
            </Text>
          </View>

          {vehicleMeta ? <Text style={styles.vehicleMeta} numberOfLines={1}>{vehicleMeta}</Text> : null}
        </View>
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
    paddingBottom: 9,
    marginBottom: 10,
    shadowColor: '#062D70',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  glowLarge: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#0C58C8', right: -95, top: -105, opacity: 0.28 },
  glowSmall: { position: 'absolute', width: 110, height: 110, borderRadius: 55, borderWidth: 1, borderColor: 'rgba(120,169,255,0.16)', right: -20, top: -62 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 42 },
  stageBadge: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#0B51BE', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headerTitle: { flex: 1, minWidth: 0, color: '#FFFFFF', fontSize: 17.5, lineHeight: 22, fontWeight: '900' },
  assistanceWrap: { position: 'relative', flexShrink: 0 },
  assistanceButton: {
    minWidth: 62,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(171,207,255,0.72)',
    backgroundColor: 'rgba(53,129,235,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
    shadowColor: '#63A9FF',
    shadowOpacity: 0.32,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  assistancePressed: { backgroundColor: 'rgba(83,151,244,0.34)', transform: [{ scale: 0.97 }] },
  assistanceDisabled: { opacity: 0.45 },
  assistanceLabel: { color: '#EAF4FF', fontSize: 7.2, lineHeight: 9, fontWeight: '900', marginTop: 1, textAlign: 'center' },
  assistanceTooltip: { position: 'absolute', right: 0, top: 49, zIndex: 20, minWidth: 108, borderRadius: 9, backgroundColor: '#EAF3FF', borderWidth: 1, borderColor: '#BFD7F7', paddingHorizontal: 9, paddingVertical: 6, shadowColor: '#071F49', shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  assistanceTooltipText: { color: '#0A43A3', fontSize: 9, lineHeight: 12, fontWeight: '900', textAlign: 'center' },
  headerDivider: { height: 1, backgroundColor: 'rgba(174,204,255,0.24)', marginTop: 7, marginBottom: 8 },
  contentRow: { flexDirection: 'row', alignItems: 'stretch', minWidth: 0 },
  claimSection: { flex: 0.95, minWidth: 0, paddingRight: 9 },
  vehicleSection: { flex: 1.35, minWidth: 0, paddingLeft: 9 },
  verticalDivider: { width: 1, backgroundColor: 'rgba(175,203,255,0.22)', marginVertical: 1 },
  sectionLabel: { color: '#B5CEFA', fontSize: 8.5, lineHeight: 11, fontWeight: '900', letterSpacing: 0.35, marginBottom: 5 },
  claimValueRow: { flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
  claimIcon: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)', backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  claimValue: { flex: 1, minWidth: 0, color: '#FFFFFF', fontSize: 15.5, lineHeight: 19, fontWeight: '900' },
  insurerMeta: { color: '#DDE9FF', fontSize: 9, lineHeight: 12.5, fontWeight: '650', marginTop: 4, paddingLeft: 31 },
  detailRow: { minHeight: 27, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0, marginBottom: 2 },
  vehicleBadge: { width: 25, height: 25, borderRadius: 13, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  policyBadge: { width: 25, height: 25, borderRadius: 13, backgroundColor: '#E8F7F1', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  detailLine: { flex: 1, minWidth: 0, color: '#FFFFFF', fontSize: 10.2, lineHeight: 13.5 },
  detailLabel: { color: '#D9E8FF', fontWeight: '800' },
  policyLabel: { color: '#9EE2C6' },
  detailValue: { color: '#FFFFFF', fontWeight: '900' },
  vehicleMeta: { color: '#C9DBFA', fontSize: 8.5, lineHeight: 12, fontWeight: '700', paddingLeft: 31, marginTop: 1 },
});
