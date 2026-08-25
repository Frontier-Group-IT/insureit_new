import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { palette } from '@/lib/theme';
import { ClaimIdentityCard as SharedClaimIdentityCard } from './external-claim-ui.tsx';

export * from './external-claim-ui.tsx';

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
        <View style={styles.vehicleIcon}>
          <MaterialCommunityIcons name="car-outline" size={18} color="#FFFFFF" />
        </View>
        <View style={styles.vehicleCopy}>
          <Text style={styles.label}>CLAIM VEHICLE</Text>
          <View style={styles.metaRow}>
            <MaterialCommunityIcons name="car-outline" size={13} color="#AFCBFF" />
            <Text style={styles.metaValue} numberOfLines={2}>{vehicleNo || 'Vehicle'}</Text>
          </View>
          <View style={styles.metaRow}>
            <MaterialCommunityIcons name="file-document-outline" size={13} color="#AFCBFF" />
            <Text style={styles.metaValue} numberOfLines={2}>{policyNo ? `Policy: ${policyNo}` : 'Policy: —'}</Text>
          </View>
          {vehicleMeta ? <Text style={styles.vehicleMeta} numberOfLines={2}>{vehicleMeta}</Text> : null}
        </View>
        <View style={styles.focusIcon}>
          <MaterialCommunityIcons name="crosshairs-gps" size={17} color="#AFCBFF" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { position: 'relative', overflow: 'hidden', flexDirection: 'row', alignItems: 'stretch', width: '100%', minHeight: 116, borderRadius: 18, backgroundColor: '#07327B', paddingHorizontal: 14, paddingVertical: 13, marginBottom: 14 },
  glow: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: '#1267D9', right: -70, top: -85, opacity: 0.42 },
  claimSection: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9, paddingRight: 9 },
  divider: { width: 1, backgroundColor: 'rgba(175,203,255,0.24)', marginVertical: 4 },
  vehicleSection: { flex: 1.25, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 10 },
  claimIcon: { width: 50, height: 50, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  vehicleIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(105,157,241,0.28)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  copy: { flex: 1, minWidth: 0 },
  vehicleCopy: { flex: 1, minWidth: 0 },
  label: { color: '#AFCBFF', fontSize: 8.5, lineHeight: 11, fontWeight: '900', letterSpacing: 0.25 },
  value: { color: '#FFFFFF', fontSize: 16, lineHeight: 20, fontWeight: '900', marginTop: 2 },
  meta: { color: '#DDE9FF', fontSize: 9, lineHeight: 13, fontWeight: '700', marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 3, minWidth: 0 },
  metaValue: { flex: 1, minWidth: 0, color: '#FFFFFF', fontSize: 10.5, lineHeight: 14, fontWeight: '900' },
  vehicleMeta: { color: '#C9DBFA', fontSize: 8.5, lineHeight: 12, fontWeight: '700', marginTop: 2 },
  focusIcon: { width: 24, alignItems: 'flex-end', justifyContent: 'center', flexShrink: 0 },
});
