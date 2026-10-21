import { PartnerClaimStageDraft } from '@/components/partner-claim-stage-draft';
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
      <PartnerClaimStageDraft data={data} stage={"work_approval"} />
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
    height: 50,
    backgroundColor: '#071F4D',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: '#657794',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1 },
  headerTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  headerSubtitle: { color: '#BFD0E8', fontSize: 10, marginTop: 2 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 18, gap: 10 },
  hero: {
    backgroundColor: '#0A3E8D',
    borderRadius: 17,
    padding: 12,
    shadowColor: '#0B2F63',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroStageIcon: {
    width: 32,
    height: 32,
    borderRadius: 20,
    backgroundColor: '#235DAA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { flex: 1, color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  heroClaimNo: { maxWidth: '36%', color: '#FFFFFF', fontSize: 12, fontWeight: '900', textAlign: 'right' },
  heroDivider: { height: 1, backgroundColor: '#5579A9', marginVertical: 9 },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  identityBlock: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7 },
  identityDivider: { width: 1, height: 40, backgroundColor: '#4E72A2' },
  logoTile: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: { width: 33, height: 33 },
  identityCopy: { flex: 1, minWidth: 0 },
  identityTitle: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  identityCaption: { color: '#DCE8F8', fontSize: 9, lineHeight: 12, fontWeight: '700', marginTop: 3 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#D5E0EB',
    padding: 13,
    gap: 8,
    shadowColor: '#15375F',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 2 },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: '#EEF5FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCopy: { flex: 1 },
  sectionTitle: { color: '#11294D', fontSize: 14, fontWeight: '900' },
  sectionSubtitle: { color: '#808DA0', fontSize: 10, marginTop: 3 },
  fieldLabel: { color: '#485A73', fontSize: 11.5, fontWeight: '800', marginTop: 3 },
  inputShell: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#E2E6EB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  placeholder: { color: '#AEB5BE', fontSize: 13, fontWeight: '700' },
  choiceRow: { flexDirection: 'row', gap: 9 },
  choiceButton: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#E1E5E9',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  choiceText: { color: '#8C949F', fontSize: 13, fontWeight: '800' },
  textInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#E2E6EB',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    color: '#17365D',
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#EDF6FE',
  },
  assistanceButton: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#AFC9E2',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  assistanceText: { color: '#0D4C99', fontSize: 13, fontWeight: '900' },
  continueButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#0A3E8D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  continueText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  pressed: { opacity: 0.82 },
});
