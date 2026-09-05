import { Image, StyleSheet, Text, View } from 'react-native';

type InternalManagedClaimHeaderProps = {
  title: string;
  claimNo?: string | null;
  insurerName?: string | null;
  vehicleNo?: string | null;
  policyNo?: string | null;
  vehicleMeta?: string | null;
};

export function InternalManagedClaimHeader({
  title,
  claimNo,
  insurerName,
  vehicleNo,
  policyNo,
  vehicleMeta,
}: InternalManagedClaimHeaderProps) {
  return (
    <View style={styles.spotStatusCard}>
      <View style={styles.spotStatusGlowLarge} />
      <View style={styles.spotStatusGlowSmall} />
      <View style={styles.spotStatusHeaderRow}>
        <View style={[styles.spotStatusIconBadge, styles.spotStatusStageBadge]}>
          <Image source={require('../assets/claims/claim-intimation.png')} style={styles.spotStatusBadgeArtwork} resizeMode="contain" />
        </View>
        <Text style={styles.spotStatusHeaderTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.spotStatusClaimNo} numberOfLines={1}>{claimNo || 'New claim'}</Text>
      </View>
      <View style={styles.spotStatusHeaderDivider} />
      <View style={styles.spotStatusInfoGrid}>
        <View style={styles.spotStatusInfoSection}>
          <View style={styles.spotStatusMainInfoRow}>
            <View style={[styles.spotStatusIconBadge, styles.spotStatusVehicleBadge]}>
              <Image source={require('../assets/claims/fleet-vehicle.png')} style={styles.spotStatusBadgeArtwork} resizeMode="contain" />
            </View>
            <Text style={styles.spotStatusMainInfoLine} numberOfLines={1}>
              <Text style={styles.spotStatusMainInfoLabel}>Vehicle: </Text>
              <Text style={styles.spotStatusMainInfoValue}>{vehicleNo || 'Vehicle'}</Text>
            </Text>
          </View>
          <View style={styles.spotStatusSecondaryInfoRow}>
            <View style={[styles.spotStatusIconBadge, styles.spotStatusMakeModelBadge]}>
              <Image source={require('../assets/claims/fleet-vehicle.png')} style={styles.spotStatusBadgeArtwork} resizeMode="contain" />
            </View>
            <Text style={styles.spotStatusSecondaryValue} numberOfLines={1}>{vehicleMeta || '—'}</Text>
          </View>
        </View>
        <View style={styles.spotStatusSectionDivider} />
        <View style={styles.spotStatusInfoSection}>
          <View style={styles.spotStatusMainInfoRow}>
            <View style={[styles.spotStatusIconBadge, styles.spotStatusPolicyBadge]}>
              <Image source={require('../assets/claims/policy.png')} style={styles.spotStatusBadgeArtwork} resizeMode="contain" />
            </View>
            <Text style={styles.spotStatusMainInfoLine} numberOfLines={1}>
              <Text style={[styles.spotStatusMainInfoLabel, styles.spotStatusPolicyMainLabel]}>Policy: </Text>
              <Text style={styles.spotStatusMainInfoValue}>{policyNo || '—'}</Text>
            </Text>
          </View>
          <View style={styles.spotStatusSecondaryInfoRow}>
            <View style={[styles.spotStatusIconBadge, styles.spotStatusInsurerBadge]}>
              <Image source={require('../assets/claims/accounts-finance.png')} style={styles.spotStatusBadgeArtwork} resizeMode="contain" />
            </View>
            <Text style={styles.spotStatusSecondaryValue} numberOfLines={2}>{insurerName || 'Insurance company'}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  spotStatusCard: { position: 'relative', overflow: 'hidden', width: '100%', borderRadius: 18, backgroundColor: '#062D70', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, marginBottom: 10, shadowColor: '#062D70', shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  spotStatusGlowLarge: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#0C58C8', right: -95, top: -105, opacity: 0.26 },
  spotStatusGlowSmall: { position: 'absolute', width: 110, height: 110, borderRadius: 55, borderWidth: 1, borderColor: 'rgba(120,169,255,0.16)', right: -20, top: -62 },
  spotStatusHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  spotStatusIconBadge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  spotStatusBadgeArtwork: { width: 21, height: 21 },
  spotStatusStageBadge: { backgroundColor: '#0B51BE' },
  spotStatusHeaderTitle: { flex: 1, minWidth: 0, color: '#FFFFFF', fontSize: 17, lineHeight: 21, fontWeight: '900' },
  spotStatusClaimNo: { maxWidth: '38%', color: '#FFFFFF', fontSize: 13.5, lineHeight: 17, fontWeight: '900', textAlign: 'right', letterSpacing: 0.1 },
  spotStatusHeaderDivider: { height: 1, backgroundColor: 'rgba(174,204,255,0.24)', marginTop: 8, marginBottom: 8 },
  spotStatusInfoGrid: { flexDirection: 'row', alignItems: 'stretch', minWidth: 0 },
  spotStatusInfoSection: { flex: 1, minWidth: 0, paddingHorizontal: 4 },
  spotStatusSectionDivider: { width: 1, backgroundColor: 'rgba(174,204,255,0.18)', marginHorizontal: 5, marginVertical: 1 },
  spotStatusMainInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  spotStatusVehicleBadge: { backgroundColor: '#EAF2FF' },
  spotStatusPolicyBadge: { backgroundColor: '#E8F7F1' },
  spotStatusMainInfoLine: { flex: 1, minWidth: 0, color: '#FFFFFF', fontSize: 10.4, lineHeight: 14 },
  spotStatusMainInfoLabel: { color: '#D8E7FF', fontWeight: '800' },
  spotStatusPolicyMainLabel: { color: '#A9E7D0' },
  spotStatusMainInfoValue: { color: '#FFFFFF', fontWeight: '900' },
  spotStatusSecondaryInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, minWidth: 0 },
  spotStatusMakeModelBadge: { backgroundColor: '#E8F1FF' },
  spotStatusInsurerBadge: { backgroundColor: '#FFF2D8' },
  spotStatusSecondaryValue: { flex: 1, minWidth: 0, color: '#EAF2FF', fontSize: 8.8, lineHeight: 11.5, fontWeight: '700' },
});
