import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui';
import { legalDocuments } from '@/lib/legal-content';
import { palette } from '@/lib/theme';

const descriptions: Record<string, string> = {
  'privacy-policy': 'How customer, vehicle, policy, claim, device, and document data is handled.',
  'terms-of-use': 'Rules for using InsureIT quotation, policy, claim, and support workflows.',
  'cookie-policy': 'Use of cookies, app storage, analytics, and similar digital technologies.',
  'fraud-detection-policy': 'Controls and reporting framework for fraud, cyber risk, and claim misuse.',
  'policy-contact': 'Official communication channel for privacy, legal, support, and policy requests.',
  'security-policy': 'Responsible disclosure process and user security guidance.',
};

export default function LegalCenterScreen() {
  return (
    <Screen title="Legal Center" showTitleHeader={false}>
      <Text style={styles.pageName}>Legal Center</Text>
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle}>Sankalp Insurance Brokers Private Limited</Text>
          <Text style={styles.heroBody}>Review the policies that govern privacy, platform use, cookies, fraud monitoring, contact, and security disclosure.</Text>
        </View>
      </View>

      {legalDocuments.map((document) => (
        <Link key={document.slug} href={`/customer/legal/${document.slug}` as never} asChild>
          <Pressable accessibilityRole="button" style={styles.policyCard}>
            <View style={styles.policyCopy}>
              <Text style={styles.policyTitle}>{document.title}</Text>
              <Text style={styles.policyBody}>{descriptions[document.slug]}</Text>
            </View>
            <Text style={styles.policyArrow}>View</Text>
          </Pressable>
        </Link>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageName: { color: palette.navy, fontSize: 15, lineHeight: 19, fontWeight: '900', marginBottom: 9 },
  hero: { borderRadius: 18, backgroundColor: palette.navy, padding: 13, marginBottom: 10 },
  heroCopy: { flex: 1, minWidth: 0 },
  heroTitle: { color: '#FFFFFF', fontSize: 15, lineHeight: 20, fontWeight: '900' },
  heroBody: { color: 'rgba(255,255,255,0.76)', fontSize: 11.5, lineHeight: 16, fontWeight: '700', marginTop: 4 },
  policyCard: { minHeight: 72, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', padding: 12, marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 11 },
  policyCopy: { flex: 1, minWidth: 0 },
  policyTitle: { color: palette.navy, fontSize: 14, fontWeight: '900' },
  policyBody: { color: palette.slate, fontSize: 11, lineHeight: 15, fontWeight: '700', marginTop: 3 },
  policyArrow: { color: '#0B63CE', fontSize: 11, fontWeight: '900' },
});
