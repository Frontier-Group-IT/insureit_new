import { useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerButton } from '@/components/ui/partner-button';
import { PartnerConfirmDialog } from '@/components/ui/partner-confirm-dialog';
import { PartnerSectionHeader } from '@/components/ui/partner-section-header';
import { partnerTheme } from '@/lib/theme';
import { usePartnerSession } from '@/providers/partner-session-provider';

type IconName = ComponentProps<typeof Ionicons>['name'];

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

  return (
    <PartnerScreen eyebrow="EXPLORE" title="More">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open profile and registration"
        onPress={() => router.push('/profile')}
        style={({ pressed }) => [styles.profileCard, pressed && styles.pressed]}
      >
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials(context.identity.display_name)}</Text></View>
        <View style={styles.profileBody}>
          <Text style={styles.profileName}>{context.identity.display_name}</Text>
          <Text style={styles.profileMeta}>
            {context.identity.actor_kind === 'employee' ? humanize(context.identity.role) : humanize(context.identity.intermediary_type)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color="#C5CCDA" />
      </Pressable>

      {logoutError ? (
        <View style={styles.feedback}>
          <PartnerBanner tone="danger" message={logoutError} />
        </View>
      ) : null}

      <MenuSection title="Work">
        <MenuRow icon="document-text-outline" title="Policy Intake" onPress={() => router.push('/policy-intakes')} />
        <MenuRow icon="refresh-outline" title="Renewals" onPress={() => router.push('/renewals')} />
        <MenuRow icon="people-outline" title="Customers" onPress={() => router.push('/customers')} last />
      </MenuSection>

      <MenuSection title="Insights">
        <MenuRow icon="calendar-outline" title="Your Week" onPress={() => router.push('/weekly-story')} />
        <MenuRow icon="heart-outline" title="My Impact" onPress={() => router.push('/impact')} />
        <MenuRow icon="trail-sign-outline" title="My Journey" onPress={() => router.push('/journey')} />
        <MenuRow icon="time-outline" title="Activity" onPress={() => router.push('/activity')} last />
      </MenuSection>

      <MenuSection title="Grow & Learn">
        <MenuRow icon="bulb-outline" title="60-Second Learn" onPress={() => router.push('/learn')} />
        <MenuRow icon="sparkles-outline" title="Recognition" onPress={() => router.push('/recognition')} />
        <MenuRow icon="play-circle-outline" title="INSUREIT Stories" onPress={() => router.push('/stories')} last />
      </MenuSection>

      <MenuSection title="Account">
        <MenuRow icon="person-outline" title="Profile & registration" onPress={() => router.push('/profile')} />
        <MenuRow icon="headset-outline" title="Support" onPress={() => router.push('/support')} />
        <MenuRow icon="settings-outline" title="Settings & app info" onPress={() => router.push('/settings')} last />
      </MenuSection>

      <View style={styles.logout}>
        <PartnerButton
          label="Sign out"
          icon="log-out-outline"
          variant="danger"
          onPress={() => setLogoutOpen(true)}
        />
      </View>

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
    <>
      <PartnerSectionHeader title={title} />
      <View style={styles.menu}>{children}</View>
    </>
  );
}

function MenuRow({
  icon,
  title,
  onPress,
  last = false,
}: {
  icon: IconName;
  title: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && styles.rowDivider, pressed && styles.rowPressed]}
    >
      <View style={styles.rowIcon}><Ionicons name={icon} size={19} color={partnerTheme.colors.brand} /></View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color="#A0A8B6" />
    </Pressable>
  );
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'IP';
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  profileCard: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: partnerTheme.radius.lg,
    paddingHorizontal: 14,
    backgroundColor: partnerTheme.colors.nav,
  },
  avatar: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#383F52' },
  avatarText: { color: '#FFFFFF', ...partnerTheme.typography.bodyStrong },
  profileBody: { flex: 1 },
  profileName: { color: '#FFFFFF', ...partnerTheme.typography.cardTitle },
  profileMeta: { marginTop: 3, color: '#C5CCDA', ...partnerTheme.typography.caption },
  feedback: { marginTop: partnerTheme.spacing.md },
  menu: {
    overflow: 'hidden',
    borderRadius: partnerTheme.radius.lg,
    backgroundColor: partnerTheme.colors.surface,
    borderWidth: 1,
    borderColor: partnerTheme.colors.line,
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 13,
  },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: partnerTheme.colors.line },
  rowPressed: { backgroundColor: partnerTheme.colors.surfaceMuted },
  rowIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.brandSoft },
  rowBody: { flex: 1, paddingVertical: 6 },
  rowTitle: { color: partnerTheme.colors.ink, ...partnerTheme.typography.bodyStrong },
  logout: { marginTop: partnerTheme.spacing.lg },
  pressed: { opacity: 0.8 },
});
