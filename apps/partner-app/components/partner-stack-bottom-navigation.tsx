import { useEffect, useState, type ComponentProps } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { canPartnerAccess } from '@/lib/partner-permissions';
import { usePartnerSession } from '@/providers/partner-session-provider';

export type PartnerTabDestination = '/(tabs)' | '/(tabs)/business' | '/(tabs)/policies' | '/(tabs)/claims' | '/(tabs)/more';
type TabKey = 'home' | 'business' | 'policies' | 'claims' | 'more';
type IconName = ComponentProps<typeof Ionicons>['name'];

const tabs: Array<{ key: TabKey; label: string; href: PartnerTabDestination; inactive: IconName; active: IconName }> = [
  { key: 'home', label: 'Home', href: '/(tabs)', inactive: 'home-outline', active: 'home' },
  { key: 'business', label: 'Business', href: '/(tabs)/business', inactive: 'briefcase-outline', active: 'briefcase' },
  { key: 'policies', label: 'Policies', href: '/(tabs)/policies', inactive: 'document-text-outline', active: 'document-text' },
  { key: 'claims', label: 'Claims', href: '/(tabs)/claims', inactive: 'shield-outline', active: 'shield' },
  { key: 'more', label: 'More', href: '/(tabs)/more', inactive: 'grid-outline', active: 'grid' },
];

/** Show the Home tab bar on authorized Stack screens without nesting another Tabs navigator. */
export function PartnerStackBottomNavigation({
  activeTab,
  onNavigate,
  includeBottomInset = false,
}: {
  activeTab: TabKey;
  onNavigate?: (destination: PartnerTabDestination) => void;
  /** Standalone SafeAreaView screens own the bottom inset; PartnerScreen already applies it. */
  includeBottomInset?: boolean;
}) {
  const router = useRouter();
  const { context } = usePartnerSession();
  const insets = useSafeAreaInsets();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  if (keyboardOpen) return null;

  return (
    <View style={[styles.bar, includeBottomInset && { paddingBottom: 7 + insets.bottom, height: 64 + insets.bottom }]}>
      {tabs.map((tab) => {
        const permitted = tab.key === 'more'
          || (tab.key === 'claims' ? canPartnerAccess(context, 'view_claims')
            : tab.key === 'policies' ? canPartnerAccess(context, 'view_policies')
              : canPartnerAccess(context, 'view_dashboard'));
        if (!permitted) return <View key={tab.key} style={styles.item} />;
        const selected = tab.key === activeTab;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            onPress={() => onNavigate ? onNavigate(tab.href) : router.navigate(tab.href as never)}
            style={styles.item}
          >
            <View style={[styles.iconWrap, selected && styles.iconWrapActive]}>
              <Ionicons name={selected ? tab.active : tab.inactive} size={selected ? 25 : 20} color={selected ? '#FFFFFF' : '#AFC1DE'} />
            </View>
            <Text style={[styles.label, selected && styles.selectedLabel]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 64, paddingTop: 5, paddingBottom: 7, flexDirection: 'row', backgroundColor: '#071E49', borderTopColor: '#173968', borderTopWidth: StyleSheet.hairlineWidth },
  item: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { width: 44, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  iconWrapActive: { backgroundColor: '#203F79' },
  label: { marginTop: 0, fontSize: 9.25, lineHeight: 12, fontWeight: Platform.OS === 'ios' ? '400' : '600', color: '#AFC1DE' },
  selectedLabel: { color: '#FFFFFF' },
});
