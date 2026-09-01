import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';

import { partnerTheme } from '@/lib/theme';

export type PartnerTopTab = {
  key: string;
  label: string;
  badge?: number | string;
  disabled?: boolean;
};

export function PartnerTopTabs({
  tabs,
  activeKey,
  onChange,
  accessibilityLabel = 'Sections',
}: {
  tabs: PartnerTopTab[];
  activeKey: string;
  onChange: (key: string) => void;
  accessibilityLabel?: string;
}) {
  return (
    <ScrollView
      accessibilityLabel={accessibilityLabel}
      horizontal
      contentContainerStyle={styles.content}
      showsHorizontalScrollIndicator={false}
    >
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active, disabled: Boolean(tab.disabled) }}
            disabled={tab.disabled}
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={({ pressed }) => [
              styles.tab,
              active && styles.tabActive,
              pressed && !tab.disabled && styles.pressed,
              tab.disabled && styles.disabled,
            ]}
          >
            <View style={styles.labelRow}>
              <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
              {tab.badge !== undefined ? (
                <View style={[styles.badge, active && styles.badgeActive]}>
                  <Text style={[styles.badgeText, active && styles.badgeTextActive]}>{tab.badge}</Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 22,
    paddingHorizontal: 1,
  },
  tab: {
    minHeight: partnerTheme.control.minTouchTarget,
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: partnerTheme.colors.brand,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    color: partnerTheme.colors.inkMuted,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '600',
  },
  labelActive: {
    color: partnerTheme.colors.ink,
    fontWeight: '700',
  },
  badge: {
    minWidth: 19,
    height: 19,
    paddingHorizontal: 5,
    borderRadius: partnerTheme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: partnerTheme.colors.surfaceMuted,
  },
  badgeActive: {
    backgroundColor: partnerTheme.colors.brandSoft,
  },
  badgeText: {
    color: partnerTheme.colors.inkMuted,
    ...partnerTheme.typography.meta,
  },
  badgeTextActive: {
    color: partnerTheme.colors.brandStrong,
  },
  pressed: { opacity: 0.68 },
  disabled: { opacity: 0.4 },
});
