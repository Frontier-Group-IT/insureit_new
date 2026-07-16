import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/first-look';
import { NotificationBell } from '@/components/realtime-notifications';
import { palette } from '@/lib/theme';

type Props = {
  title: string;
  subtitle?: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  children: ReactNode;
  rightAction?: ReactNode;
  loading?: boolean;
};

export function GroupPageShell({ title, subtitle, icon = 'account-group-outline', children, rightAction }: Props) {
  const router = useRouter();
  return <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
    <View style={styles.brandHeader}>
      <Pressable onPress={() => router.replace('/customer/home')} style={styles.brand}><BrandLogo width={158} /></Pressable>
      <Pressable onPress={() => router.push('/customer/notifications')} style={styles.headerButton}><NotificationBell /></Pressable>
      <Pressable onPress={() => router.push('/customer/group/profile')} style={styles.avatar}><MaterialCommunityIcons name="account-outline" size={21} color="#FFFFFF" /></Pressable>
    </View>

    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.titlePanel}>
        <View style={styles.titleIcon}><MaterialCommunityIcons name={icon} size={25} color="#F5B700" /></View>
        <View style={styles.titleCopy}><Text style={styles.title}>{title}</Text>{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}</View>
        {rightAction}
      </View>
      {children}
    </ScrollView>

    <View style={styles.bottomNav}>
      <NavItem icon="home-variant" label="Home" onPress={() => router.replace('/customer/home')} />
      <NavItem icon="account-multiple-outline" label="Accounts" onPress={() => router.push('/customer/group/accounts')} />
      <NavItem icon="truck-outline" label="Fleet" onPress={() => router.push('/customer/group/fleet')} />
      <NavItem icon="shield-check-outline" label="Claims" onPress={() => router.push('/customer/group/claims')} />
      <NavItem icon="account-outline" label="Profile" onPress={() => router.push('/customer/group/profile')} />
    </View>
  </SafeAreaView>;
}

function NavItem({ icon, label, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.navItem}><View style={styles.navIcon}><MaterialCommunityIcons name={icon} size={19} color="#5F6B7A" /></View><Text style={styles.navLabel}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F9FD' },
  brandHeader: { height: 66, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E1E7F0' },
  brand: { flex: 1, justifyContent: 'center' }, headerButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: palette.navy, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 }, content: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 14, gap: 10 },
  titlePanel: { minHeight: 82, borderRadius: 17, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: palette.navy, flexDirection: 'row', alignItems: 'center', gap: 11, overflow: 'hidden' },
  titleIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(245,183,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  titleCopy: { flex: 1, minWidth: 0 }, title: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' }, subtitle: { color: '#C9D7EF', fontSize: 10, lineHeight: 14, fontWeight: '600', marginTop: 3 },
  bottomNav: { minHeight: 76, paddingHorizontal: 8, paddingTop: 6, paddingBottom: 6, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E3E8F0', flexDirection: 'row', alignItems: 'center' },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' }, navIcon: { width: 38, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, navLabel: { color: '#5F6B7A', fontSize: 9.5, fontWeight: '800', marginTop: 1 },
});