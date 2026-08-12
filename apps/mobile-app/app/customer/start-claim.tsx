import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui';
import { SELF_MANAGED_CLAIM_NOTICE } from '@/lib/claim-service-mode';
import { palette } from '@/lib/theme';

export default function StartClaimScreen() {
  const router = useRouter();

  return (
    <Screen title="Start Claim" showTitleHeader={false}>
      <View style={styles.headerBlock}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={21} color={palette.navy} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>CLAIM SERVICE</Text>
          <Text style={styles.title}>How is this policy serviced?</Text>
          <Text style={styles.subtitle}>Choose the option that matches the policy for this loss. You can select the vehicle and policy on the next screen.</Text>
        </View>
      </View>

      <View style={styles.choiceStack}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/customer/report-accident')}
          style={({ pressed }) => [styles.choiceCard, styles.managedCard, pressed && styles.pressed]}
        >
          <View style={[styles.iconBox, styles.managedIcon]}>
            <MaterialCommunityIcons name="shield-account-outline" size={30} color="#FFFFFF" />
          </View>
          <View style={styles.choiceCopy}>
            <View style={styles.badgeRow}>
              <Text style={styles.managedBadge}>SANKALP / SIBL</Text>
            </View>
            <Text style={styles.managedTitle}>Broker-Managed Claim</Text>
            <Text style={styles.managedText}>For a policy serviced by Sankalp/SIBL. Our claims desk manages the processing while you submit documents and monitor progress.</Text>
            <View style={styles.actionRow}>
              <Text style={styles.managedAction}>Continue with Sankalp</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
            </View>
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/customer/self-managed-claim')}
          style={({ pressed }) => [styles.choiceCard, styles.selfCard, pressed && styles.pressed]}
        >
          <View style={[styles.iconBox, styles.selfIcon]}>
            <MaterialCommunityIcons name="clipboard-text-clock-outline" size={30} color="#0A43A3" />
          </View>
          <View style={styles.choiceCopy}>
            <View style={styles.badgeRow}>
              <Text style={styles.selfBadge}>EXTERNAL POLICY</Text>
            </View>
            <Text style={styles.selfTitle}>Self-Managed Claim Tracking</Text>
            <Text style={styles.selfText}>For a policy not serviced by Sankalp/SIBL. Record survey, workshop, approval, bill, delivery order and payment milestones yourself.</Text>
            <View style={styles.noticeBox}>
              <MaterialCommunityIcons name="information-outline" size={17} color="#8A5B00" />
              <Text style={styles.noticeText}>{SELF_MANAGED_CLAIM_NOTICE}</Text>
            </View>
            <View style={styles.selfActionRow}>
              <Text style={styles.selfAction}>Start self-managed tracking</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color="#0A43A3" />
            </View>
          </View>
        </Pressable>
      </View>

      <View style={styles.helpBox}>
        <MaterialCommunityIcons name="help-circle-outline" size={20} color="#667085" />
        <Text style={styles.helpText}>Not sure? Check the policy details or contact Sankalp support before choosing. This choice determines who owns the claim process.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerBlock: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: -12, marginBottom: 18 },
  backButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#0A43A3', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: palette.navy, fontSize: 24, lineHeight: 29, fontWeight: '900', marginTop: 3 },
  subtitle: { color: '#667085', fontSize: 13, lineHeight: 19, marginTop: 6, fontWeight: '600' },
  choiceStack: { gap: 14 },
  choiceCard: { borderRadius: 22, padding: 17, borderWidth: 1, flexDirection: 'row', gap: 14, shadowColor: '#0B1F3A', shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  managedCard: { backgroundColor: '#082A66', borderColor: '#082A66' },
  selfCard: { backgroundColor: '#F8FBFF', borderColor: '#BFD5F4' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.995 }] },
  iconBox: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  managedIcon: { backgroundColor: '#174A93' },
  selfIcon: { backgroundColor: '#EAF2FF' },
  choiceCopy: { flex: 1, minWidth: 0 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  managedBadge: { color: '#F8D45A', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  selfBadge: { color: '#0A43A3', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  managedTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  selfTitle: { color: palette.navy, fontSize: 18, fontWeight: '900' },
  managedText: { color: '#DDE9FA', fontSize: 12.3, lineHeight: 18, marginTop: 6, fontWeight: '600' },
  selfText: { color: '#53647B', fontSize: 12.3, lineHeight: 18, marginTop: 6, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 7, alignItems: 'center', marginTop: 13 },
  managedAction: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '900' },
  selfActionRow: { flexDirection: 'row', gap: 7, alignItems: 'center', marginTop: 12 },
  selfAction: { color: '#0A43A3', fontSize: 12.5, fontWeight: '900' },
  noticeBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, backgroundColor: '#FFF7E5', borderRadius: 12, padding: 10, marginTop: 11, borderWidth: 1, borderColor: '#F4D89C' },
  noticeText: { flex: 1, color: '#7A5409', fontSize: 10.5, lineHeight: 15, fontWeight: '700' },
  helpBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#F5F7FA', borderRadius: 16, padding: 13, marginTop: 17 },
  helpText: { flex: 1, color: '#667085', fontSize: 11, lineHeight: 16, fontWeight: '600' },
});
