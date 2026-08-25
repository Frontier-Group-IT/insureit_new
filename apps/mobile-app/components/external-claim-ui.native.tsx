import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

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
  const params = useLocalSearchParams<{ key?: string }>();
  const milestoneKey = typeof params.key === 'string' ? params.key : '';

  if (milestoneKey !== 'claim_intimation') {
    const SharedClaimIdentityCard = sharedUi.ClaimIdentityCard;
    return <SharedClaimIdentityCard {...props} />;
  }

  const { claimNo, insurerName, vehicleNo, policyNo, vehicleMeta } = props;

  return (
    <View style={styles.card}>
      <View style={styles.glow} />

      <View style={styles.claimSection}>
        <View style={styles.claimIcon}>
          <MaterialCommunityIcons name="file-document-outline" size={20} color="#083B9B" />
        </View>
        <View style={styles.copy}>
          <Text style={styles.label}>CLAIM DETAILS</Text>
          <Text style={styles.value} numberOfLines={1}>{claimNo || 'New claim'}</Text>
          <Text style={styles.meta} numberOfLines={2}>{insurerName || 'Insurance company'}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.vehicleSection}>
        <Text style={styles.label}>CLAIM VEHICLE</Text>

        <View style={styles.detailRow}>
          <View style={styles.vehicleBadge}>
            <MaterialCommunityIcons name="car-outline" size={18} color="#083B9B" />
          </View>
          <View style={styles.detailCopy}>
            <Text style={styles.detailLabel}>VEHICLE</Text>
            <Text style={styles.metaValue} numberOfLines={1}>{vehicleNo || 'Vehicle'}</Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <View style={styles.policyBadge}>
            <MaterialCommunityIcons name="file-document-outline" size={18} color="#0B7A57" />
          </View>
          <View style={styles.detailCopy}>
            <Text style={[styles.detailLabel, styles.policyDetailLabel]}>POLICY</Text>
            <Text style={styles.metaValue} numberOfLines={1}>{policyNo || '—'}</Text>
          </View>
        </View>

        {vehicleMeta ? <Text style={styles.vehicleMeta} numberOfLines={1}>{vehicleMeta}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { position: 'relative', overflow: 'hidden', flexDirection: 'row', alignItems: 'stretch', width: '100%', minHeight: 116, borderRadius: 18, backgroundColor: '#07327B', paddingHorizontal: 14, paddingVertical: 13, marginBottom: 14 },
  glow: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: '#1267D9', right: -70, top: -85, opacity: 0.42 },
  claimSection: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9, paddingRight: 9 },
  divider: { width: 1, backgroundColor: 'rgba(175,203,255,0.24)', marginVertical: 4 },
  vehicleSection: { flex: 1.25, minWidth: 0, paddingLeft: 10, justifyContent: 'center' },
  claimIcon: { width: 50, height: 50, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  copy: { flex: 1, minWidth: 0 },
  label: { color: '#AFCBFF', fontSize: 8.5, lineHeight: 11, fontWeight: '900', letterSpacing: 0.25 },
  value: { color: '#FFFFFF', fontSize: 16, lineHeight: 20, fontWeight: '900', marginTop: 2 },
  meta: { color: '#DDE9FF', fontSize: 9, lineHeight: 13, fontWeight: '700', marginTop: 2 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, minWidth: 0 },
  vehicleBadge: { width: 31, height: 31, borderRadius: 16, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  policyBadge: { width: 31, height: 31, borderRadius: 16, backgroundColor: '#E8F7F1', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  detailCopy: { flex: 1, minWidth: 0 },
  detailLabel: { color: '#AFCBFF', fontSize: 7.5, lineHeight: 9, fontWeight: '900', letterSpacing: 0.35 },
  policyDetailLabel: { color: '#A9E3CF' },
  metaValue: { color: '#FFFFFF', fontSize: 10.5, lineHeight: 14, fontWeight: '900', marginTop: 1 },
  vehicleMeta: { color: '#C9DBFA', fontSize: 8.5, lineHeight: 12, fontWeight: '700', marginTop: 5, paddingLeft: 39 },
});
