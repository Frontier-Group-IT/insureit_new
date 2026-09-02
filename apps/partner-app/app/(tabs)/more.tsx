import { useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { PartnerScreen } from '@/components/partner-screen';
import { PartnerBanner } from '@/components/ui/partner-banner';
import { PartnerButton } from '@/components/ui/partner-button';
import { PartnerConfirmDialog } from '@/components/ui/partner-confirm-dialog';
import { PartnerDisclosureRow } from '@/components/ui/partner-disclosure-row';
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

  const identityLabel = context.identity.actor_kind === 'employee'
    ? humanize(context.identity.role)
    : humanize(context.identity.intermediary_type);

  return (
    <PartnerScreen eyebrow="EXPLORE" title="More">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open profile and registration"
        onPress={() => router.push('/profile')}
        style={({ pressed }) => [styles.profileRow, pressed && styles.profilePressed]}
      >
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials(context.identity.display_name)}</Text></View>
        <View style={styles.profileBody}>
          <Text style={styles.profileName}>{context.identity.display_name}</Text>
          <Text style={styles.profileMeta}>{identityLabel}</Text>
        </View>
        <View style={styles.profileAction}>
          <Text style={styles.profileActionText}>Profile</Text>
          <Ionicons name="chevron-forward" size={15} color={partnerTheme.colors.brand} />
        </View>
      </Pressable>

      {logoutError ? (
        <View style={styles.feedback}>
          <PartnerBanner tone="danger" message={logoutError} />
        </View>
      ) : null}

      <MenuSection title="Work">
        <MenuRow icon="search-outline" title="Search all business" helper="Customers, policies and claims" onPress={() => router.push('/search')} />
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
          variant="ghost"
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
      <PartnerSectionHeader title={title} compact />
      <View>{children}</View>
    </>
  );
}

function MenuRow({
  icon,
  title,
  helper,
  onPress,
  last = false,
}: {
  icon: IconName;
  title: string;
  helper?: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <PartnerDisclosureRow
      label={title}
      helper={helper}
      onPress={onPress}
      divider={!last}
      leading={
        <View style={styles.rowIcon}>
          <Ionicons name={icon} size={18} color={partnerTheme.colors.brandStrong} />
        </View>
      }
    />
  );
}

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'IP';
}

function humanize(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  profileRow: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: partnerTheme.colors.line,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: partnerTheme.colors.brandSoft,
  },
  avatarText: { color: partnerTheme.colors.brandStrong, ...partnerTheme.typography.bodyStrong },
  profileBody: { flex: 1, minWidth: 0 },
  profileName: { color: partnerTheme.colors.ink, ...partnerTheme.typography.cardTitle },
  profileMeta: { marginTop: 2, color: partnerTheme.colors.inkMuted, ...partnerTheme.typography.caption },
  profileAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  profileActionText: { color: partnerTheme.colors.brand, ...partnerTheme.typography.label },
  profilePressed: { backgroundColor: partnerTheme.colors.pressed },
  feedback: { marginTop: partnerTheme.spacing.md },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: partnerTheme.colors.brandSoft,
  },
  logout: {
    marginTop: partnerTheme.spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: partnerTheme.colors.line,
    paddingTop: partnerTheme.spacing.sm,
  },
});
