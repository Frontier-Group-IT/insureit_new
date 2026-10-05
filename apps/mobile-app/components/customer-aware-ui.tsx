import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Children,
  isValidElement,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CustomerAccountSwitcherButton } from '@/components/customer-account-switcher';
import { BrandLogo } from '@/components/first-look';
import { CustomerPageSkeleton } from '@/components/customer-page-skeleton';
import { NotificationBell } from '@/components/realtime-notifications';
import { getCurrentSession, getProfile } from '@/lib/auth';
import {
  getSelectedCustomerContext,
  isPortfolioCustomerContext,
  type CustomerAccountContext,
} from '@/lib/customer-context';
import { palette, roleTheme } from '@/lib/theme';
import {
  LoadingState as BaseLoadingState,
  Screen as BaseScreen,
  UniversalBottomTabs as BaseUniversalBottomTabs,
  styles as baseStyles,
} from './ui';

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
type SplitChildren = { floating: ReactNode[]; sticky: ReactNode[]; body: ReactNode[] };

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

  if (!pathname.startsWith('/customer')) {
    if (!loadingOnly) return <BaseScreen {...props} />;
    const loadingProps = children.props as LoadingStateProps;
    return (
      <BaseScreen {...props}>
        <BaseLoadingState label={loadingProps.label} />
      </BaseScreen>
    );
  }

  const loadingProps = loadingOnly ? (children.props as LoadingStateProps) : null;
  return (
    <CustomerFixedScreen {...props}>
      {loadingOnly ? <CustomerPageSkeleton pathname={pathname} label={loadingProps?.label} /> : children}
    </CustomerFixedScreen>
  );
}

