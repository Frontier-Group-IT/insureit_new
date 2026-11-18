import type { ReactElement, ReactNode } from 'react';
import {
  type ImageSourcePropType,
  FlatList,
  StyleSheet,
  View,
  type FlatListProps,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useIsFocused } from '@react-navigation/native';

import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerTopBar } from '@/components/ui/partner-top-bar';
import { partnerTheme } from '@/lib/theme';
import { usePartnerNetwork } from '@/providers/partner-network-provider';

export function PartnerListScreen<T>({
  title,
  eyebrow,
  onBack,
  artwork,
  showArtwork = true,
  action,
  topBar,
  navyStatusBar = false,
  bottomNavigation,
  data,
  renderItem,
  keyExtractor,
  header,
  footer,
  empty,
  refreshing = false,
  onRefresh,
  onEndReached,
  ItemSeparatorComponent,
}: {
  title: string;
  eyebrow?: string;
  onBack?: () => void;
  artwork?: ImageSourcePropType;
  showArtwork?: boolean;
  action?: ReactNode;
  topBar?: ReactNode;
  /** Opt-in navy status/safe area for stack screens without changing other lists. */
  navyStatusBar?: boolean;
  /** Fixed navigation below the scrollable list, outside the FlatList. */
  bottomNavigation?: ReactNode;
  data: readonly T[];
  renderItem: ListRenderItem<T>;
  keyExtractor: (item: T, index: number) => string;
  header?: ReactElement | null;
  footer?: ReactElement | null;
  empty?: ReactElement | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  onEndReached?: FlatListProps<T>['onEndReached'];
  ItemSeparatorComponent?: FlatListProps<T>['ItemSeparatorComponent'];
}) {
  const { isOffline } = usePartnerNetwork();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, navyStatusBar && styles.navyStatusArea]}>
    <SafeAreaView style={[styles.safeArea, navyStatusBar && styles.navyStatusArea]} edges={['top']}>
      <FlatList
        style={styles.listCanvas}
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, !data.length && styles.contentEmpty]}
        ListHeaderComponent={
          <View>
            {topBar ?? <PartnerTopBar title={title} eyebrow={eyebrow} onBack={onBack} artwork={artwork} showArtwork={showArtwork} action={action} />}
            {isOffline ? (
              <View style={styles.networkBanner}>
                <PartnerBanner
                  tone="warning"
                  title="You're offline"
                  message="Available cached information remains visible. Reconnect to refresh or submit changes."
                />
              </View>
            ) : null}
            {header}
          </View>
        }
        ListFooterComponent={footer}
        ListEmptyComponent={empty}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.45}
        ItemSeparatorComponent={ItemSeparatorComponent}
        removeClippedSubviews
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
      />
    </SafeAreaView>
    {bottomNavigation ? <View style={[styles.bottomNavigation, { paddingBottom: insets.bottom }]}>{bottomNavigation}</View> : null}
    {navyStatusBar && isFocused ? <StatusBar style="light" backgroundColor="#071E49" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: partnerTheme.colors.canvas },
  safeArea: { flex: 1, backgroundColor: partnerTheme.colors.canvas },
  navyStatusArea: { backgroundColor: '#071E49' },
  listCanvas: { backgroundColor: partnerTheme.colors.canvas },
  bottomNavigation: { backgroundColor: '#071E49' },
  content: {
    paddingHorizontal: partnerTheme.spacing.lg,
    paddingBottom: 104,
  },
  contentEmpty: { flexGrow: 1 },
  networkBanner: { marginBottom: partnerTheme.spacing.sm },
});
