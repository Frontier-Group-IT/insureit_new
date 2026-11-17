import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { canPartnerAccess } from '@/lib/partner-permissions';
import { usePartnerSession } from '@/providers/partner-session-provider';

/** Stack-screen companion to the permission-gated Home tab bar. */
export function PartnerCaseBottomNavigation({ activeTab }: { activeTab?: 'Home' | 'Business' | 'Policies' | 'Claims' | 'More' } = {}) {
  const router = useRouter();
  const { context } = usePartnerSession();
  const items = [
    { label: 'Home', route: '/(tabs)', icon: 'home-outline', allowed: canPartnerAccess(context, 'view_dashboard') },
    { label: 'Business', route: '/(tabs)/business', icon: 'briefcase-outline', allowed: canPartnerAccess(context, 'view_dashboard') },
    { label: 'Policies', route: '/(tabs)/policies', icon: 'document-text-outline', allowed: canPartnerAccess(context, 'view_policies') },
    { label: 'Claims', route: '/(tabs)/claims', icon: 'shield-outline', allowed: canPartnerAccess(context, 'view_claims') },
    { label: 'More', route: '/(tabs)/more', icon: 'grid-outline', allowed: true },
  ] as const;
  return (
    <View style={styles.bar}>
      {items.filter(item => item.allowed).map(item => (
        <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label}
          onPress={() => router.navigate(item.route as never)} style={styles.item}
          accessibilityState={{ selected: activeTab === item.label }}>
          <View style={[styles.iconWrap, activeTab === item.label && styles.iconWrapActive]}>
            <Ionicons name={item.icon} color={activeTab === item.label ? '#FFFFFF' : '#AFC1DE'} size={activeTab === item.label ? 24 : 20} />
          </View>
          <Text style={[styles.label, activeTab === item.label && styles.activeLabel]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  bar: { minHeight: 57, flexDirection: 'row', backgroundColor: '#071E49', borderTopColor: '#173968', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 5, paddingBottom: 7 },
  item: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 2 },
  iconWrap: { width: 44, height: 31, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  iconWrapActive: { backgroundColor: '#203F79' },
  activeLabel: { color: '#FFFFFF' },
  label: { color: '#AFC1DE', fontSize: 9.25, lineHeight: 12, fontWeight: Platform.OS === 'ios' ? '400' : '600' },
});
