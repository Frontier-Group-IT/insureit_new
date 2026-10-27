import type { ComponentProps } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { partnerTheme } from '@/lib/theme';
import { usePartnerSession } from '@/providers/partner-session-provider';

type IconName = ComponentProps<typeof Ionicons>['name'];

export default function PartnerTabsLayout() {
  const { status } = usePartnerSession();
  const insets = useSafeAreaInsets();

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
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#AFC1DE',
        tabBarLabelStyle: styles.label,
        tabBarIconStyle: styles.icon,
        tabBarItemStyle: styles.item,
        tabBarStyle: [styles.tabBar, { height: 64 + insets.bottom, paddingBottom: 7 + insets.bottom }],
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
        <Ionicons name={focused ? active : inactive} color={color} size={focused ? 25 : 20} />
      </View>
    );
  };
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.canvas },
  tabBar: {
    height: 64,
    paddingTop: 5,
    paddingBottom: 7,
    backgroundColor: '#071E49',
    borderTopColor: '#173968',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  item: {
    minHeight: partnerTheme.control.minTouchTarget,
    paddingTop: 0,
  },
  icon: { marginTop: 0 },
  iconWrap: {
    width: 44,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: '#203F79',
  },
  label: {
    marginTop: 0,
    fontSize: 9.25,
    lineHeight: 12,
    fontWeight: Platform.OS === 'ios' ? '400' : '600',
  },
});
