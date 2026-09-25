import { Image, StyleSheet, Text, View } from 'react-native';

import { getInsurerLogoSource, getVehicleBrandLogoSource } from '@/lib/catalog-logos';

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
  const [vehicleMake = '', vehicleModel = ''] = String(vehicleMeta ?? '').split(' · ');
  const manufacturerLogo = getVehicleBrandLogoSource(vehicleMake);
  const insurerLogo = getInsurerLogoSource(insurerName);

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

      <View style={styles.identityReferenceRow}>
        <View style={styles.identityReferenceHalf}>
          <View style={styles.identityReferenceLogo}>
            {manufacturerLogo ? (
              <Image source={manufacturerLogo} style={styles.identityReferenceLogoImage} resizeMode="contain" />
            ) : (
              <Image source={require('../assets/claims/fleet-vehicle.png')} style={styles.identityReferenceLogoImage} resizeMode="contain" />
            )}
          </View>
          <View style={styles.identityReferenceCopy}>
            <Text style={styles.identityReferencePrimary} numberOfLines={1}>{vehicleNo || 'Vehicle'}</Text>
            <Text style={styles.identityReferenceSecondary} numberOfLines={1}>{vehicleMake || 'Manufacturer'}</Text>
            <Text style={styles.identityReferenceTertiary} numberOfLines={1}>{vehicleModel || '—'}</Text>
          </View>
        </View>

        <View style={styles.spotStatusSectionDivider} />

        <View style={styles.identityReferenceHalf}>
          <View style={styles.identityReferenceLogo}>
            {insurerLogo ? (
              <Image source={insurerLogo} style={styles.identityReferenceLogoImage} resizeMode="contain" />
            ) : (
              <Image source={require('../assets/claims/accounts-finance.png')} style={styles.identityReferenceLogoImage} resizeMode="contain" />
            )}
          </View>
          <View style={styles.identityReferenceCopy}>
            <Text style={styles.identityReferencePrimary} numberOfLines={1}>{policyNo || '—'}</Text>
            <Text style={styles.identityReferenceSecondary} numberOfLines={2}>{insurerName || 'Insurance company'}</Text>
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
  identityReferenceRow: { flexDirection: 'row', alignItems: 'stretch', minWidth: 0 },
  identityReferenceHalf: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 3 },
  identityReferenceLogo: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(210,225,247,0.8)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  identityReferenceLogoImage: { width: 34, height: 34 },
  identityReferenceCopy: { flex: 1, minWidth: 0 },
  identityReferencePrimary: { color: '#FFFFFF', fontSize: 12.2, lineHeight: 15, fontWeight: '900' },
  identityReferenceSecondary: { color: '#EAF2FF', fontSize: 9.4, lineHeight: 12, fontWeight: '800', marginTop: 2 },
  identityReferenceTertiary: { color: '#AFC4E4', fontSize: 9.2, lineHeight: 12, fontWeight: '700', marginTop: 1 },
});
