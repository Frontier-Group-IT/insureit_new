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
      <View style={styles.glowLarge} />
      <View style={styles.glowSmall} />

      <View style={styles.headerRow}>
        <View style={styles.stageBadge}>
          <MaterialCommunityIcons name="car-emergency" size={18} color="#FFFFFF" />
        </View>
        <Text style={styles.headerTitle} numberOfLines={1}>Claim Intimation</Text>
        <Text style={styles.claimNoValue} numberOfLines={1}>{claimNo || 'New claim'}</Text>
      </View>

      <View style={styles.headerDivider} />

      <View style={styles.infoGrid}>
        <View style={styles.infoCard}>
          <View style={styles.mainInfoRow}>
            <View style={styles.vehicleBadge}>
              <MaterialCommunityIcons name="car-outline" size={17} color="#0A3A86" />
            </View>
            <Text style={styles.mainInfoLine} numberOfLines={1}>
              <Text style={styles.mainInfoLabel}>Vehicle: </Text>
              <Text style={styles.mainInfoValue}>{vehicleNo || 'Vehicle'}</Text>
            </Text>
          </View>

          <View style={styles.secondaryInfoRow}>
            <View style={styles.makeModelBadge}>
              <MaterialCommunityIcons name="information-outline" size={12} color="#2C6FD5" />
            </View>
            <View style={styles.secondaryCopy}>
              <Text style={styles.secondaryLabel}>MAKE & MODEL</Text>
              <Text style={styles.secondaryValue} numberOfLines={1}>{vehicleMeta || '—'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.mainInfoRow}>
            <View style={styles.policyBadge}>
              <MaterialCommunityIcons name="file-document-outline" size={17} color="#0B7A57" />
            </View>
            <Text style={styles.mainInfoLine} numberOfLines={1}>
              <Text style={[styles.mainInfoLabel, styles.policyMainLabel]}>Policy: </Text>
              <Text style={styles.mainInfoValue}>{policyNo || '—'}</Text>
            </Text>
          </View>

          <View style={styles.secondaryInfoRow}>
            <View style={styles.insurerBadge}>
              <MaterialCommunityIcons name="office-building-outline" size={12} color="#8A5A0A" />
            </View>
            <View style={styles.secondaryCopy}>
              <Text style={styles.secondaryLabel}>INSURANCE COMPANY</Text>
              <Text style={styles.secondaryValue} numberOfLines={2}>{insurerName || 'Insurance company'}</Text>
            </View>
          </View>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 36 },
  stageBadge: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#0B51BE', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  headerTitle: { flex: 1, minWidth: 0, color: '#FFFFFF', fontSize: 17.5, lineHeight: 22, fontWeight: '900' },
  claimNoValue: { maxWidth: '38%', color: '#FFFFFF', fontSize: 13.5, lineHeight: 17, fontWeight: '900', textAlign: 'right', letterSpacing: 0.1 },
  headerDivider: { height: 1, backgroundColor: 'rgba(174,204,255,0.24)', marginTop: 8, marginBottom: 8 },
  infoGrid: { flexDirection: 'row', alignItems: 'stretch', gap: 8, minWidth: 0 },
  infoCard: { flex: 1, minWidth: 0, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(174,204,255,0.14)', backgroundColor: 'rgba(255,255,255,0.045)', paddingHorizontal: 8, paddingVertical: 8 },
  mainInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  vehicleBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#EAF2FF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  policyBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#E8F7F1', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  mainInfoLine: { flex: 1, minWidth: 0, color: '#FFFFFF', fontSize: 10.4, lineHeight: 14 },
  mainInfoLabel: { color: '#D8E7FF', fontWeight: '800' },
  policyMainLabel: { color: '#A9E7D0' },
  mainInfoValue: { color: '#FFFFFF', fontWeight: '900' },
  secondaryInfoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 7, minWidth: 0 },
  makeModelBadge: { width: 21, height: 21, borderRadius: 7, backgroundColor: '#E8F1FF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  insurerBadge: { width: 21, height: 21, borderRadius: 7, backgroundColor: '#FFF2D8', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  secondaryCopy: { flex: 1, minWidth: 0 },
  secondaryLabel: { color: '#9FC0F4', fontSize: 6.8, lineHeight: 9, fontWeight: '900', letterSpacing: 0.25 },
  secondaryValue: { color: '#EAF2FF', fontSize: 8.6, lineHeight: 11.5, fontWeight: '700', marginTop: 1 },
});
