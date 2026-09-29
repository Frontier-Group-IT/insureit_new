import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

type Props = { vehicleCount?: string | number };

export function StoryImpactArtwork({ vehicleCount }: Props) {
  return (
    <View pointerEvents="none" style={styles.wrap}>
      <View style={styles.skyGlow} />
      <View style={styles.city}>
        {[38, 64, 48, 82, 58, 96, 70, 52, 88, 62, 78].map((height, index) => (
          <View key={index} style={[styles.building, { height, opacity: 0.42 + (index % 3) * 0.13 }]}>
            <View style={styles.window} /><View style={styles.window} /><View style={styles.window} />
          </View>
        ))}
      </View>

      <View style={styles.statCard}>
        <Ionicons name="car-sport-outline" size={18} color="#FFFFFF" />
        <View>
          <Text style={styles.statValue}>{vehicleCount ?? '—'}</Text>
          <Text style={styles.statLabel}>Vehicles Covered</Text>
        </View>
      </View>

      <View style={styles.haloOuter}><View style={styles.haloInner} /></View>
      <View style={styles.shield}>
        <Ionicons name="shield-checkmark" size={74} color="#FFFFFF" />
        <View style={styles.heart}><Ionicons name="heart-outline" size={27} color="#FFFFFF" /></View>
      </View>

      <View style={styles.fleet}>
        <View style={[styles.vehicle, styles.vehicleLarge]}><Ionicons name="car-sport" size={56} color="#E9F7FF" /></View>
        <View style={styles.vehicle}><Ionicons name="bus" size={49} color="#D9EEFF" /></View>
        <View style={styles.vehicle}><Ionicons name="car-sport" size={42} color="#EDF8FF" /></View>
      </View>
      <View style={styles.roadLineOne} /><View style={styles.roadLineTwo} />
      <View style={styles.bottomFade} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: -11, right: -11, bottom: -14, height: '58%', overflow: 'hidden' },
  skyGlow: { position: 'absolute', left: '15%', right: '-10%', top: '3%', height: '66%', borderRadius: 220, backgroundColor: '#0755D8', opacity: 0.38 },
  city: { position: 'absolute', left: 0, right: 0, top: '28%', height: 120, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', paddingHorizontal: 8 },
  building: { width: 24, backgroundColor: '#0D4B9B', borderTopLeftRadius: 2, borderTopRightRadius: 2, paddingTop: 8, alignItems: 'center', gap: 8 },
  window: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#77CFFF' },
  statCard: { position: 'absolute', right: 17, top: 12, minWidth: 105, height: 50, borderWidth: 1, borderColor: '#61A6FF', borderRadius: 7, backgroundColor: '#12399C', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, transform: [{ rotate: '-6deg' }] },
  statValue: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  statLabel: { color: '#DDEAFF', fontSize: 6.5, fontWeight: '700' },
  haloOuter: { position: 'absolute', width: 145, height: 145, borderRadius: 73, borderWidth: 2, borderColor: '#73B9FF', left: '50%', marginLeft: -72, top: 64, opacity: 0.72 },
  haloInner: { position: 'absolute', width: 112, height: 112, borderRadius: 56, borderWidth: 1, borderColor: '#B4DDFF', left: 15, top: 15, opacity: 0.7 },
  shield: { position: 'absolute', left: '50%', marginLeft: -43, top: 88, width: 86, height: 94, alignItems: 'center', justifyContent: 'center', shadowColor: '#1586FF', shadowOpacity: 0.95, shadowRadius: 18, elevation: 10 },
  heart: { position: 'absolute', top: 29, left: 29 },
  fleet: { position: 'absolute', left: 20, right: 14, top: '54%', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around' },
  vehicle: { shadowColor: '#1B8CFF', shadowOpacity: 0.95, shadowRadius: 12, elevation: 8 },
  vehicleLarge: { transform: [{ scale: 1.22 }] },
  roadLineOne: { position: 'absolute', left: -30, right: -40, bottom: 74, height: 2, backgroundColor: '#27A9FF', transform: [{ rotate: '-8deg' }], opacity: 0.95 },
  roadLineTwo: { position: 'absolute', left: -20, right: -60, bottom: 47, height: 2, backgroundColor: '#7A4FFF', transform: [{ rotate: '-7deg' }], opacity: 0.85 },
  bottomFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 78, backgroundColor: '#071733', opacity: 0.42 },
});
