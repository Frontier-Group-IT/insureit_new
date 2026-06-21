import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link, LinkProps, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { PropsWithChildren, useEffect, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, PressableProps, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NotificationBell } from '@/components/realtime-notifications';
import { BrandLogo } from '@/components/first-look';
import { getCurrentSession, getProfile, isValidProfile, routeForRole } from '@/lib/auth';
import { canVerifyDocument } from '@/lib/permissions';
import { isSalesHierarchyRole } from '@/lib/roles';
import { colors, palette, radii, roleTheme } from '@/lib/theme';
import type { AppRole } from '@/lib/types';

export { colors };


export function Screen({ title, subtitle, children, showLogout = false, showTitleHeader = true }: PropsWithChildren<{ title: string; subtitle?: string; showLogout?: boolean; showTitleHeader?: boolean }>) {
  const router = useRouter();
  const pathname = usePathname();
  const routeParams = useLocalSearchParams();
  const [profileInitial, setProfileInitial] = useState('I');
  const [profileRole, setProfileRole] = useState<AppRole | null>(null);
  const showProfile = ['/customer', '/it', '/staff', '/agent', '/hierarchy', '/admin'].some((prefix) => pathname.startsWith(prefix));
  const compactTopSpacing = pathname === '/customer/upload-documents';
  const showBackButton = showProfile && !isRootDashboard(pathname);
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
      } catch {
        if (active) setProfileInitial('I');
      }
    }
    void loadProfileInitial();
    return () => {
      active = false;
    };
  }, []);

  function openProfile() {
    if (pathname.startsWith('/customer')) return router.push('/customer/profile');
    if (pathname.startsWith('/it')) return router.push('/it/profile');
    if (pathname.startsWith('/staff') || pathname.startsWith('/agent') || pathname.startsWith('/hierarchy') || pathname.startsWith('/admin')) return router.push('/staff/profile');
    return router.push('/login');
  }

  function openDashboard() {
    if (profileRole) return router.replace(routeForRole(profileRole));
    return router.replace('/login');
  }

  function openBack() {
    router.replace(backTargetFor(pathname, routeParams, profileRole));
  }

  const accent = accentForRole(profileRole);
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View pointerEvents="none" style={styles.backdropTop} />
      <View pointerEvents="none" style={styles.backdropBand} />
      {showProfile ? (
        <View style={styles.fixedBrandRow}>
          {showBackButton ? (
            <Pressable accessibilityRole="button" onPress={openBack} style={styles.backButton}>
              <MaterialCommunityIcons name="chevron-left" size={25} color={palette.ink} />
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" onPress={openDashboard} style={styles.brandPressable}>
            <BrandLogo width={158} />
          </Pressable>
          <NotificationBell />
          <Pressable accessibilityRole="button" onPress={openProfile} style={styles.avatar}>
            <Text style={styles.avatarText}>{profileInitial}</Text>
          </Pressable>
        </View>
      ) : null}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboard}>
        <ScrollView
          style={styles.screen}
          contentContainerStyle={[styles.screenContent, showProfile && styles.screenContentWithTabs, compactTopSpacing && styles.screenContentCompactTop]}
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
          {showTitleHeader ? (
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
        {showProfile && profileRole ? <BottomTabs role={profileRole} pathname={pathname} /> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Card({ children, style, ...props }: PropsWithChildren<PressableProps>) {
  return <Pressable style={[styles.card, typeof style === 'function' ? undefined : style]} {...props}>{children}</Pressable>;
}

export function Button({ label, onPress, variant = 'primary', disabled = false }: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean }) {
  const buttonStyle = [styles.button, variant === 'secondary' && styles.secondaryButton, variant === 'danger' && styles.dangerButton, disabled && styles.disabledButton];
  const textStyle = [styles.buttonText, variant === 'secondary' && styles.secondaryButtonText];
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={buttonStyle}>
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  );
}

export function TextField({ label, style, editable, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputShell, editable === false && styles.disabledInputShell]}>
        <TextInput placeholderTextColor="#8A94A6" editable={editable} style={[styles.input, style]} {...props} />
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

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <View style={styles.loadingBadge}>
        <ActivityIndicator color={colors.green} />
      </View>
      <Text style={styles.loadingLabel}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <View style={styles.emptyIcon}>
        <MaterialCommunityIcons name="file-search-outline" size={22} color={colors.green} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.muted}>{body}</Text>
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

function BottomTabs({ role, pathname }: { role: AppRole; pathname: string }) {
  const router = useRouter();
  const tabs = tabsForRole(role);
  return (
    <View style={styles.bottomTabsWrap}>
      <View style={styles.bottomTabs}>
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Pressable key={`${tab.href}-${tab.label}`} accessibilityRole="button" onPress={() => router.push(tab.href as LinkProps['href'])} style={styles.bottomTab}>
              <View style={[styles.bottomIconShell, { backgroundColor: tabTone(tab.label, tab).soft }, active && [styles.bottomIconShellActive, { borderColor: tabTone(tab.label, tab).accent }]]}>
                <MaterialCommunityIcons name={tab.icon} size={19} color={active ? tabTone(tab.label, tab).accent : palette.slate} />
              </View>
              <Text style={[styles.bottomTabText, active && { color: tabTone(tab.label, tab).accent }]} numberOfLines={1}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type BottomTabItem = { label: string; href: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; accent: string; soft: string };

function tabsForRole(role: AppRole): BottomTabItem[] {
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
  if (role === 'customer') return [
    { label: 'Home', href: '/customer/home', icon: 'home-variant', ...customerTone },
    { label: 'Claims', href: '/customer/claims', icon: 'file-document-check-outline', ...customerTone },
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

function backTargetFor(pathname: string, params: Record<string, string | string[]>, role: AppRole | null): LinkProps['href'] {
  const id = routeParam(params, 'id');
  const claimId = routeParam(params, 'claimId');

  if (pathname === '/customer/claim-detail') return '/customer/claims';
  if (pathname === '/customer/upload-documents') {
    return claimId ? { pathname: '/customer/claim-detail', params: { id: claimId } } : '/customer/home';
  }
  if (pathname === '/customer/report-accident') return '/customer/home';
  if (pathname === '/customer/add-vehicle') return '/customer/vehicles';
  if (pathname === '/customer/add-policy') return '/customer/policies';
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
  backdropBand: { position: 'absolute', left: -60, right: -70, top: 170, height: 108, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.72)', transform: [{ rotateZ: '-7deg' }] },
  screenContent: { flexGrow: 1, paddingHorizontal: 14, paddingBottom: 120, backgroundColor: 'transparent' },
  screenContentWithTabs: { paddingTop: 122, paddingBottom: 130 },
  screenContentCompactTop: { paddingTop: 106 },
  fixedBrandRow: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 64, paddingBottom: 10, backgroundColor: 'rgba(255,255,255,0.96)', borderBottomWidth: 1, borderBottomColor: 'rgba(207,224,244,0.9)' },
  brandRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginHorizontal: -14, paddingHorizontal: 14, paddingTop: 24, paddingBottom: 10, marginBottom: 10, backgroundColor: 'transparent', zIndex: 10 },
  backButton: { width: 40, height: 40, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.86)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(191,216,255,0.78)' },
  brandPressable: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  brand: { color: palette.ink, fontSize: 21, fontWeight: '800' },
  brandLogo: { width: 150, height: 34 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.ink, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },
  avatarText: { color: colors.white, fontSize: 16, fontWeight: '900' },
  header: { minHeight: 98, borderRadius: 22, padding: 16, marginBottom: 14, backgroundColor: 'rgba(255,255,255,0.88)', borderWidth: 1, borderColor: 'rgba(191,216,255,0.72)', shadowColor: '#0C4A88', shadowOpacity: 0.1, shadowRadius: 16, elevation: 3, overflow: 'hidden' },
  headerTop: { alignSelf: 'flex-start', minHeight: 27, borderRadius: 999, backgroundColor: '#F7FBFF', borderWidth: 1, borderColor: '#D6E7FA', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  headerDot: { width: 7, height: 7, borderRadius: 4 },
  roleEyebrow: { color: palette.slate, fontSize: 11, fontWeight: '800', letterSpacing: 0 },
  title: { color: palette.ink, fontSize: 24, fontWeight: '900', lineHeight: 30 },
  subtitle: { color: palette.slate, fontSize: 13, lineHeight: 18, marginTop: 5, fontWeight: '600' },
  card: { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 20, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(224,231,240,0.9)', shadowColor: '#0B1220', shadowOpacity: 0.06, shadowRadius: 14, elevation: 2 },
  cardTitle: { color: colors.navy, fontSize: 17, fontWeight: '800', marginBottom: 8 },
  button: { minHeight: 50, borderRadius: 16, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', marginVertical: 5, paddingHorizontal: 14, shadowColor: colors.blue, shadowOpacity: 0.16, shadowRadius: 12, elevation: 2 },
  secondaryButton: { backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: '#CFE4FF', shadowOpacity: 0 },
  dangerButton: { backgroundColor: colors.danger },
  disabledButton: { opacity: 0.55 },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  secondaryButtonText: { color: colors.navy },
  fieldWrap: { marginBottom: 12 },
  label: { color: colors.navy, fontSize: 13, fontWeight: '700', marginBottom: 7 },
  inputShell: { minHeight: 54, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: colors.border, justifyContent: 'center' },
  disabledInputShell: { opacity: 0.65 },
  input: { paddingHorizontal: 14, minHeight: 50, color: colors.navy, fontSize: 16, fontWeight: '600' },
  message: { backgroundColor: palette.blueSoft, borderRadius: radii.lg, padding: 12, marginVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#B9D5FF' },
  messageIcon: { width: 34, height: 34, borderRadius: 13, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  messageText: { color: colors.navy, flex: 1, fontSize: 14, fontWeight: '500', lineHeight: 20 },
  errorMessage: { backgroundColor: '#FEEFEF', borderColor: '#FECACA' },
  successMessage: { backgroundColor: '#EAF8F0', borderColor: '#BFEBD0' },
  errorMessageText: { color: colors.danger },
  successMessageText: { color: '#067647' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 26 },
  loadingBadge: { width: 58, height: 58, borderRadius: radii.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: 12, shadowColor: colors.navy, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  loadingLabel: { color: colors.navy, fontSize: 15, fontWeight: '700', lineHeight: 22 },
  muted: { color: colors.grey, fontSize: 15, lineHeight: 22 },
  emptyIcon: { width: 44, height: 44, borderRadius: radii.md, backgroundColor: palette.emeraldSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  row: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 8 },
  rowLabel: { color: colors.grey, fontSize: 13, fontWeight: '700', marginBottom: 3 },
  rowValue: { color: colors.navy, fontSize: 15, fontWeight: '700' },
  navLink: { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 18, padding: 13, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(224,231,240,0.92)', flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#0B1220', shadowOpacity: 0.04, shadowRadius: 10, elevation: 1 },
  navIcon: { width: 40, height: 40, borderRadius: radii.md, backgroundColor: palette.emeraldSoft, alignItems: 'center', justifyContent: 'center' },
  navLinkText: { color: colors.navy, fontSize: 15, fontWeight: '700', flex: 1 },
  bottomTabsWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 10, paddingBottom: 6, paddingTop: 5, backgroundColor: 'rgba(238,247,255,0.66)' },
  bottomTabs: { backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 18, paddingVertical: 5, paddingHorizontal: 4, flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(198,211,225,0.86)', shadowColor: '#17202F', shadowOpacity: 0.08, shadowRadius: 10, elevation: 4 },
  bottomTab: { flex: 1, alignItems: 'center', gap: 1, minWidth: 0 },
  bottomIconShell: { width: 32, height: 27, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  bottomIconShellActive: { backgroundColor: palette.surface, shadowColor: palette.ink, shadowOpacity: 0.08, shadowRadius: 6, elevation: 1 },
  bottomTabText: { color: colors.grey, fontSize: 9, fontWeight: '900' },
  bottomTabTextActive: { color: colors.navy },
});



