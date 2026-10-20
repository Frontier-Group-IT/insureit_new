import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PartnerInsurerLogo } from '@/components/ui/partner-insurer-logo';
import { getPartnerManufacturerLogoSource } from '@/lib/catalog-logos';
import { PartnerAssets } from '@/lib/partner-assets';
import type { PartnerClaimDetail } from '@/lib/claims';

export function PartnerWorkApproval({ data }: { data: PartnerClaimDetail }) {
  const router = useRouter();
  const claimReference = data.claim.insurer_claim_no || data.claim.claim_no || 'Not recorded';
  const vehicleNumber = data.vehicle.vehicle_no || 'Vehicle not recorded';
  const vehicleMake = data.vehicle.make || 'Manufacturer not recorded';
  const insurerName = data.insurer.name || 'Insurer not recorded';
  const policyNumber = data.policy.policy_no || 'Policy not recorded';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to Claim Tracker" onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Work Approval</Text>
          <Text style={styles.headerSubtitle}>Claim Tracker</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroStageIcon}>
              <MaterialCommunityIcons name="clipboard-check-outline" color="#FFFFFF" size={22} />
            </View>
            <Text style={styles.heroTitle}>Work Approval</Text>
            <Text numberOfLines={1} style={styles.heroClaimNo}>{claimReference}</Text>
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.identityRow}>
            <View style={styles.identityBlock}>
              <View style={styles.logoTile}>
                <Image
                  source={getPartnerManufacturerLogoSource(data.vehicle.make) ?? PartnerAssets.navigation.claims}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.identityCopy}>
                <Text numberOfLines={1} style={styles.identityTitle}>{vehicleNumber}</Text>
                <Text numberOfLines={2} style={styles.identityCaption}>{vehicleMake}</Text>
              </View>
            </View>

            <View style={styles.identityDivider} />

            <View style={styles.identityBlock}>
              <View style={styles.logoTile}>
                <PartnerInsurerLogo name={data.insurer.name} fallback={PartnerAssets.navigation.claims} style={styles.logoImage} />
              </View>
              <View style={styles.identityCopy}>
                <Text numberOfLines={1} style={styles.identityTitle}>{policyNumber}</Text>
                <Text numberOfLines={2} style={styles.identityCaption}>{insurerName}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeading}>
            <View style={styles.sectionIcon}>
              <MaterialCommunityIcons name="file-document-check-outline" color="#1A63B7" size={30} />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionTitle}>Stage Details</Text>
              <Text style={styles.sectionSubtitle}>Record approval and surveyor details</Text>
            </View>
          </View>

          <FieldLabel text="Approval Received Date *" />
          <View style={styles.inputShell}>
            <Text style={styles.placeholder}>Select date</Text>
            <Ionicons name="calendar-outline" size={22} color="#A7AFBA" />
          </View>

          <FieldLabel text="Cashless Claim *" />
          <View style={styles.choiceRow}>
            <View style={styles.choiceButton}><Text style={styles.choiceText}>Yes</Text></View>
            <View style={styles.choiceButton}><Text style={styles.choiceText}>No</Text></View>
          </View>

          <FieldLabel text="Surveyor Name (Optional)" />
          <TextInput editable={false} value="" style={styles.textInput} />

          <FieldLabel text="Surveyor Phone (Optional)" />
          <TextInput editable={false} value="" keyboardType="phone-pad" style={styles.textInput} />

          <FieldLabel text="Surveyor Email (Optional)" />
          <TextInput editable={false} value="" keyboardType="email-address" autoCapitalize="none" style={styles.textInput} />
        </View>
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Get Assistance"
          onPress={() => router.push('/support' as never)}
          style={({ pressed }) => [styles.assistanceButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="account-voice" size={22} color="#0D4C99" />
          <Text style={styles.assistanceText}>Get Assistance</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue to Repair and RI"
          onPress={() => router.push({ pathname: '/claim/stage', params: { id: data.claim.id, key: 'repair_ri' } } as never)}
          style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}
        >
          <Text style={styles.continueText}>Continue</Text>
          <Ionicons name="arrow-forward" size={22} color="#FFFFFF" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function FieldLabel({ text }: { text: string }) {
  return <Text style={styles.fieldLabel}>{text}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#EDF6FE' },
  header: {
    height: 72,
    backgroundColor: '#071F4D',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: '#657794',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  headerSubtitle: { color: '#BFD0E8', fontSize: 10, marginTop: 2 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 24, gap: 16 },
  hero: {
    backgroundColor: '#0A3E8D',
    borderRadius: 22,
    padding: 16,
    shadowColor: '#0B2F63',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroStageIcon: {
    width: 38,
    height: 38,
    borderRadius: 20,
    backgroundColor: '#235DAA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { flex: 1, color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  heroClaimNo: { maxWidth: '36%', color: '#FFFFFF', fontSize: 16, fontWeight: '900', textAlign: 'right' },
  heroDivider: { height: 1, backgroundColor: '#5579A9', marginVertical: 14 },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  identityBlock: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  identityDivider: { width: 1, height: 58, backgroundColor: '#4E72A2' },
  logoTile: {
    width: 54,
    height: 54,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: { width: 44, height: 44 },
  identityCopy: { flex: 1, minWidth: 0 },
  identityTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  identityCaption: { color: '#DCE8F8', fontSize: 10.5, lineHeight: 15, fontWeight: '700', marginTop: 3 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D5E0EB',
    padding: 18,
    gap: 12,
    shadowColor: '#15375F',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  sectionIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: '#EEF5FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCopy: { flex: 1 },
  sectionTitle: { color: '#11294D', fontSize: 16, fontWeight: '900' },
  sectionSubtitle: { color: '#808DA0', fontSize: 11, marginTop: 3 },
  fieldLabel: { color: '#485A73', fontSize: 12.5, fontWeight: '800', marginTop: 5 },
  inputShell: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: '#E2E6EB',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  placeholder: { color: '#AEB5BE', fontSize: 15, fontWeight: '700' },
  choiceRow: { flexDirection: 'row', gap: 12 },
  choiceButton: {
    flex: 1,
    minHeight: 58,
    borderWidth: 1,
    borderColor: '#E1E5E9',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  choiceText: { color: '#8C949F', fontSize: 13, fontWeight: '800' },
  textInput: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: '#E2E6EB',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    color: '#17365D',
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#EDF6FE',
  },
  assistanceButton: {
    flex: 1,
    minHeight: 58,
    borderWidth: 1,
    borderColor: '#AFC9E2',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  assistanceText: { color: '#0D4C99', fontSize: 13, fontWeight: '900' },
  continueButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: '#0A3E8D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  continueText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  pressed: { opacity: 0.82 },
});
