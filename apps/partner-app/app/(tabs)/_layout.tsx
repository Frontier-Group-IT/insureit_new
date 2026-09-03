import type { ComponentProps } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { partnerTheme } from '@/lib/theme';
import { usePartnerSession } from '@/providers/partner-session-provider';

type IconName = ComponentProps<typeof Ionicons>['name'];

export default function PartnerTabsLayout() {
  const { status } = usePartnerSession();

  if (status === 'loading') {
    return <View style={styles.loading}><ActivityIndicator color={partnerTheme.colors.brand} /></View>;
  }
  if (status === 'signed_out') return <Redirect href="/login" />;
  if (status === 'denied') return <Redirect href="/access-denied" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: partnerTheme.colors.brandStrong,
        tabBarInactiveTintColor: partnerTheme.colors.inkSubtle,
        tabBarLabelStyle: styles.label,
        tabBarIconStyle: styles.icon,
        tabBarItemStyle: styles.item,
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon('home-outline', 'home') }} />
      <Tabs.Screen name="business" options={{ title: 'Business', tabBarIcon: tabIcon('briefcase-outline', 'briefcase') }} />
      <Tabs.Screen name="policies" options={{ title: 'Policies', tabBarIcon: tabIcon('document-text-outline', 'document-text') }} />
      <Tabs.Screen name="claims" options={{ title: 'Claims', tabBarIcon: tabIcon('shield-outline', 'shield') }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: tabIcon('grid-outline', 'grid') }} />
    </Tabs>
  );
}

function tabIcon(inactive: IconName, active: IconName) {
  return function PartnerTabIcon({ color, focused }: { color: string; size: number; focused: boolean }) {
    return (
      <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
        <Ionicons name={focused ? active : inactive} color={color} size={20} />
      </View>
    );
  };
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.canvas },
  tabBar: {
    height: 70,
    paddingTop: 5,
    paddingBottom: 7,
    backgroundColor: partnerTheme.colors.surface,
    borderTopColor: partnerTheme.colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  item: {
    minHeight: partnerTheme.control.minTouchTarget,
    paddingTop: 0,
  },
  icon: { marginTop: 0 },
  iconWrap: {
    width: 40,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: partnerTheme.colors.brandSoft,
  },
  label: {
    marginTop: 0,
    fontSize: 9.25,
    lineHeight: 12,
    fontWeight: '600',
  },
});
