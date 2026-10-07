import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function money(value: number) {
  if (!Number.isFinite(value)) return '₹0';
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function calculateEmi(principal: number, annualRate: number, months: number) {
  if (principal <= 0 || months <= 0) return 0;
  if (annualRate <= 0) return principal / months;
  const monthlyRate = annualRate / 12 / 100;
  const factor = Math.pow(1 + monthlyRate, months);
  return principal * monthlyRate * factor / (factor - 1);
}

export default function ExchangeFinanceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ price?: string | string[]; title?: string | string[]; listingId?: string | string[] }>();
  const rawPrice = Array.isArray(params.price) ? params.price[0] : params.price;
  const title = Array.isArray(params.title) ? params.title[0] : params.title;
  const listingId = Array.isArray(params.listingId) ? params.listingId[0] : params.listingId;

  const askingPrice = Math.max(0, Number(rawPrice || 0));
  const defaultDownPayment = Math.round(askingPrice * 0.2);
  const [downPayment, setDownPayment] = useState(String(defaultDownPayment || ''));
  const [interestRate, setInterestRate] = useState('11');
  const [tenure, setTenure] = useState(36);

  const values = useMemo(() => {
    const down = Math.max(0, Math.min(askingPrice, Number(downPayment || 0)));
    const rate = Math.max(0, Math.min(40, Number(interestRate || 0)));
    const loan = Math.max(0, askingPrice - down);
    const emi = calculateEmi(loan, rate, tenure);
    const totalPayable = emi * tenure;
    const totalInterest = Math.max(0, totalPayable - loan);
    return { down, rate, loan, emi, totalPayable, totalInterest };
  }, [askingPrice, downPayment, interestRate, tenure]);

  const downPercent = askingPrice > 0 ? Math.round(values.down / askingPrice * 100) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <MaterialCommunityIcons name="arrow-left" size={21} color="#0F1D33" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Finance estimate</Text>
          <Text numberOfLines={1} style={styles.headerSubtitle}>{title || 'Exchange vehicle'}</Text>
        </View>
        <View style={styles.headerButtonSpacer} />
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}><MaterialCommunityIcons name="calculator-variant-outline" size={26} color="#FFFFFF" /></View>
          <View style={styles.flex}>
            <Text style={styles.heroEyebrow}>EMI ESTIMATE</Text>
            <Text style={styles.heroTitle}>Plan the purchase before you enquire.</Text>
            <Text style={styles.heroCopy}>Adjust down payment, interest and tenure to see an indicative monthly payment.</Text>
          </View>
        </View>

        <View style={styles.priceCard}>
          <Text style={styles.label}>VEHICLE ASKING PRICE</Text>
          <Text style={styles.askingPrice}>{money(askingPrice)}</Text>
          <Text style={styles.priceCopy}>This uses the seller’s current Exchange asking price, not a valuation or lender-approved amount.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Down payment</Text>
          <Text style={styles.cardCopy}>Choose how much you plan to pay upfront.</Text>

          <View style={styles.inputShell}>
            <Text style={styles.prefix}>₹</Text>
            <TextInput
              value={downPayment}
              onChangeText={(value) => setDownPayment(value.replace(/\D/g, ''))}
              keyboardType="number-pad"
              placeholder="Down payment"
              placeholderTextColor="#98A3B1"
              style={styles.input}
            />
            <View style={styles.percentPill}><Text style={styles.percentText}>{downPercent}%</Text></View>
          </View>

          <View style={styles.quickRow}>
            {[10, 20, 25, 30].map((percent) => (
              <Pressable
                key={percent}
                onPress={() => setDownPayment(String(Math.round(askingPrice * percent / 100)))}
                style={[styles.quickChip, downPercent === percent && styles.quickChipActive]}
              >
                <Text style={[styles.quickChipText, downPercent === percent && styles.quickChipTextActive]}>{percent}%</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldTitle}>Interest rate (annual)</Text>
          <View style={styles.inputShell}>
            <TextInput
              value={interestRate}
              onChangeText={(value) => setInterestRate(value.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="11"
              placeholderTextColor="#98A3B1"
              style={styles.input}
            />
            <Text style={styles.suffix}>% p.a.</Text>
          </View>

          <Text style={styles.fieldTitle}>Loan tenure</Text>
          <View style={styles.tenureGrid}>
            {[12, 24, 36, 48, 60].map((months) => (
              <Pressable
                key={months}
                onPress={() => setTenure(months)}
                style={[styles.tenureChip, tenure === months && styles.tenureChipActive]}
              >
                <Text style={[styles.tenureValue, tenure === months && styles.tenureValueActive]}>{months}</Text>
                <Text style={[styles.tenureLabel, tenure === months && styles.tenureLabelActive]}>months</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.resultCard}>
          <Text style={styles.resultEyebrow}>ESTIMATED MONTHLY EMI</Text>
          <Text style={styles.emi}>{money(values.emi)}</Text>
          <Text style={styles.resultCopy}>for {tenure} months at {values.rate.toFixed(values.rate % 1 ? 1 : 0)}% p.a.</Text>

          <View style={styles.metrics}>
            <Metric label="Loan amount" value={money(values.loan)} />
            <Metric label="Down payment" value={money(values.down)} />
            <Metric label="Total interest" value={money(values.totalInterest)} />
            <Metric label="Total loan repayment" value={money(values.totalPayable)} />
          </View>
        </View>

        <View style={styles.disclaimer}>
          <MaterialCommunityIcons name="information-outline" size={18} color="#657286" />
          <Text style={styles.disclaimerText}>This is a mathematical estimate only. It is not a loan offer, eligibility decision, lender quote or approval. Actual rates, fees, insurance, taxes, documentation and repayment terms may differ.</Text>
        </View>

        {listingId ? (
          <Pressable
            onPress={() => router.push({ pathname: '/customer/exchange/[listingId]', params: { listingId } })}
            style={styles.vehicleButton}
          >
            <MaterialCommunityIcons name="truck-outline" size={18} color="#164BB8" />
            <Text style={styles.vehicleButtonText}>Back to vehicle details</Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color="#164BB8" />
          </Pressable>
        ) : null}

        <View style={styles.futureCard}>
          <View style={styles.futureIcon}><MaterialCommunityIcons name="bank-outline" size={22} color="#164BB8" /></View>
          <View style={styles.flex}>
            <Text style={styles.futureTitle}>Finance enquiry is not connected yet</Text>
            <Text style={styles.futureCopy}>A future phase can connect eligible lenders and real quotes. Until then, Exchange will not pretend this estimate is an approval.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8FA' },
  flex: { flex: 1 },
  content: { padding: 14, paddingBottom: 36 },
  header: { minHeight: 68, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E4E9EF' },
  headerButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6F8' },
  headerButtonSpacer: { width: 40, height: 40 },
  headerCopy: { flex: 1, paddingHorizontal: 8, alignItems: 'center' },
  headerTitle: { color: '#0F1D33', fontSize: 14, fontWeight: '900' },
  headerSubtitle: { marginTop: 2, maxWidth: 220, color: '#8793A4', fontSize: 7.7, fontWeight: '700' },

  hero: { borderRadius: 20, padding: 15, flexDirection: 'row', alignItems: 'flex-start', gap: 11, backgroundColor: '#0F1D33' },
  heroIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#164BB8' },
  heroEyebrow: { color: '#8EB7FF', fontSize: 7.4, fontWeight: '900', letterSpacing: 0.7 },
  heroTitle: { marginTop: 3, color: '#FFFFFF', fontSize: 15.5, fontWeight: '900' },
  heroCopy: { marginTop: 5, color: '#B9C3D1', fontSize: 8.2, lineHeight: 12, fontWeight: '700' },

  priceCard: { marginTop: 11, borderRadius: 18, padding: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E5EC' },
  label: { color: '#8591A2', fontSize: 7.5, fontWeight: '900', letterSpacing: 0.6 },
  askingPrice: { marginTop: 4, color: '#0F1D33', fontSize: 24, fontWeight: '900' },
  priceCopy: { marginTop: 5, color: '#7A8799', fontSize: 7.8, lineHeight: 11, fontWeight: '700' },

  card: { marginTop: 11, borderRadius: 19, padding: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E5EC' },
  cardTitle: { color: '#0F1D33', fontSize: 13, fontWeight: '900' },
  cardCopy: { marginTop: 3, color: '#7C899B', fontSize: 8, fontWeight: '700' },
  inputShell: { marginTop: 9, minHeight: 50, borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FB', borderWidth: 1, borderColor: '#DFE4EA' },
  prefix: { marginRight: 4, color: '#0F1D33', fontSize: 15, fontWeight: '900' },
  input: { flex: 1, minHeight: 48, color: '#0F1D33', fontSize: 12, fontWeight: '900' },
  suffix: { color: '#69768A', fontSize: 8.5, fontWeight: '800' },
  percentPill: { height: 26, borderRadius: 13, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF4FF' },
  percentText: { color: '#164BB8', fontSize: 7.8, fontWeight: '900' },
  quickRow: { marginTop: 8, flexDirection: 'row', gap: 7 },
  quickChip: { flex: 1, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6F8', borderWidth: 1, borderColor: '#E1E6EC' },
  quickChipActive: { backgroundColor: '#EEF4FF', borderColor: '#9DBBEA' },
  quickChipText: { color: '#69768A', fontSize: 8, fontWeight: '900' },
  quickChipTextActive: { color: '#164BB8' },
  fieldTitle: { marginTop: 16, color: '#58667B', fontSize: 8.5, fontWeight: '900' },
  tenureGrid: { marginTop: 8, flexDirection: 'row', gap: 6 },
  tenureChip: { flex: 1, minHeight: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6F8FA', borderWidth: 1, borderColor: '#E2E7ED' },
  tenureChipActive: { backgroundColor: '#164BB8', borderColor: '#164BB8' },
  tenureValue: { color: '#26364D', fontSize: 10, fontWeight: '900' },
  tenureValueActive: { color: '#FFFFFF' },
  tenureLabel: { marginTop: 2, color: '#8793A4', fontSize: 6.5, fontWeight: '800' },
  tenureLabelActive: { color: '#CFE0FF' },

  resultCard: { marginTop: 11, borderRadius: 20, padding: 15, backgroundColor: '#EEF4FF', borderWidth: 1, borderColor: '#CFE0FA' },
  resultEyebrow: { color: '#5C78A8', fontSize: 7.4, fontWeight: '900', letterSpacing: 0.6 },
  emi: { marginTop: 3, color: '#164BB8', fontSize: 28, fontWeight: '900' },
  resultCopy: { marginTop: 2, color: '#657694', fontSize: 8, fontWeight: '700' },
  metrics: { marginTop: 13, flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  metric: { width: '48.8%', minHeight: 62, borderRadius: 13, padding: 9, backgroundColor: '#FFFFFF' },
  metricLabel: { color: '#8995A5', fontSize: 6.8, fontWeight: '800' },
  metricValue: { marginTop: 5, color: '#26364D', fontSize: 10, fontWeight: '900' },

  disclaimer: { marginTop: 11, borderRadius: 15, padding: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 7, backgroundColor: '#EEF1F4' },
  disclaimerText: { flex: 1, color: '#657286', fontSize: 7.4, lineHeight: 10.8, fontWeight: '700' },
  vehicleButton: { marginTop: 11, height: 48, borderRadius: 15, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#C9D8EF' },
  vehicleButtonText: { flex: 1, color: '#164BB8', fontSize: 8.8, fontWeight: '900' },
  futureCard: { marginTop: 11, borderRadius: 18, padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E5EC' },
  futureIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF4FF' },
  futureTitle: { color: '#0F1D33', fontSize: 9.5, fontWeight: '900' },
  futureCopy: { marginTop: 3, color: '#7A8799', fontSize: 7.8, lineHeight: 11.2, fontWeight: '700' },
});

