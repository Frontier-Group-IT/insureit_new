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
      <View style={styles.iconWrap}>
        <View style={[styles.activeMark, !focused && styles.activeMarkHidden]} />
        <Ionicons name={focused ? active : inactive} color={color} size={21} />
      </View>
    );
  };
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.canvas },
  tabBar: {
    height: 76,
    paddingTop: 4,
    paddingBottom: 9,
    backgroundColor: partnerTheme.colors.surface,
    borderTopColor: partnerTheme.colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  item: {
    minHeight: partnerTheme.control.minTouchTarget,
    paddingTop: 1,
  },
  icon: { marginTop: 0 },
  iconWrap: {
    width: 38,
    height: 30,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  activeMark: {
    position: 'absolute',
    top: 0,
    width: 16,
    height: 2,
    borderRadius: partnerTheme.radius.pill,
    backgroundColor: partnerTheme.colors.brand,
  },
  activeMarkHidden: { opacity: 0 },
  label: {
    marginTop: 1,
    fontSize: 9.5,
    lineHeight: 13,
    fontWeight: '600',
  },
});
