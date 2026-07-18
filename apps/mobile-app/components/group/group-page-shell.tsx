import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';

import { useLoadingRouter, usePageLoading } from '@/components/app-loading';
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

export function GroupPageShell({ title, subtitle, icon = 'account-group-outline', children, rightAction, loading = false }: Props) {
  const router = useLoadingRouter();
  const pathname = usePathname();
  usePageLoading(loading, `Loading ${title}`);

  function goBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/customer/home');
    }
  }

  return <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
    <View style={styles.brandHeader}>
      <Pressable accessibilityRole="button" onPress={goBack} style={styles.backButton}>
        <MaterialCommunityIcons name="chevron-left" size={25} color={palette.ink} />
      </Pressable>
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
      <NavItem icon="home-variant" label="Home" active={pathname === '/customer/home'} onPress={() => router.replace('/customer/home')} />
      <NavItem icon="account-multiple-outline" label="Accounts" active={pathname.startsWith('/customer/group/accounts')} onPress={() => router.push('/customer/group/accounts')} />
      <NavItem icon="truck-outline" label="Fleet" active={pathname.startsWith('/customer/group/fleet')} onPress={() => router.push('/customer/group/fleet')} />
      <NavItem icon="shield-check-outline" label="Claims" active={pathname.startsWith('/customer/group/claims')} onPress={() => router.push('/customer/group/claims')} />
      <NavItem icon="account-outline" label="Profile" active={pathname.startsWith('/customer/group/profile')} onPress={() => router.push('/customer/group/profile')} />
    </View>
  </SafeAreaView>;
}

function NavItem({ icon, label, active, onPress }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; active: boolean; onPress: () => void }) {
  const color = active ? palette.navy : '#5F6B7A';
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.navItem, pressed && styles.navPressed]}><View style={[styles.navIcon, active && styles.navIconActive]}><MaterialCommunityIcons name={icon} size={19} color={color} /></View><Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F9FD' },
  brandHeader: { height: 66, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E1E7F0' },
  backButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFD', borderWidth: 1, borderColor: '#E1E7F0' },
  brand: { flex: 1, justifyContent: 'center' }, headerButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: palette.navy, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 }, content: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 14, gap: 10 },
  titlePanel: { minHeight: 82, borderRadius: 17, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: palette.navy, flexDirection: 'row', alignItems: 'center', gap: 11, overflow: 'hidden' },
  titleIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(245,183,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  titleCopy: { flex: 1, minWidth: 0 }, title: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' }, subtitle: { color: '#C9D7EF', fontSize: 10, lineHeight: 14, fontWeight: '600', marginTop: 3 },
  bottomNav: { minHeight: 82, marginHorizontal: 12, marginBottom: 8, paddingHorizontal: 6, paddingTop: 8, paddingBottom: 8, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: '#D9E5F4', flexDirection: 'row', alignItems: 'center', shadowColor: '#0B1220', shadowOpacity: 0.1, shadowRadius: 15, elevation: 5 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navPressed: { opacity: 0.74, transform: [{ scale: 0.98 }] },
  navIcon: { width: 40, height: 34, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F6FA' },
  navIconActive: { backgroundColor: '#EEF5FF', borderWidth: 1, borderColor: '#BFD8FF' },
  navLabel: { color: '#5F6B7A', fontSize: 9.5, fontWeight: '800', marginTop: 3 },
  navLabelActive: { color: palette.navy },
});
