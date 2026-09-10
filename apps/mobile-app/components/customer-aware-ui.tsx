import { usePathname } from 'expo-router';
import { isValidElement, type ComponentProps } from 'react';

import { CustomerPageSkeleton } from '@/components/customer-page-skeleton';
import { LoadingState as BaseLoadingState, Screen as BaseScreen } from './ui';

export {
  Button,
  Card,
  EmptyState,
  Message,
  NavLink,
  Row,
  TextField,
  UniversalBottomTabs,
  colors,
  styles,
} from './ui';

type LoadingStateProps = ComponentProps<typeof BaseLoadingState>;
type ScreenProps = ComponentProps<typeof BaseScreen>;

export function LoadingState({ label }: LoadingStateProps) {
  const pathname = usePathname();
  if (pathname.startsWith('/customer')) {
    return <CustomerPageSkeleton pathname={pathname} label={label} />;
  }
  return <BaseLoadingState label={label} />;
}

export function Screen(props: ScreenProps) {
  const pathname = usePathname();
  const { children } = props;
  const loadingOnly = isValidElement(children) && children.type === LoadingState;

  if (!loadingOnly) return <BaseScreen {...props} />;

  const loadingProps = children.props as LoadingStateProps;
  if (!pathname.startsWith('/customer')) {
    return (
      <BaseScreen {...props}>
        <BaseLoadingState label={loadingProps.label} />
      </BaseScreen>
    );
  }

  return (
    <BaseScreen {...props} showTitleHeader={false}>
      <CustomerPageSkeleton pathname={pathname} label={loadingProps.label} />
    </BaseScreen>
  );
}
