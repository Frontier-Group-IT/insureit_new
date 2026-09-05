import type { PropsWithChildren, ReactNode } from 'react';
import { type ImageSourcePropType, ScrollView, StyleSheet, type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PartnerTopBar } from '@/components/ui/partner-top-bar';
import { partnerTheme } from '@/lib/theme';

export function PartnerScreen({
  title,
  eyebrow,
  subtitle,
  onBack,
  backDisabled,
  artwork,
  action,
  children,
  scrollProps,
}: PropsWithChildren<{
  title: string;
  eyebrow?: string;
  subtitle?: string;
  onBack?: () => void;
  backDisabled?: boolean;
  artwork?: ImageSourcePropType;
  action?: ReactNode;
  scrollProps?: Omit<ScrollViewProps, 'contentContainerStyle'>;
}>) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        {...scrollProps}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps={scrollProps?.keyboardShouldPersistTaps ?? 'handled'}
      >
        <PartnerTopBar
          title={title}
          eyebrow={eyebrow}
          subtitle={subtitle}
          onBack={onBack}
          backDisabled={backDisabled}
          artwork={artwork}
          action={action}
        />
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: partnerTheme.colors.canvas },
  content: {
    flexGrow: 1,
    paddingHorizontal: partnerTheme.spacing.lg,
    paddingBottom: 104,
  },
});