import type { ReactElement, ReactNode } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  type FlatListProps,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { partnerTheme } from '@/lib/theme';

export function PartnerListScreen<T>({
  title,
  eyebrow,
  action,
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
  action?: ReactNode;
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
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, !data.length && styles.contentEmpty]}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View style={styles.headerText}>
                {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
                <Text accessibilityRole="header" style={styles.title}>{title}</Text>
              </View>
              {action ? <View style={styles.action}>{action}</View> : null}
            </View>
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
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: partnerTheme.colors.canvas },
  content: {
    paddingHorizontal: partnerTheme.spacing.lg,
    paddingBottom: 104,
  },
  contentEmpty: { flexGrow: 1 },
  header: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: partnerTheme.spacing.md,
  },
  headerText: { flex: 1 },
  eyebrow: {
    color: partnerTheme.colors.brand,
    letterSpacing: 1.35,
    ...partnerTheme.typography.eyebrow,
  },
  title: {
    marginTop: 2,
    color: partnerTheme.colors.ink,
    ...partnerTheme.typography.pageTitle,
  },
  action: {
    minWidth: partnerTheme.control.minTouchTarget,
    minHeight: partnerTheme.control.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
