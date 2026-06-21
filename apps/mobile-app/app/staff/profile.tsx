import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, LoadingState, Screen } from '@/components/ui';
import { getCurrentSession, getProfile, signOut } from '@/lib/auth';
import { roleLabels } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { palette, radii, roleTheme } from '@/lib/theme';
import type { Profile } from '@/lib/types';

export default function StaffProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [managerName, setManagerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');

      const nextProfile = await getProfile(session.user.id);
      if (!active) return;
      setProfile(nextProfile);

      if (nextProfile?.reporting_manager_id) {
        const { data } = await supabase.functions.invoke<{ manager_name: string | null }>('profile-context', { method: 'GET' });
        if (active) setManagerName(data?.manager_name ?? null);
      }

      if (active) setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [router]);

  const displayName = profile?.full_name ?? 'Team member';
  const roleName = profile?.role ? roleLabels[profile.role] : 'Operations';

  if (loading) return <Screen title="My Profile" showTitleHeader={false}><LoadingState /></Screen>;

  return (
    <Screen title="My Profile" showTitleHeader={false}>
      <View style={styles.heroCard}>
        <View style={styles.heroGlow} />
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(displayName)}</Text>
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.name}>{displayName}</Text>
          <View style={styles.rolePill}>
            <MaterialCommunityIcons name="briefcase-check-outline" size={15} color={roleTheme.ops.accent} />
            <Text style={styles.rolePillText}>{roleName}</Text>
          </View>
        </View>
      </View>

      <View style={styles.grid}>
        <InfoTile icon="identifier" label="User ID" value={profile?.employee_code ?? shortId(profile?.id)} />
        <InfoTile icon="account-supervisor-outline" label="Reporting officer" value={managerName ?? (profile?.reporting_manager_id ? 'Assigned officer' : 'Not assigned')} />
        <InfoTile icon="email-outline" label="Email" value={profile?.email} />
        <InfoTile icon="phone-outline" label="Mobile" value={profile?.phone} />
      </View>

      <View style={styles.actions}>
        <Button label="Back to operations desk" variant="secondary" onPress={() => router.replace('/staff/dashboard')} />
        <Button label="Sign out" variant="danger" onPress={() => void signOut(router)} />
      </View>
    </Screen>
  );
}

function InfoTile({ icon, label, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value?: string | null }) {
  return (
    <View style={styles.infoTile}>
      <View style={styles.infoIcon}>
        <MaterialCommunityIcons name={icon} size={20} color={roleTheme.ops.accent} />
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
  return (parts[0]?.[0] ?? 'I').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase();
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
    backgroundColor: palette.blueSoft,
  },
  avatar: {
    width: 66,
    height: 66,
    borderRadius: 24,
    backgroundColor: roleTheme.ops.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: roleTheme.ops.accent,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 3,
  },
  avatarText: { color: '#FFFFFF', fontSize: 23, fontWeight: '900' },
  heroCopy: { flex: 1, minWidth: 0 },
  name: { color: palette.ink, fontSize: 22, lineHeight: 27, fontWeight: '900', marginBottom: 9 },
  rolePill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, backgroundColor: palette.blueSoft, paddingHorizontal: 10, paddingVertical: 7 },
  rolePillText: { color: palette.ink, fontSize: 12, fontWeight: '900' },
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
  infoIcon: { width: 38, height: 38, borderRadius: 14, backgroundColor: palette.blueMist, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  infoLabel: { color: palette.muted, fontSize: 12, fontWeight: '800', marginBottom: 5 },
  infoValue: { color: palette.ink, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  actions: { marginTop: 2 },
});
