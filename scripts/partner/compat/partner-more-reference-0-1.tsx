import { useState, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerButton } from '@/components/ui/partner-button';
import { PartnerConfirmDialog } from '@/components/ui/partner-confirm-dialog';
import { PartnerAssets } from '@/lib/partner-assets';
import { partnerTheme } from '@/lib/theme';
import { usePartnerSession } from '@/providers/partner-session-provider';

const moreHeaderArt = require('../../assets/figma-dashboard/hero-banner.jpg');
const partnerLogo = require('../../assets/partner-login-logo.png');

export default function MoreScreen() {
  const router = useRouter();
  const { context, signOut } = usePartnerSession();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  if (!context) return null;

  async function logout() {
    setLoggingOut(true);
    setLogoutError('');
    try {
      await signOut();
      router.replace('/login');
    } catch {
      setLogoutError('We could not sign you out. Please try again.');
      setLoggingOut(false);
      setLogoutOpen(false);
    }
  }

  const identityLabel = context.identity.actor_kind === 'employee'
    ? humanize(context.identity.role)
    : humanize(context.identity.intermediary_type);

  return (
    <PartnerScreen title="" hideTopBar>
      <View style={styles.hero}>
        <Image source={moreHeaderArt} style={styles.heroArt} resizeMode="cover" />
        <View style={styles.heroShade} />
        <Image source={partnerLogo} style={styles.heroLogo} resizeMode="contain" />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open profile and registration"
        onPress={() => router.push('/profile')}
        style={({ pressed }) => [styles.profileCard, pressed && styles.pressed]}
      >
        <View style={styles.avatar}>
          <Ionicons name="person" size={27} color="#FFFFFF" />
        </View>
        <View style={styles.profileBody}>
          <Text numberOfLines={1} style={styles.profileName}>{context.identity.display_name}</Text>
          <Text style={styles.profileMeta}>{identityLabel}</Text>
        </View>
        <View style={styles.profileAction}>
          <Text style={styles.profileActionText}>Profile</Text>
          <Ionicons name="chevron-forward" size={18} color={partnerTheme.colors.brand} />
        </View>
      </Pressable>

      {logoutError ? (
        <View style={styles.feedback}>
          <PartnerBanner tone="danger" message={logoutError} />
        </View>
      ) : null}

      <MenuSection title="WORK">
        <MenuRow asset={PartnerAssets.navigation.search} title="Search all business" helper="Customers, policies and claims" onPress={() => router.push('/search')} />
        <MenuRow asset={PartnerAssets.navigation.policyIntake} title="Policy Intake" onPress={() => router.push('/policy-intakes')} />
        <MenuRow asset={PartnerAssets.navigation.renewals} title="Renewals" onPress={() => router.push('/renewals')} />
        <MenuRow asset={PartnerAssets.navigation.customers} title="Customers" onPress={() => router.push('/customers')} last />
      </MenuSection>

      <MenuSection title="INSIGHTS">
        <MenuRow asset={PartnerAssets.actions.businessPerformance} title="Your Week" onPress={() => router.push('/weekly-story')} />
        <MenuRow asset={PartnerAssets.actions.businessInsights} title="My Impact" onPress={() => router.push('/impact')} />
        <MenuRow asset={PartnerAssets.status.journey} title="My Journey" onPress={() => router.push('/journey')} />
        <MenuRow asset={PartnerAssets.status.announcement} title="Activity" onPress={() => router.push('/activity')} last />
      </MenuSection>

      <MenuSection title="GROW & LEARN">
        <MenuRow asset={PartnerAssets.actions.policyChecklist} title="60-Second Learn" onPress={() => router.push('/learn')} />
        <MenuRow asset={PartnerAssets.status.achievement} title="Recognition" onPress={() => router.push('/recognition')} />
        <MenuRow asset={PartnerAssets.status.businessGrowth} title="INSUREIT Stories" onPress={() => router.push('/stories')} last />
      </MenuSection>

      <MenuSection title="ACCOUNT">
        <MenuRow asset={PartnerAssets.navigation.profile} title="Profile & registration" onPress={() => router.push('/profile')} />
        <MenuRow asset={PartnerAssets.actions.support} title="Support" onPress={() => router.push('/support')} />
        <MenuRow asset={PartnerAssets.status.settings} title="Settings & app info" onPress={() => router.push('/settings')} last />
      </MenuSection>

      <Pressable
        accessibilityRole="button"
        onPress={() => setLogoutOpen(true)}
        style={({ pressed }) => [styles.signOutCard, pressed && styles.pressed]}
      >
        <Ionicons name="log-out-outline" size={21} color={partnerTheme.colors.brand} />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>

      <PartnerConfirmDialog
        visible={logoutOpen}
        title="Sign out of INSUREIT Partner?"
        message="You will need to sign in again to access your business and service workspace."
        confirmLabel="Sign out"
        destructive
        busy={loggingOut}
        onCancel={() => setLogoutOpen(false)}
        onConfirm={() => void logout()}
      />
    </PartnerScreen>
  );
}

function MenuSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function MenuRow({
  asset,
  title,
  helper,
  onPress,
  last = false,
}: {
  asset: number;
  title: string;
  helper?: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={helper ? `${title}. ${helper}` : title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        !last && styles.menuRowDivider,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.rowIcon}>
        <Image source={asset} style={styles.rowAssetImage} resizeMode="contain" />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        {helper ? <Text style={styles.rowHelper}>{helper}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={17} color="#7587A0" />
    </Pressable>
  );
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  hero: {
    height: 122,
    marginHorizontal: -partnerTheme.spacing.lg,
    marginTop: -partnerTheme.spacing.lg,
    overflow: 'hidden',
    backgroundColor: '#063B7C',
  },
  heroArt: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3, 48, 107, 0.34)',
  },
  heroLogo: {
    position: 'absolute',
    left: 18,
    top: 16,
    width: 126,
    height: 48,
  },
  profileCard: {
    minHeight: 78,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 11,
    backgroundColor: partnerTheme.colors.surface,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
    ...partnerTheme.shadowSoft,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5A56EA',
  },
  profileBody: { flex: 1, minWidth: 0 },
  profileName: {
    color: partnerTheme.colors.ink,
    ...partnerTheme.typography.cardTitle,
  },
  profileMeta: {
    marginTop: 2,
    color: partnerTheme.colors.inkMuted,
    ...partnerTheme.typography.caption,
  },
  profileAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  profileActionText: {
    color: partnerTheme.colors.brand,
    ...partnerTheme.typography.label,
  },
  feedback: { marginTop: partnerTheme.spacing.md },
  section: {
    marginTop: 14,
  },
  sectionTitle: {
    marginBottom: 6,
    marginLeft: 5,
    color: '#617492',
    letterSpacing: 1.1,
    ...partnerTheme.typography.eyebrow,
  },
  sectionCard: {
    overflow: 'hidden',
    borderRadius: 15,
    backgroundColor: partnerTheme.colors.surface,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
    ...partnerTheme.shadowSoft,
  },
  menuRow: {
    minHeight: 65,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  menuRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: partnerTheme.colors.line,
  },
  rowIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowAssetImage: {
    width: 34,
    height: 34,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    color: '#102A5E',
    ...partnerTheme.typography.cardTitle,
  },
  rowHelper: {
    marginTop: 2,
    color: partnerTheme.colors.inkMuted,
    ...partnerTheme.typography.caption,
  },
  signOutCard: {
    minHeight: 54,
    marginTop: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 13,
    backgroundColor: '#EEF3FF',
    borderWidth: 1,
    borderColor: '#DDE7FF',
  },
  signOutText: {
    color: partnerTheme.colors.brand,
    ...partnerTheme.typography.bodyStrong,
  },
  pressed: {
    opacity: 0.72,
  },
});
