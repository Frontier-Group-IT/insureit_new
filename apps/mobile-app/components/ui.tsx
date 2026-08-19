import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link, LinkProps, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { PropsWithChildren, isValidElement, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Keyboard, KeyboardAvoidingView, Platform, Pressable, PressableProps, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotificationBell } from '@/components/realtime-notifications';
import { BrandLogo } from '@/components/first-look';
import { getCurrentSession, getProfile, isValidProfile, routeForRole } from '@/lib/auth';
import { getSelectedCustomerContext, isPortfolioCustomerContext, type CustomerAccountContext } from '@/lib/customer-context';
import { canVerifyDocument } from '@/lib/permissions';
import { isSalesHierarchyRole } from '@/lib/roles';
import { colors, palette, radii, roleTheme } from '@/lib/theme';
import type { AppRole } from '@/lib/types';

export { colors };


type ScreenTopSpacing = 'default' | 'compact' | 'tight' | 'legacy';

export function Screen({ title, subtitle, children, showLogout = false, showTitleHeader = true, topSpacing = 'default', bottomTabsVariant = 'default', brandHeaderVariant = 'default' }: PropsWithChildren<{ title: string; subtitle?: string; showLogout?: boolean; showTitleHeader?: boolean; topSpacing?: ScreenTopSpacing; bottomTabsVariant?: 'default' | 'navy'; brandHeaderVariant?: 'default' | 'navy' }>) {
  const router = useRouter();
  const pathname = usePathname();
  const routeParams = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [profileInitial, setProfileInitial] = useState('I');
  const [profileRole, setProfileRole] = useState<AppRole | null>(null);
  const [customerContext, setCustomerContext] = useState<CustomerAccountContext | null | undefined>(pathname.startsWith('/customer') ? undefined : null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const showProfile = ['/customer', '/it', '/staff', '/agent', '/hierarchy', '/admin'].some((prefix) => pathname.startsWith(prefix));
  const compactTopSpacing = pathname === '/customer/upload-documents';
  const legalTopSpacing = pathname.startsWith('/customer/legal');
  const navyBrandHeader = brandHeaderVariant === 'navy' && showProfile;
  const showBackButton = showProfile && !isRootDashboard(pathname);
  const loadingOnly = isValidElement(children) && children.type === LoadingState;
  const tabRole = profileRole ?? (pathname.startsWith('/customer') ? 'customer' : null);
  const profileTopPadding = insets.top + topPaddingFor(topSpacing);
  void showLogout;

  useEffect(() => {
    let active = true;
    async function loadProfileInitial() {
      try {
        const session = await getCurrentSession();
        if (!session?.user || !active) return;
        const profile = await getProfile(session.user.id);
        if (!active) return;
        setProfileInitial(initialFor(profile?.full_name ?? session.user.email ?? 'InsureIT'));
        setProfileRole(isValidProfile(profile) ? profile.role : null);
        if (pathname.startsWith('/customer')) {
          const context = await getSelectedCustomerContext();
          if (active) setCustomerContext(context);
        } else if (active) {
          setCustomerContext(null);
        }
      } catch {
        if (active) setProfileInitial('I');
        if (active && pathname.startsWith('/customer')) setCustomerContext(null);
      }
    }
    void loadProfileInitial();
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

  function openProfile() {
    if (pathname.startsWith('/customer')) return router.push(isPortfolioCustomerContext(customerContext) ? '/customer/group/profile' : '/customer/profile');
    if (pathname.startsWith('/it')) return router.push('/it/profile');
    if (pathname.startsWith('/staff') || pathname.startsWith('/agent') || pathname.startsWith('/hierarchy') || pathname.startsWith('/admin')) return router.push('/staff/profile');
    return router.push('/login');
  }

  function openDashboard() {
    if (profileRole) return router.replace(routeForRole(profileRole));
    return router.replace('/login');
  }

  function openBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(backTargetFor(pathname, routeParams, profileRole, customerContext));
    }
  }

  const accent = accentForRole(profileRole);
  return (
    <SafeAreaView style={styles.safeArea} edges={[]}>
      <View pointerEvents="none" style={[styles.backdropTop, navyBrandHeader && styles.backdropTopNavy]} />
      <View pointerEvents="none" style={styles.backdropBand} />
      {showProfile ? (
        <View style={[styles.fixedBrandRow, navyBrandHeader && styles.fixedBrandRowNavy, { top: insets.top }]}>
          {showBackButton ? (
            <Pressable accessibilityRole="button" onPress={openBack} style={[styles.backButton, navyBrandHeader && styles.backButtonNavy]}>
              <MaterialCommunityIcons name="chevron-left" size={25} color={navyBrandHeader ? '#FFFFFF' : palette.ink} />
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" onPress={openDashboard} style={styles.brandPressable}>
            <BrandLogo width={158} tone={navyBrandHeader ? 'light' : 'dark'} />
          </Pressable>
          <NotificationBell color={navyBrandHeader ? '#FFFFFF' : palette.ink} />
          <Pressable accessibilityRole="button" onPress={openProfile} style={[styles.avatar, navyBrandHeader && styles.avatarNavy]}>
            <Text style={styles.avatarText}>{profileInitial}</Text>
          </Pressable>
        </View>
      ) : null}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
        <ScrollView
          style={styles.screen}
          contentContainerStyle={[styles.screenContent, showProfile && [styles.screenContentWithTabs, { paddingTop: profileTopPadding }], !showProfile && { paddingTop: insets.top + 18 }, compactTopSpacing && { paddingTop: insets.top + topPaddingFor('compact') }, legalTopSpacing && { paddingTop: insets.top + topPaddingFor('default') }, loadingOnly && styles.screenContentLoading]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
        >
          {!showProfile ? (
            <View style={styles.brandRow}>
            {showBackButton ? (
              <Pressable accessibilityRole="button" onPress={openBack} style={styles.backButton}>
                <MaterialCommunityIcons name="chevron-left" size={25} color={palette.ink} />
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" onPress={openDashboard} style={styles.brandPressable}>
              <BrandLogo width={158} />
            </Pressable>
            {showProfile ? (
              <Pressable accessibilityRole="button" onPress={openProfile} style={styles.avatar}>
                <Text style={styles.avatarText}>{profileInitial}</Text>
              </Pressable>
            ) : null}
            </View>
          ) : null}
          {showTitleHeader && !loadingOnly ? (
            <View style={styles.header}>
              <View style={styles.headerTop}>
                <View style={[styles.headerDot, { backgroundColor: accent }]} />
                <Text style={styles.roleEyebrow}>{labelForRole(profileRole)}</Text>
              </View>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
          ) : null}
          {children}
        </ScrollView>
        {showProfile && !keyboardVisible && tabRole && (!pathname.startsWith('/customer') || customerContext !== undefined) ? <UniversalBottomTabs role={tabRole} pathname={pathname} bottomInset={insets.bottom} customerContext={customerContext} variant={bottomTabsVariant} /> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Card({ children, style, ...props }: PropsWithChildren<PressableProps>) {
  return <Pressable style={(state) => [styles.card, state.pressed && props.onPress && styles.cardPressed, typeof style === 'function' ? style(state) : style]} {...props}>{children}</Pressable>;
}

export function Button({ label, onPress, variant = 'primary', disabled = false, icon, loading = false }: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean; icon?: keyof typeof MaterialCommunityIcons.glyphMap; loading?: boolean }) {
  const buttonStyle = [styles.button, variant === 'secondary' && styles.secondaryButton, variant === 'danger' && styles.dangerButton, disabled && styles.disabledButton];
  const textStyle = [styles.buttonText, variant === 'secondary' && styles.secondaryButtonText];
  return (
    <Pressable accessibilityRole="button" disabled={disabled || loading} onPress={onPress} style={({ pressed }) => [buttonStyle, pressed && !disabled && !loading && styles.buttonPressed]}>
      {loading ? <ActivityIndicator size="small" color={variant === 'secondary' ? colors.navy : colors.white} /> : icon ? <MaterialCommunityIcons name={icon} size={18} color={variant === 'secondary' ? colors.navy : colors.white} /> : null}
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  );
}

export function TextField({ label, style, editable, required = false, rightIcon, ...props }: TextInputProps & { label: string; required?: boolean; rightIcon?: keyof typeof MaterialCommunityIcons.glyphMap }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}{required ? <Text style={styles.requiredStar}> *</Text> : null}</Text>
      <View style={[styles.inputShell, editable === false && styles.disabledInputShell]}>
        <TextInput placeholderTextColor="#8A94A6" editable={editable} style={[styles.input, style]} {...props} />
        {rightIcon ? <MaterialCommunityIcons name={rightIcon} size={19} color="#7A8799" style={styles.inputRightIcon} /> : null}
      </View>
    </View>
  );
}

export function Message({ type = 'info', children }: PropsWithChildren<{ type?: 'info' | 'error' | 'success' }>) {
  const icon = type === 'error' ? 'alert-circle-outline' : type === 'success' ? 'check-circle-outline' : 'information-outline';
  return (
    <View style={[styles.message, type === 'error' && styles.errorMessage, type === 'success' && styles.successMessage]}>
      <View style={styles.messageIcon}>
        <MaterialCommunityIcons name={icon} size={18} color={type === 'error' ? colors.danger : type === 'success' ? '#067647' : '#0B63CE'} />
      </View>
      <Text style={[styles.messageText, type === 'error' && styles.errorMessageText, type === 'success' && styles.successMessageText]}>{children}</Text>
    </View>
  );
}

export function LoadingState({ label }: { label?: string }) {
  return (
    <View style={styles.loaderStage}>
      <View style={styles.loaderShell}>
        <ActivityIndicator size="large" color={colors.blue} />
        {label ? <Text style={styles.loaderLabel}>{label}</Text> : null}
      </View>
    </View>
  );
}

export function EmptyState({ title, body, actionLabel, onAction, icon = 'file-search-outline' }: { title: string; body: string; actionLabel?: string; onAction?: () => void; icon?: keyof typeof MaterialCommunityIcons.glyphMap }) {
  return (
    <Card>
      <View style={styles.emptyIcon}>
        <MaterialCommunityIcons name={icon} size={22} color={colors.green} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.muted}>{body}</Text>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} variant="secondary" icon="arrow-right" /> : null}
    </Card>
  );
}

export function Row({ label, value }: { label: string; value?: string | number | null }) {
  return <View style={styles.row}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value ?? '-'}</Text></View>;
}

export function NavLink({ href, label }: { href: LinkProps['href']; label: string }) {
  return (
    <Link href={href} asChild>
      <Pressable style={styles.navLink}>
        <View style={styles.navIcon}>
          <MaterialCommunityIcons name="arrow-top-right" size={18} color={colors.green} />
        </View>
        <Text style={styles.navLinkText}>{label}</Text>
        <MaterialCommunityIcons name="chevron-right" size={23} color="#667085" />
      </Pressable>
    </Link>
  );
}

export function UniversalBottomTabs({ role, pathname, bottomInset, customerContext, variant = 'default' }: { role: AppRole; pathname: string; bottomInset: number; customerContext?: CustomerAccountContext | null; variant?: 'default' | 'navy' }) {
  const router = useRouter();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const tabs = tabsForRole(role, customerContext);
  const useNavy = role === 'customer' || variant === 'navy';

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  if (keyboardVisible) return null;

  return (
    <View
      style={[styles.bottomTabsWrap, useNavy && styles.bottomTabsWrapNavy, { paddingBottom: Math.max(bottomInset, 10) }]}
    >
      <View style={[styles.bottomTabs, useNavy && styles.bottomTabsNavy]}>
        {tabs.map((tab) => {
          const active = isTabActive(tab.href, pathname, customerContext);
          return (
            <Pressable key={`${tab.href}-${tab.label}`} accessibilityRole="button" onPress={() => router.push(tab.href as LinkProps['href'])} style={styles.bottomTab}>
              <View style={[styles.bottomIconShell, useNavy && styles.bottomIconShellNavy, { backgroundColor: useNavy ? (active ? tabTone(tab.label, tab).accent : 'rgba(255,255,255,0.08)') : tabTone(tab.label, tab).soft }, active && [styles.bottomIconShellActive, useNavy && styles.bottomIconShellActiveNavy, { borderColor: tabTone(tab.label, tab).accent }]]}>
                <MaterialCommunityIcons name={tab.icon} size={19} color={active ? tabTone(tab.label, tab).accent : useNavy ? '#D5E4FA' : palette.slate} />
              </View>
              <Text style={[styles.bottomTabText, useNavy && styles.bottomTabTextNavy, active && { color: useNavy ? '#FFFFFF' : tabTone(tab.label, tab).accent }]} numberOfLines={1}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type BottomTabItem = { label: string; href: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; accent: string; soft: string };

function tabsForRole(role: AppRole, customerContext?: CustomerAccountContext | null): BottomTabItem[] {
  const customer = roleTheme.customer;
  const ops = roleTheme.ops;
  const agent = roleTheme.agent;
  const management = roleTheme.management;
  const it = roleTheme.it;
  const customerTone = navTone(customer);
  const opsTone = navTone(ops);
  const agentTone = navTone(agent);
  const managementTone = navTone(management);
  const itTone = navTone(it);
  if (role === 'customer' && isPortfolioCustomerContext(customerContext)) return [
    { label: 'Home', href: '/customer/home', icon: 'home-variant', ...customerTone },
    { label: 'Accounts', href: '/customer/group/accounts', icon: 'account-multiple-outline', ...customerTone },
    { label: 'Fleet', href: '/customer/group/fleet', icon: 'truck-outline', ...customerTone },
    { label: 'Claims', href: '/customer/group/claims', icon: 'shield-check-outline', ...customerTone },
    { label: 'Profile', href: '/customer/group/profile', icon: 'account-outline', ...customerTone },
  ];
  if (role === 'customer') return [
    { label: 'Home', href: '/customer/home', icon: 'home-variant', ...customerTone },
    { label: 'Policies', href: '/customer/policies', icon: 'file-certificate-outline', ...customerTone },
    { label: 'Vehicles', href: '/customer/vehicles', icon: 'truck-outline', ...customerTone },
    { label: 'Support', href: '/customer/support', icon: 'headset', ...customerTone },
    { label: 'Profile', href: '/customer/profile', icon: 'account-outline', ...customerTone },
  ];
  if (role === 'agent') return [
    { label: 'Home', href: '/agent/dashboard', icon: 'home-variant', ...agentTone },
    { label: 'Customers', href: '/staff/customers', icon: 'account-heart-outline', ...agentTone },
    { label: 'Claims', href: '/staff/claims', icon: 'file-document-check-outline', ...agentTone },
    { label: 'Tasks', href: '/staff/tasks', icon: 'phone-clock', ...agentTone },
    { label: 'Profile', href: '/staff/profile', icon: 'account-circle-outline', ...agentTone },
  ];
  if (isSalesHierarchyRole(role)) return [
    { label: 'Home', href: '/hierarchy/dashboard', icon: 'view-dashboard-outline', ...managementTone },
    { label: 'Claims', href: '/staff/claims', icon: 'chart-timeline-variant', ...managementTone },
    { label: 'Reports', href: '/hierarchy/dashboard', icon: 'chart-box-outline', ...managementTone },
    { label: 'Org', href: '/it/organization', icon: 'sitemap-outline', ...managementTone },
    { label: 'Profile', href: '/staff/profile', icon: 'account-circle-outline', ...managementTone },
  ];
  if (role === 'it_super_user' || role === 'admin' || role === 'super_admin') return [
    { label: 'Home', href: role === 'it_super_user' ? '/it/dashboard' : '/admin/dashboard', icon: 'home-variant', ...itTone },
    { label: 'Users', href: '/it/users', icon: 'account-group-outline', ...itTone },
    { label: 'Org', href: '/it/organization', icon: 'sitemap-outline', ...itTone },
    { label: 'Claims', href: '/staff/claims', icon: 'file-document-check-outline', ...opsTone },
    { label: 'Profile', href: '/staff/profile', icon: 'account-circle-outline', ...itTone },
  ];
  if (role === 'backoffice_executive') return [
    { label: 'Home', href: '/staff/dashboard', icon: 'home-variant', ...opsTone },
    { label: 'Customer', href: '/staff/create-customer', icon: 'account-plus-outline', ...opsTone },
    { label: 'Vehicle', href: '/staff/add-vehicle', icon: 'truck-plus-outline', ...opsTone },
    { label: 'Policy', href: '/staff/add-policy', icon: 'shield-plus-outline', ...opsTone },
    { label: 'Profile', href: '/staff/profile', icon: 'account-circle-outline', ...opsTone },
  ];
  const staffTabs: BottomTabItem[] = [
    { label: 'Home', href: routeForRole(role), icon: 'home-variant', ...opsTone },
    { label: 'Claims', href: '/staff/claims', icon: 'file-document-check-outline', ...opsTone },
    { label: 'Tasks', href: '/staff/tasks', icon: 'clipboard-check-outline', ...opsTone },
    { label: 'Customers', href: '/staff/customers', icon: 'account-box-outline', ...opsTone },
    { label: 'Vehicles', href: '/staff/vehicles', icon: 'truck-outline', ...opsTone },
  ];
  return canVerifyDocument(role)
    ? [
      staffTabs[0],
      staffTabs[1],
      { label: 'Docs', href: '/staff/documents', icon: 'cloud-upload-outline', ...opsTone },
      staffTabs[2],
      { label: 'Profile', href: '/staff/profile', icon: 'account-circle-outline', ...opsTone },
    ]
    : staffTabs.slice(0, 5);
}

function initialFor(name: string) {
  return name.trim().charAt(0).toUpperCase() || 'I';
}

function navTone(theme: { accent: string; soft: string }) {
  return { accent: theme.accent, soft: theme.soft };
}

function tabTone(label: string, fallback: { accent: string; soft: string }) {
  switch (label) {
    case 'Home':
      return { accent: palette.emerald, soft: palette.emeraldSoft };
    case 'Claims':
    case 'Docs':
      return { accent: palette.blue, soft: palette.blueSoft };
    case 'Accounts':
    case 'Vehicles':
    case 'Vehicle':
      return { accent: palette.cyan, soft: palette.cyanSoft };
    case 'Support':
    case 'Tasks':
      return { accent: palette.amber, soft: palette.amberSoft };
    case 'Profile':
      return { accent: palette.violet, soft: palette.violetSoft };
    case 'Users':
    case 'Org':
    case 'Reports':
      return { accent: fallback.accent, soft: fallback.soft };
    case 'Customers':
    case 'Customer':
      return { accent: palette.emerald, soft: palette.emeraldSoft };
    case 'Policy':
      return { accent: palette.blue, soft: palette.blueSoft };
    default:
      return fallback;
  }
}

function topPaddingFor(spacing: ScreenTopSpacing) {
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

function isTabActive(tabHref: string, pathname: string, customerContext?: CustomerAccountContext | null) {
  const portfolio = isPortfolioCustomerContext(customerContext);
  if (tabHref === '/customer/home') return pathname === '/customer/home' || pathname === '/customer/report-accident' || pathname === '/customer/start-claim' || pathname === '/customer/insurance-quote' || pathname === '/customer/e-challan';
  if (tabHref === '/customer/policies') return ['/customer/policies', '/customer/policy-detail', '/customer/add-policy', '/customer/renewals'].some((route) => pathname.startsWith(route));
  if (tabHref === '/customer/vehicles') return ['/customer/vehicles', '/customer/vehicle-detail', '/customer/add-vehicle'].some((route) => pathname.startsWith(route));
  if (tabHref === '/customer/support') return ['/customer/support', '/customer/help-faqs', '/customer/raise-support-ticket', '/customer/support-ticket-detail'].some((route) => pathname.startsWith(route));
  if (tabHref === '/customer/profile') return pathname.startsWith('/customer/profile') || pathname.startsWith('/customer/kyc') || pathname.startsWith('/customer/legal');
  if (portfolio && tabHref === '/customer/group/accounts') return pathname.startsWith('/customer/group/accounts') || pathname.startsWith('/customer/group/account-detail') || pathname.startsWith('/customer/group/add-account');
  if (portfolio && tabHref === '/customer/group/fleet') return pathname.startsWith('/customer/group/fleet') || pathname.startsWith('/customer/vehicle-detail') || pathname.startsWith('/customer/add-vehicle');
  if (portfolio && tabHref === '/customer/group/policies') return pathname.startsWith('/customer/group/policies') || pathname.startsWith('/customer/policy-detail') || pathname.startsWith('/customer/add-policy') || pathname.startsWith('/customer/renewals');
  if (portfolio && tabHref === '/customer/group/claims') return pathname.startsWith('/customer/group/claims') || pathname.startsWith('/customer/claim-detail') || pathname.startsWith('/customer/self-managed') || pathname.startsWith('/customer/upload-documents');
  if (portfolio && tabHref === '/customer/group/profile') return pathname.startsWith('/customer/group/profile') || pathname.startsWith('/customer/profile');
  return pathname.startsWith(tabHref);
}

function accentForRole(role: AppRole | null) {
  if (role === 'customer') return roleTheme.customer.accent;
  if (role === 'agent') return roleTheme.agent.accent;
  if (role && isSalesHierarchyRole(role)) return roleTheme.management.accent;
  if (role === 'it_super_user' || role === 'admin' || role === 'super_admin') return roleTheme.it.accent;
  return roleTheme.ops.accent;
}

function labelForRole(role: AppRole | null) {
  if (role === 'customer') return 'Customer';
  if (role === 'agent') return 'Agent';
  if (role && isSalesHierarchyRole(role)) return 'Management';
  if (role === 'it_super_user') return 'IT';
  if (role === 'admin' || role === 'super_admin') return 'Admin';
  if (role === 'backoffice_executive') return 'Back Office';
  if (role) return 'Claims';
  return 'InsureIT';
}

function isRootDashboard(pathname: string) {
  return [
    '/customer/home',
    '/staff/dashboard',
    '/agent/dashboard',
    '/hierarchy/dashboard',
    '/it/dashboard',
    '/admin/dashboard',
  ].includes(pathname);
}

function routeParam(params: Record<string, string | string[]>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function backTargetFor(pathname: string, params: Record<string, string | string[]>, role: AppRole | null, customerContext?: CustomerAccountContext | null): LinkProps['href'] {
  const id = routeParam(params, 'id');
  const claimId = routeParam(params, 'claimId');
  const usePortfolioRoutes = isPortfolioCustomerContext(customerContext);

  if (pathname === '/customer/claim-detail') return usePortfolioRoutes ? '/customer/group/claims' : '/customer/claims';
  if (pathname === '/customer/policy-detail') return usePortfolioRoutes ? '/customer/group/policies' : '/customer/policies';
  if (pathname === '/customer/vehicle-detail') return usePortfolioRoutes ? '/customer/group/fleet' : '/customer/vehicles';
  if (pathname === '/customer/upload-documents') {
    return claimId ? { pathname: '/customer/claim-detail', params: { id: claimId } } : '/customer/home';
  }
  if (pathname === '/customer/report-accident') return usePortfolioRoutes ? '/customer/group/claims' : '/customer/home';
  if (pathname === '/customer/add-vehicle') return usePortfolioRoutes ? '/customer/group/fleet' : '/customer/vehicles';
  if (pathname === '/customer/add-policy') return usePortfolioRoutes ? '/customer/group/policies' : '/customer/policies';
  if (pathname.startsWith('/customer/legal')) return '/customer/insurance-quote';
  if (['/customer/claims', '/customer/vehicles', '/customer/policies', '/customer/support', '/customer/profile'].includes(pathname)) return '/customer/home';

  if (pathname === '/staff/update-status') {
    return id ? { pathname: '/staff/claim-detail', params: { id } } : '/staff/claims';
  }
  if (pathname === '/staff/claim-detail') return '/staff/claims';
  if (pathname === '/staff/documents') return '/staff/dashboard';
  if (pathname === '/staff/create-customer') return '/staff/customers';
  if (pathname === '/staff/add-vehicle') return '/staff/vehicles';
  if (pathname === '/staff/add-policy') return '/staff/customers';
  if (pathname === '/staff/add-insurer') return '/staff/dashboard';
  if (['/staff/claims', '/staff/customers', '/staff/tasks', '/staff/vehicles', '/staff/profile'].includes(pathname)) return '/staff/dashboard';

  if (['/it/users', '/it/organization', '/it/profile'].includes(pathname)) return '/it/dashboard';
  if (pathname === '/admin/dashboard') return '/admin/dashboard';
  if (pathname === '/agent/dashboard') return '/agent/dashboard';
  if (pathname === '/hierarchy/dashboard') return '/hierarchy/dashboard';

  if (role) return routeForRole(role);
  return '/login';
}

export const styles = StyleSheet.create({
  keyboard: { flex: 1 },
  screen: { flex: 1, backgroundColor: 'transparent' },
  safeArea: { flex: 1, backgroundColor: '#EEF7FF' },
  backdropTop: { position: 'absolute', left: 0, right: 0, top: 0, height: 270, backgroundColor: '#EAF5FF' },
  backdropTopNavy: { backgroundColor: palette.navy, height: 180 },
  backdropBand: { position: 'absolute', left: -60, right: -70, top: 170, height: 108, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.72)', transform: [{ rotateZ: '-7deg' }] },
  screenContent: { flexGrow: 1, paddingHorizontal: 14, paddingBottom: 142, backgroundColor: 'transparent' },
  screenContentWithTabs: { paddingTop: 92, paddingBottom: 156 },
  screenContentCompactTop: { paddingTop: 86 },
  screenContentLoading: { justifyContent: 'center', paddingBottom: 108 },
  fixedBrandRow: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, height: 66, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.98)', borderBottomWidth: 1, borderBottomColor: 'rgba(207,224,244,0.9)' },
  fixedBrandRowNavy: { height: 76, backgroundColor: palette.navy, borderBottomColor: 'rgba(255,255,255,0.16)' },
  brandRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginHorizontal: -14, paddingHorizontal: 14, paddingTop: 24, paddingBottom: 10, marginBottom: 10, backgroundColor: 'transparent', zIndex: 10 },
  backButton: { width: 40, height: 40, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.86)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(191,216,255,0.78)' },
  backButtonNavy: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.28)' },
  brandPressable: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  brand: { color: palette.ink, fontSize: 21, fontWeight: '800' },
  brandLogo: { width: 150, height: 34 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.ink, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },
  avatarNavy: { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.48)' },
  avatarText: { color: colors.white, fontSize: 16, fontWeight: '900' },
  header: { minHeight: 98, borderRadius: 22, padding: 16, marginBottom: 14, backgroundColor: 'rgba(255,255,255,0.88)', borderWidth: 1, borderColor: 'rgba(191,216,255,0.72)', shadowColor: '#0C4A88', shadowOpacity: 0.1, shadowRadius: 16, elevation: 3, overflow: 'hidden' },
  headerTop: { alignSelf: 'flex-start', minHeight: 27, borderRadius: 999, backgroundColor: '#F7FBFF', borderWidth: 1, borderColor: '#D6E7FA', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  headerDot: { width: 7, height: 7, borderRadius: 4 },
  roleEyebrow: { color: palette.slate, fontSize: 11, fontWeight: '800', letterSpacing: 0 },
  title: { color: palette.ink, fontSize: 24, fontWeight: '900', lineHeight: 30 },
  subtitle: { color: palette.slate, fontSize: 13, lineHeight: 18, marginTop: 5, fontWeight: '600' },
  card: { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 20, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(224,231,240,0.9)', shadowColor: '#0B1220', shadowOpacity: 0.06, shadowRadius: 14, elevation: 2 },
  cardPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  cardTitle: { color: colors.navy, fontSize: 17, fontWeight: '800', marginBottom: 8 },
  button: { minHeight: 50, borderRadius: 16, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', marginVertical: 5, paddingHorizontal: 14, shadowColor: colors.blue, shadowOpacity: 0.16, shadowRadius: 12, elevation: 2, flexDirection: 'row', gap: 8 },
  buttonPressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  secondaryButton: { backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: '#CFE4FF', shadowOpacity: 0 },
  dangerButton: { backgroundColor: colors.danger },
  disabledButton: { opacity: 0.55 },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  secondaryButtonText: { color: colors.navy },
  fieldWrap: { marginBottom: 12 },
  label: { color: colors.navy, fontSize: 13, fontWeight: '700', marginBottom: 7 },
  requiredStar: { color: '#D14343', fontWeight: '800' },
  inputShell: { minHeight: 54, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  disabledInputShell: { opacity: 0.65 },
  input: { paddingHorizontal: 14, paddingRight: 42, minHeight: 50, color: colors.navy, fontSize: 16, fontWeight: '600' },
  inputRightIcon: { position: 'absolute', right: 14 },
  message: { backgroundColor: palette.blueSoft, borderRadius: radii.lg, padding: 12, marginVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#B9D5FF' },
  messageIcon: { width: 34, height: 34, borderRadius: 13, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  messageText: { color: colors.navy, flex: 1, fontSize: 14, fontWeight: '500', lineHeight: 20 },
  errorMessage: { backgroundColor: '#FEEFEF', borderColor: '#FECACA' },
  successMessage: { backgroundColor: '#EAF8F0', borderColor: '#BFEBD0' },
  errorMessageText: { color: colors.danger },
  successMessageText: { color: '#067647' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 26 },
  loaderStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#F5F9FF',
  },
  loaderShell: {
    minWidth: 170,
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: '#DCE8F8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#102443',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  loaderLabel: {
    marginTop: 12,
    fontSize: 12,
    color: '#4A5F7A',
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  muted: { color: colors.grey, fontSize: 15, lineHeight: 22 },
  emptyIcon: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: palette.emeraldSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  row: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 8 },
  rowLabel: { color: colors.grey, fontSize: 13, fontWeight: '700', marginBottom: 3 },
  rowValue: { color: colors.navy, fontSize: 15, fontWeight: '700' },
  navLink: { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 18, padding: 13, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(224,231,240,0.92)', flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#0B1220', shadowOpacity: 0.04, shadowRadius: 10, elevation: 1 },
  navIcon: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: palette.emeraldSoft, alignItems: 'center', justifyContent: 'center' },
  navLinkText: { color: colors.navy, fontSize: 15, fontWeight: '700', flex: 1 },
  bottomTabsWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 10, paddingTop: 8, backgroundColor: 'rgba(238,247,255,0.78)' },
  bottomTabsWrapNavy: { backgroundColor: 'rgba(7,29,73,0.08)' },
  bottomTabs: { minHeight: 66, backgroundColor: 'rgba(255,255,255,0.98)', borderRadius: 20, paddingVertical: 7, paddingHorizontal: 4, flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(198,211,225,0.9)', shadowColor: '#17202F', shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
  bottomTabsNavy: { backgroundColor: palette.navy, borderColor: '#123B7A', shadowColor: palette.navy, shadowOpacity: 0.2 },
  bottomTab: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', gap: 2, minWidth: 0 },
  bottomIconShell: { width: 35, height: 30, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  bottomIconShellActive: { backgroundColor: palette.surface, shadowColor: palette.ink, shadowOpacity: 0.08, shadowRadius: 6, elevation: 1 },
  bottomIconShellNavy: { borderColor: 'transparent' },
  bottomIconShellActiveNavy: { backgroundColor: '#FFFFFF', shadowColor: '#000000', shadowOpacity: 0.14, shadowRadius: 7, elevation: 2 },
  bottomTabText: { color: colors.grey, fontSize: 9.5, fontWeight: '900' },
  bottomTabTextNavy: { color: '#D5E4FA' },
  bottomTabTextActive: { color: colors.navy },
});


