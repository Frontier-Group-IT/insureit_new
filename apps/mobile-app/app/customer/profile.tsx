import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppSectionHeader } from '@/components/design-system';
import { Button, LoadingState, Screen } from '@/components/ui';
import { getCurrentSession, getCustomerForUser, getProfile, signOut } from '@/lib/auth';
import { palette, radii, roleTheme } from '@/lib/theme';
import type { Customer, Profile } from '@/lib/types';
import { supabase } from '@/lib/supabase';

type AgentContact = Pick<Profile, 'full_name' | 'phone' | 'email'>;
type SupportContact = { name: string; phone: string | null; email: string | null; role: string };

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [agent, setAgent] = useState<AgentContact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');

      const [nextProfile, nextCustomer] = await Promise.all([
        getProfile(session.user.id),
        getCustomerForUser(session.user.id),
      ]);

      if (!active) return;
      setProfile(nextProfile);
      setCustomer(nextCustomer);

      let selectedAgent: AgentContact | null = null;
      if (nextCustomer?.assigned_agent_id) {
        const { data } = await supabase
          .from('profiles')
          .select('full_name, phone, email')
          .eq('id', nextCustomer.assigned_agent_id)
          .maybeSingle();
        selectedAgent = data ?? null;
        if (active) setAgent(selectedAgent);
      }
      if (!selectedAgent) {
        const { data: context } = await supabase.functions.invoke<{ support_contacts?: { agent?: SupportContact | null } }>('profile-context', { method: 'GET' });
        if (active && context?.support_contacts?.agent) {
          setAgent({
            full_name: context.support_contacts.agent.name,
            phone: context.support_contacts.agent.phone,
            email: context.support_contacts.agent.email,
          });
        }
      }

      if (active) setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [router]);

  const address = useMemo(() => [customer?.address, customer?.city, customer?.state, customer?.postal_code].filter(Boolean).join(', '), [customer]);
  const displayName = customer?.contact_name ?? profile?.full_name ?? 'Customer';
  const customerId = customer?.customer_code ?? shortId(customer?.id);

  if (loading) return <Screen title="My Profile"><LoadingState /></Screen>;

  return (
    <Screen title="My Profile" subtitle="Your claim support and contact details.">
      <View style={styles.heroCard}>
        <View style={styles.heroGlow} />
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(displayName)}</Text>
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>Customer profile</Text>
          <Text style={styles.name}>{displayName}</Text>
          <View style={styles.idPill}>
            <MaterialCommunityIcons name="identifier" size={15} color={roleTheme.customer.accent} />
            <Text style={styles.idPillText}>{customerId ?? 'Customer ID pending'}</Text>
          </View>
        </View>
      </View>

      <AppSectionHeader title="Assigned agent" />
      <View style={styles.agentCard}>
        <View style={styles.agentIcon}>
          <MaterialCommunityIcons name="account-tie-voice-outline" size={23} color={roleTheme.customer.accent} />
        </View>
        <View style={styles.agentCopy}>
          <Text style={styles.sectionLabel}>Assigned agent</Text>
          <Text style={styles.agentName}>{agent?.full_name ?? 'Not assigned yet'}</Text>
          <Text style={styles.agentMeta}>{agent?.phone ?? agent?.email ?? 'Your support team will assign an agent when required.'}</Text>
        </View>
      </View>

      <AppSectionHeader title="Account details" />
      <View style={styles.grid}>
        <InfoTile icon="office-building-outline" label="Company" value={customer?.company_name} />
        <InfoTile icon="phone-outline" label="Mobile" value={customer?.phone ?? profile?.phone} />
        <InfoTile icon="email-outline" label="Email" value={customer?.email ?? profile?.email} />
        <InfoTile icon="map-marker-outline" label="Address" value={address} wide />
      </View>

      <View style={styles.actions}>
        <Button label="Back to dashboard" variant="secondary" onPress={() => router.replace('/customer/home')} />
        <Button label="Sign out" variant="danger" onPress={() => void signOut(router)} />
      </View>
    </Screen>
  );
}

function InfoTile({ icon, label, value, wide = false }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value?: string | null; wide?: boolean }) {
  return (
    <View style={[styles.infoTile, wide && styles.infoTileWide]}>
      <View style={styles.infoIcon}>
        <MaterialCommunityIcons name={icon} size={20} color={roleTheme.customer.accent} />
      </View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '-'}</Text>
    </View>
  );
}

function shortId(id?: string | null) {
  return id ? id.slice(0, 8).toUpperCase() : null;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? 'C').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
}

const styles = StyleSheet.create({
  heroCard: {
    minHeight: 132,
    borderRadius: radii.xl,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: palette.line,
    padding: 17,
    marginBottom: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: palette.ink,
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  heroGlow: {
    position: 'absolute',
    right: -58,
    top: -72,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: palette.emeraldSoft,
  },
  avatar: {
    width: 66,
    height: 66,
    borderRadius: 24,
    backgroundColor: roleTheme.customer.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: roleTheme.customer.accent,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 3,
  },
  avatarText: { color: '#FFFFFF', fontSize: 23, fontWeight: '900' },
  heroCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: palette.muted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 5 },
  name: { color: palette.ink, fontSize: 22, lineHeight: 27, fontWeight: '900', marginBottom: 9 },
  idPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: palette.emeraldSoft, paddingHorizontal: 10, paddingVertical: 7 },
  idPillText: { color: palette.ink, fontSize: 12, fontWeight: '900' },
  agentCard: {
    borderRadius: radii.lg,
    backgroundColor: '#F8FBFF',
    borderWidth: 1,
    borderColor: palette.line,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  agentIcon: { width: 48, height: 48, borderRadius: 17, backgroundColor: palette.emeraldSoft, alignItems: 'center', justifyContent: 'center' },
  agentCopy: { flex: 1, minWidth: 0 },
  sectionLabel: { color: palette.muted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 },
  agentName: { color: palette.ink, fontSize: 16, fontWeight: '900', marginBottom: 3 },
  agentMeta: { color: palette.slate, fontSize: 13, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  infoTile: {
    width: '48.5%',
    minHeight: 128,
    borderRadius: radii.lg,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: palette.line,
    padding: 13,
    shadowColor: palette.ink,
    shadowOpacity: 0.035,
    shadowRadius: 10,
    elevation: 1,
  },
  infoTileWide: { width: '100%', minHeight: 112 },
  infoIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: palette.blueMist, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  infoLabel: { color: palette.muted, fontSize: 12, fontWeight: '800', marginBottom: 5 },
  infoValue: { color: palette.ink, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  actions: { marginTop: 2 },
});


