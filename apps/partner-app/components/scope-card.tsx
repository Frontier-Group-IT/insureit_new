import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { PartnerCommercialScope } from '@/lib/partner-session';
import { partnerTheme } from '@/lib/theme';

export function ScopeCard({ scope }: { scope: PartnerCommercialScope }) {
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name="shield-checkmark-outline" size={20} color={partnerTheme.colors.accent} />
      </View>
      <View style={styles.body}>
        <Text style={styles.eyebrow}>AUTHORIZED BUSINESS SCOPE</Text>
        <Text style={styles.title}>{scopeLabel(scope.scope_mode)}</Text>
        <Text style={styles.copy}>This view is generated from your server-authorized commercial relationships.</Text>
      </View>
    </View>
  );
}

function scopeLabel(mode: PartnerCommercialScope['scope_mode']) {
  if (mode === 'partner_family') return 'My Partner family';
  if (mode === 'hierarchy') return 'My sales hierarchy';
  if (mode === 'organization') return 'Organization-wide';
  if (mode === 'self') return 'My business';
  return 'No commercial scope';
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 13,
    borderRadius: partnerTheme.radius.lg,
    backgroundColor: partnerTheme.colors.accentSoft,
    padding: 17,
    borderWidth: 1,
    borderColor: '#CDEAE7',
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: partnerTheme.colors.surface,
  },
  body: { flex: 1 },
  eyebrow: { color: '#3C7B78', fontSize: 8.5, fontWeight: '800', letterSpacing: 1.15 },
  title: { marginTop: 4, color: partnerTheme.colors.ink, fontSize: 16, fontWeight: '700' },
  copy: { marginTop: 5, color: '#56716F', fontSize: 10.5, lineHeight: 16 },
});
