import type { ReactElement, ReactNode } from 'react';
import {
  type ImageSourcePropType,
  FlatList,
  StyleSheet,
  View,
  type FlatListProps,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PartnerTopBar } from '@/components/ui/partner-top-bar';
import { partnerTheme } from '@/lib/theme';

export function PartnerListScreen<T>({
  title,
  eyebrow,
  onBack,
  artwork,
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
  onBack?: () => void;
  artwork?: ImageSourcePropType;
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
            <PartnerTopBar title={title} eyebrow={eyebrow} onBack={onBack} artwork={artwork} action={action} />
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
});