import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { PartnerBottomSheet } from '@/components/ui/partner-bottom-sheet';
import { partnerTheme } from '@/lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type PartnerOverflowAction = {
  key: string;
  label: string;
  icon?: IconName;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  onPress: () => void;
};

export function PartnerOverflowMenu({
  visible,
  title = 'More actions',
  actions,
  onClose,
}: {
  visible: boolean;
  title?: string;
  actions: PartnerOverflowAction[];
  onClose: () => void;
}) {
  return (
    <PartnerBottomSheet onClose={onClose} scrollable={false} title={title} visible={visible}>
      <View>
        {actions.map((action, index) => {
          const danger = action.tone === 'danger';
          const foreground = danger ? partnerTheme.colors.danger : partnerTheme.colors.ink;
          return (
            <Pressable
              accessibilityLabel={action.label}
              accessibilityRole="button"
              accessibilityState={{ disabled: Boolean(action.disabled) }}
              disabled={action.disabled}
              key={action.key}
              onPress={() => {
                onClose();
                action.onPress();
              }}
              style={({ pressed }) => [
                styles.row,
                index < actions.length - 1 && styles.rowBorder,
                pressed && !action.disabled && styles.pressed,
                action.disabled && styles.disabled,
              ]}
            >
              {action.icon ? (
                <View style={[styles.iconBox, danger && styles.iconBoxDanger]}>
                  <Ionicons name={action.icon} size={19} color={foreground} />
                </View>
              ) : null}
              <Text style={[styles.label, { color: foreground }]}>{action.label}</Text>
              <Ionicons name="chevron-forward" size={17} color="#A0A8B6" />
            </Pressable>
          );
        })}
      </View>
    </PartnerBottomSheet>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: partnerTheme.colors.line,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: partnerTheme.colors.surfaceMuted,
  },
  iconBoxDanger: {
    backgroundColor: partnerTheme.colors.dangerSoft,
  },
  label: {
    flex: 1,
    ...partnerTheme.typography.bodyStrong,
  },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.4 },
});
