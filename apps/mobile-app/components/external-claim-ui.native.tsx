import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
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

  if (milestoneKey !== 'claim_intimation') {
    const SharedClaimIdentityCard = sharedUi.ClaimIdentityCard;
    return <SharedClaimIdentityCard {...props} />;
  }

  const { claimNo, insurerName, vehicleNo, policyNo, vehicleMeta } = props;
  const claimId = typeof params.id === 'string' ? params.id : '';

  function openAssistance() {
    if (!claimId) return;
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Get Assistance"
          accessibilityHint="Opens the existing claim assistance flow"
          disabled={!claimId}
          onPress={openAssistance}
          hitSlop={8}
          style={({ pressed }) => [styles.assistanceButton, pressed && styles.assistancePressed, !claimId && styles.assistanceDisabled]}
        >
          <MaterialCommunityIcons name="help-circle-outline" size={23} color="#FFFFFF" />
        </Pressable>
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
              <MaterialCommunityIcons name="car-outline" size={14} color="#083B9B" />
            </View>
            <Text style={styles.detailLabel}>Vehicle</Text>
            <Text style={styles.detailValue} numberOfLines={1}>{vehicleNo || 'Vehicle'}</Text>
          </View>

          <View style={styles.rowDivider} />

          <View style={styles.detailRow}>
            <View style={styles.policyBadge}>
              <MaterialCommunityIcons name="file-document-outline" size={14} color="#0B7A57" />
            </View>
            <Text style={[styles.detailLabel, styles.policyLabel]}>Policy</Text>
            <Text style={styles.detailValue} numberOfLines={1}>{policyNo || '—'}</Text>
          </View>

          {vehicleMeta ? <>
            <View style={styles.rowDivider} />
            <Text style={styles.vehicleMeta} numberOfLines={1}>{vehicleMeta}</Text>
          </> : null}
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
    paddingTop: 11,
    paddingBottom: 11,
    marginBottom: 10,
    shadowColor: '#062D70',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  glowLarge: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#0C58C8', right: -95, top: -105, opacity: 0.28 },
  glowSmall: { position: 'absolute', width: 110, height: 110, borderRadius: 55, borderWidth: 1, borderColor: 'rgba(120,169,255,0.16)', right: -20, top: -62 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 36 },
  stageBadge: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#0B51BE', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headerTitle: { flex: 1, minWidth: 0, color: '#FFFFFF', fontSize: 17.5, lineHeight: 22, fontWeight: '900' },
  assistanceButton: { width: 34, height: 34, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(198,218,255,0.52)', backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  assistancePressed: { backgroundColor: 'rgba(255,255,255,0.12)', transform: [{ scale: 0.97 }] },
  assistanceDisabled: { opacity: 0.45 },
  headerDivider: { height: 1, backgroundColor: 'rgba(174,204,255,0.24)', marginTop: 9, marginBottom: 10 },
  contentRow: { flexDirection: 'row', alignItems: 'stretch', minWidth: 0 },
  claimSection: { flex: 0.95, minWidth: 0, paddingRight: 10 },
  vehicleSection: { flex: 1.35, minWidth: 0, paddingLeft: 10 },
  verticalDivider: { width: 1, backgroundColor: 'rgba(175,203,255,0.22)', marginVertical: 1 },
  sectionLabel: { color: '#B5CEFA', fontSize: 8.5, lineHeight: 11, fontWeight: '900', letterSpacing: 0.35, marginBottom: 7 },
  claimValueRow: { flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
  claimIcon: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)', backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  claimValue: { flex: 1, minWidth: 0, color: '#FFFFFF', fontSize: 15.5, lineHeight: 19, fontWeight: '900' },
  insurerMeta: { color: '#DDE9FF', fontSize: 9, lineHeight: 12.5, fontWeight: '650', marginTop: 5, paddingLeft: 31 },
  detailRow: { minHeight: 31, flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
  vehicleBadge: { width: 27, height: 27, borderRadius: 14, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  policyBadge: { width: 27, height: 27, borderRadius: 14, backgroundColor: '#E8F7F1', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  detailLabel: { color: '#FFFFFF', fontSize: 9.5, lineHeight: 12, fontWeight: '800', flexShrink: 0 },
  policyLabel: { color: '#9EE2C6' },
  detailValue: { flex: 1, minWidth: 0, color: '#FFFFFF', fontSize: 10.5, lineHeight: 14, fontWeight: '900', textAlign: 'right' },
  rowDivider: { height: 1, backgroundColor: 'rgba(175,203,255,0.18)', marginLeft: 34, marginVertical: 3 },
  vehicleMeta: { color: '#C9DBFA', fontSize: 8.5, lineHeight: 12, fontWeight: '700', paddingLeft: 34, paddingTop: 1 },
});