function CustomerFixedScreen({
  title,
  subtitle,
  children,
  showTitleHeader = true,
  showBackNavigation = true,
  topSpacing = 'default',
}: ScreenProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [profileInitial, setProfileInitial] = useState('I');
  const [customerContext, setCustomerContext] = useState<CustomerAccountContext | null | undefined>(undefined);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const showBackButton = showBackNavigation && pathname !== '/customer/home';
  const loadingOnly = isValidElement(children) && children.type === CustomerPageSkeleton;
  const split = useMemo(
    () => splitCustomerChildren(pathname, children, Boolean(showTitleHeader), loadingOnly),
    [children, loadingOnly, pathname, showTitleHeader],
  );
  const fixedTopPadding = insets.top + topPaddingFor(topSpacing);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const session = await getCurrentSession();
        if (!session?.user || !active) return;
        const [profile, context] = await Promise.all([
          getProfile(session.user.id),
          getSelectedCustomerContext(),
        ]);
        if (!active) return;
        setProfileInitial(initialFor(profile?.full_name ?? session.user.email ?? 'InsureIT'));
        setCustomerContext(context);
      } catch {
        if (active) {
          setProfileInitial('I');
          setCustomerContext(null);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [pathname]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  function openBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(customerBackTarget(pathname, params, customerContext) as never);
  }

  return (
    <>
      <StatusBar style="light" backgroundColor={palette.navy} />
      <SafeAreaView style={baseStyles.safeArea} edges={[]}>
        <View pointerEvents="none" style={baseStyles.backdropTop} />
        <View pointerEvents="none" style={baseStyles.backdropBand} />
        <View
          pointerEvents="none"
          style={[baseStyles.customerHeaderContentDimmer, { height: insets.top + 58 }]}
        />

        <View style={[baseStyles.fixedBrandRow, baseStyles.customerFixedBrandRow, { top: insets.top }]}>
          {showBackButton ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={openBack}
              style={[baseStyles.backButton, baseStyles.customerBackButton]}
            >
              <MaterialCommunityIcons name="chevron-left" size={25} color="#FFFFFF" />
            </Pressable>
          ) : null}
          <View style={baseStyles.fixedBrandSlot}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open dashboard"
              onPress={() => router.replace('/customer/home')}
              style={baseStyles.fixedBrandPressable}
            >
              <BrandLogo width={132} inverse />
            </Pressable>
          </View>
          <View style={baseStyles.customerBellShell}>
            <NotificationBell color="#FFFFFF" />
          </View>
          <CustomerAccountSwitcherButton initial={profileInitial} />
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={baseStyles.keyboard}>
          <View style={[localStyles.fixedPageArea, { paddingTop: fixedTopPadding }]}>
            {showTitleHeader && !loadingOnly ? (
              <View style={baseStyles.header}>
                <View style={baseStyles.headerTop}>
                  <View style={[baseStyles.headerDot, { backgroundColor: roleTheme.customer.accent }]} />
                  <Text style={baseStyles.roleEyebrow}>Customer</Text>
                </View>
                <Text style={baseStyles.title}>{title}</Text>
                {subtitle ? <Text style={baseStyles.subtitle}>{subtitle}</Text> : null}
              </View>
            ) : null}
            {split.sticky.length ? <View style={localStyles.stickyStack}>{split.sticky}</View> : null}
          </View>

          {split.floating}

          <ScrollView
            style={baseStyles.screen}
            contentContainerStyle={[
              baseStyles.screenContent,
              localStyles.scrollBody,
              loadingOnly && localStyles.loadingBody,
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets
          >
            {split.body}
          </ScrollView>

          {!keyboardVisible && customerContext !== undefined ? (
            <BaseUniversalBottomTabs
              role="customer"
              pathname={pathname}
              bottomInset={insets.bottom}
              customerContext={customerContext}
            />
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

function splitCustomerChildren(
  pathname: string,
  children: ReactNode,
  showTitleHeader: boolean,
  loadingOnly: boolean,
): SplitChildren {
  const items = Children.toArray(children);
  if (loadingOnly) return { floating: [], sticky: [], body: items };

  const floating: ReactNode[] = [];
  const content: ReactNode[] = [];
  for (const child of items) {
    if (isTransientOverlay(child)) floating.push(child);
    else content.push(child);
  }

  if (showTitleHeader) return { floating, sticky: [], body: content };

  const normalizedPath = normalizeCustomerListPath(pathname);
  let stickyCount = 1;
  if (normalizedPath === '/customer/vehicles') stickyCount = 2;
  else if (normalizedPath === '/customer/policies') stickyCount = 2;
  else if (normalizedPath === '/customer/claims') stickyCount = 3;
  else if (normalizedPath === '/customer/profile') stickyCount = 1;

  const sticky: ReactNode[] = [];
  const body = [...content];

  for (let index = 0; index < stickyCount && body.length; index += 1) {
    const candidate = body[0];
    if (normalizedPath === '/customer/vehicles' && index === 1 && !isNativeView(candidate)) break;
    sticky.push(body.shift()!);
  }

  return { floating, sticky, body };
}

function isTransientOverlay(child: ReactNode) {
  if (!isValidElement(child)) return false;
  const props = child.props as { accessibilityLabel?: string };
  return props.accessibilityLabel === 'Close policy category menu';
}

function isNativeView(child: ReactNode) {
  return isValidElement(child) && child.type === View;
}

function normalizeCustomerListPath(pathname: string) {
  if (pathname === '/customer/group/fleet') return '/customer/vehicles';
  if (pathname === '/customer/group/policies') return '/customer/policies';
  if (pathname === '/customer/group/claims') return '/customer/claims';
  if (pathname === '/customer/group/profile') return '/customer/profile';
  return pathname;
}

function customerBackTarget(
  pathname: string,
  params: Record<string, string | string[]>,
  context?: CustomerAccountContext | null,
) {
  const portfolio = isPortfolioCustomerContext(context);
  const id = routeParam(params, 'id');
  const claimId = routeParam(params, 'claimId');

  if (pathname === '/customer/claim-detail') return portfolio ? '/customer/group/claims' : '/customer/claims';
  if (pathname === '/customer/policy-detail') return portfolio ? '/customer/group/policies' : '/customer/policies';
  if (pathname === '/customer/vehicle-detail') return portfolio ? '/customer/group/fleet' : '/customer/vehicles';
  if (pathname === '/customer/upload-documents') {
    return claimId ? { pathname: '/customer/claim-detail', params: { id: claimId } } : '/customer/home';
  }
  if (pathname === '/customer/report-accident') return portfolio ? '/customer/group/claims' : '/customer/home';
  if (pathname === '/customer/add-vehicle') return portfolio ? '/customer/group/fleet' : '/customer/vehicles';
  if (pathname === '/customer/add-policy') return portfolio ? '/customer/group/policies' : '/customer/policies';
  if (pathname.startsWith('/customer/legal')) return '/customer/insurance-quote';
  if (pathname.startsWith('/customer/group/')) return '/customer/home';
  if (id && pathname.includes('detail')) return '/customer/home';
  return '/customer/home';
}

function routeParam(params: Record<string, string | string[]>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function initialFor(name: string) {
  return name.trim().charAt(0).toUpperCase() || 'I';
}

function topPaddingFor(spacing: ScreenProps['topSpacing']) {
  switch (spacing) {
    case 'tight':
      return 76;
    case 'compact':
      return 82;
    case 'legacy':
      return 112;
    default:
      return 90;
  }
}

const localStyles = StyleSheet.create({
  fixedPageArea: {
    paddingHorizontal: 14,
    paddingBottom: 6,
    backgroundColor: '#EEF7FF',
    zIndex: 12,
  },
  stickyStack: {
    backgroundColor: '#EEF7FF',
  },
  scrollBody: {
    paddingTop: 6,
    paddingBottom: 156,
  },
  loadingBody: {
    justifyContent: 'center',
    paddingTop: 0,
  },
});
