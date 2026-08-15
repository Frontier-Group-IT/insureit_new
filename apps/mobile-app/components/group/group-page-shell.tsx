import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ReactNode, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';

import { useLoadingRouter, usePageLoading } from '@/components/app-loading';
import { BrandLogo } from '@/components/first-look';
import { NotificationBell } from '@/components/realtime-notifications';
import { UniversalBottomTabs } from '@/components/ui';
import { getSelectedCustomerContext, type CustomerAccountContext } from '@/lib/customer-context';
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
  const [customerContext, setCustomerContext] = useState<CustomerAccountContext | null | undefined>(undefined);
  usePageLoading(loading, `Loading ${title}`);

  useEffect(() => {
    let active = true;
    void getSelectedCustomerContext().then((context) => {
      if (active) setCustomerContext(context);
    }).catch(() => {
      if (active) setCustomerContext(null);
    });
    return () => {
      active = false;
    };
  }, []);

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

    {customerContext !== undefined ? <UniversalBottomTabs role="customer" pathname={pathname} bottomInset={0} customerContext={customerContext} /> : null}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F9FD' },
  brandHeader: { height: 66, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E1E7F0' },
  backButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFD', borderWidth: 1, borderColor: '#E1E7F0' },
  brand: { flex: 1, justifyContent: 'center' }, headerButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: palette.navy, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 }, content: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 112, gap: 10 },
  titlePanel: { minHeight: 82, borderRadius: 17, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: palette.navy, flexDirection: 'row', alignItems: 'center', gap: 11, overflow: 'hidden' },
  titleIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(245,183,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  titleCopy: { flex: 1, minWidth: 0 }, title: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' }, subtitle: { color: '#C9D7EF', fontSize: 10, lineHeight: 14, fontWeight: '600', marginTop: 3 },
});
