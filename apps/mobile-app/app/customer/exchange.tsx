import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/first-look';
import { palette } from '@/lib/theme';

export default function ExchangeComingSoonScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to home"
          hitSlop={10}
          onPress={() => router.replace('/customer/home')}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="chevron-left" size={24} color="#FFFFFF" />
        </Pressable>
        <BrandLogo width={132} inverse />
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.body}>
        <View style={styles.visualWrap}>
          <View style={styles.visualHalo} />
          <View style={styles.iconShell}>
            <MaterialCommunityIcons name="swap-horizontal-bold" size={42} color="#174EA6" />
          </View>
        </View>

        <View style={styles.badge}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeText}>COMING SOON</Text>
        </View>

        <Text style={styles.title}>Vehicle Exchange</Text>
        <Text style={styles.subtitle}>
          A simpler way to explore your next vehicle and exchange your current one is on the way.
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/customer/home')}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
        >
          <MaterialCommunityIcons name="home-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Back to home</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F8FC' },
  header: {
    height: 72,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.navy,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerSpacer: { width: 38 },
  pressed: { opacity: 0.75 },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingBottom: 44,
  },
  visualWrap: {
    width: 136,
    height: 136,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  visualHalo: {
    position: 'absolute',
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: '#E8F1FD',
  },
  iconShell: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE8F5',
    shadowColor: '#0B2B59',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EAF3FF',
    marginBottom: 14,
  },
  badgeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#2D69B7' },
  badgeText: { color: '#2D69B7', fontSize: 11, fontWeight: '900', letterSpacing: 0.7 },
  title: { color: palette.navy, fontSize: 27, lineHeight: 33, fontWeight: '900', textAlign: 'center' },
  subtitle: {
    maxWidth: 330,
    marginTop: 10,
    color: '#66758A',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    textAlign: 'center',
  },
  primaryButton: {
    minWidth: 176,
    height: 48,
    marginTop: 28,
    paddingHorizontal: 22,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: palette.navy,
  },
  primaryButtonPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});
