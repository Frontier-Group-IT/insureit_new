import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { partnerTheme } from '@/lib/theme';
import { usePartnerSession } from '@/providers/partner-session-provider';

export default function MoreScreen() {
  const router = useRouter();
  const { context, signOut } = usePartnerSession();
  if (!context) return null;

  async function logout() {
    await signOut();
    router.replace('/login');
  }

  return (
    <PartnerScreen eyebrow="ACCOUNT" title="More">
      <View style={styles.profileCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials(context.identity.display_name)}</Text></View>
        <View style={styles.profileBody}>
          <Text style={styles.profileName}>{context.identity.display_name}</Text>
          <Text style={styles.profileMeta}>{context.identity.actor_kind === 'employee' ? humanize(context.identity.role) : humanize(context.identity.intermediary_type)}</Text>
        </View>
      </View>

      <View style={styles.menu}>
        <MenuRow icon="document-text-outline" title="Policy Intake" subtitle="Submit policy copies to the existing Operations review queue." onPress={() => router.push("/policy-intakes")} />
        <MenuRow icon="refresh-outline" title="Renewals" subtitle="Policies due in the next 30 days and expired policies." onPress={() => router.push("/renewals")} />
        <MenuRow icon="people-outline" title="Customers" subtitle="Authorized customer book for your commercial scope." onPress={() => router.push("/customers")} />
        <MenuRow icon="notifications-outline" title="Activity" subtitle="Recent policy and claim activity in one timeline." onPress={() => router.push("/activity")} />
        <MenuRow icon="person-outline" title="Profile & registration" subtitle="Your resolved Partner or employee identity and scope." onPress={() => router.push("/profile")} />
      </View>

      <Pressable onPress={logout} style={styles.logout}>
        <Ionicons name="log-out-outline" size={17} color={partnerTheme.colors.danger} />
        <Text style={styles.logoutText}>Sign out</Text>
      </Pressable>
    </PartnerScreen>
  );
}

function MenuRow({ icon, title, subtitle, onPress }: { icon: 'document-text-outline' | 'refresh-outline' | 'people-outline' | 'notifications-outline' | 'person-outline'; title: string; subtitle: string; onPress?: () => void }) {
  const content = (
    <View style={styles.row}>
      <View style={styles.rowIcon}><Ionicons name={icon} size={18} color={partnerTheme.colors.brand} /></View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#A0A8B6" />
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'IP';
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: partnerTheme.radius.lg, padding: 17, backgroundColor: partnerTheme.colors.nav },
  avatar: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#383F52' },
  avatarText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  profileBody: { flex: 1 },
  profileName: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  profileMeta: { marginTop: 3, color: '#C5CCDA', fontSize: 9.5 },
  menu: { marginTop: 16, overflow: 'hidden', borderRadius: partnerTheme.radius.lg, backgroundColor: partnerTheme.colors.surface, borderWidth: 1, borderColor: partnerTheme.colors.line },
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line },
  rowIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.brandSoft },
  rowBody: { flex: 1 },
  rowTitle: { color: partnerTheme.colors.ink, fontSize: 11.5, fontWeight: '700' },
  rowSubtitle: { marginTop: 3, color: partnerTheme.colors.inkMuted, fontSize: 9, lineHeight: 13 },
  logout: { marginTop: 16, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: partnerTheme.radius.md, borderWidth: 1, borderColor: '#F2C8C5', backgroundColor: '#FFF7F6' },
  logoutText: { color: partnerTheme.colors.danger, fontSize: 11, fontWeight: '700' },
});
