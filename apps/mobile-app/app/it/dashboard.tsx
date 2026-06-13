import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, PressableProps, ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingState, Message } from '@/components/ui';
import { getCurrentSession, getProfile, isValidProfile } from '@/lib/auth';
import { canManageUsers, roleLabels, salesHierarchyRoles } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import type { AppRole, Customer, Profile } from '@/lib/types';

type RecentProfile = Pick<Profile, 'id' | 'full_name' | 'role' | 'updated_at' | 'is_active'>;

type Counts = {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  salesUsers: number;
  agents: number;
  customers: number;
};

export default function ItDashboardScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [recentProfiles, setRecentProfiles] = useState<RecentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setMessage('');
        const session = await getCurrentSession();
        if (!session?.user) return router.replace('/login');
        const nextProfile = await getProfile(session.user.id);
        if (!isValidProfile(nextProfile) || !canManageUsers(nextProfile.role)) return router.replace('/access-denied');
        if (!active) return;
        setProfile(nextProfile);

        const [profileResult, customerResult, recentResult] = await Promise.all([
          supabase.from('profiles').select('*').order('full_name'),
          supabase.from('customers').select('*'),
          supabase.from('profiles').select('id, full_name, role, updated_at, is_active').order('updated_at', { ascending: false }).limit(4),
        ]);
        if (profileResult.error) throw profileResult.error;
        if (customerResult.error) throw customerResult.error;
        if (recentResult.error) throw recentResult.error;
        if (!active) return;
        setProfiles(profileResult.data ?? []);
        setCustomers(customerResult.data ?? []);
        setRecentProfiles(recentResult.data ?? []);
      } catch (error) {
        console.error('IT dashboard load failed', error);
        if (active) setMessage('We could not load the control center.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [router]);

  const counts = useMemo(() => {
    const activeUsers = profiles.filter((item) => item.is_active).length;
    return {
      totalUsers: profiles.length,
      activeUsers,
      inactiveUsers: profiles.length - activeUsers,
      salesUsers: profiles.filter((item) => salesHierarchyRoles.includes(item.role)).length,
      agents: profiles.filter((item) => item.role === 'agent').length,
      customers: customers.length,
    };
  }, [customers.length, profiles]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingState label="Opening control center" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Header name={profile?.full_name ?? 'IT User'} onProfile={() => router.push('/it/profile')} />
        {message ? <Message type="error">{message}</Message> : null}
        <SummaryCards counts={counts} />
        <SearchShortcut onPress={() => router.push('/it/users')} />
        <ManagementTools
          onUsers={() => router.push('/it/users')}
          onCreate={() => router.push('/it/users')}
          onTree={() => router.push('/it/organization')}
          onInactive={() => router.push('/it/users')}
        />
        <OrganizationPreview onTree={() => router.push('/it/organization')} />
        <RecentActivity profiles={recentProfiles} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ name, onProfile }: { name: string; onProfile: () => void }) {
  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <View style={styles.logoMark}>
          <MaterialCommunityIcons name="shield-account" size={23} color="#0B1F3A" />
        </View>
        <Text style={styles.brand}>InsureIT</Text>
        <Pressable accessibilityRole="button" onPress={onProfile} style={styles.avatar}>
          <Text style={styles.avatarText}>{initialFor(name)}</Text>
        </Pressable>
      </View>
      <View style={styles.headerCard}>
        <View style={styles.headerGlow} />
        <Text style={styles.headerEyebrow}>IT Super User</Text>
        <Text style={styles.headerTitle}>IT Control Center</Text>
        <Text style={styles.headerSubtitle}>Manage users, roles, and organization hierarchy</Text>
      </View>
    </View>
  );
}

function SummaryCards({ counts }: { counts: Counts }) {
  const items = [
    { label: 'Total Users', value: counts.totalUsers, icon: 'account-group-outline' as const, color: '#E8F1FB', accent: '#0B63CE' },
    { label: 'Active Users', value: counts.activeUsers, icon: 'account-check-outline' as const, color: '#EAF8F0', accent: '#18A058' },
    { label: 'Inactive Users', value: counts.inactiveUsers, icon: 'account-off-outline' as const, color: '#FFF4E5', accent: '#F79009' },
    { label: 'Sales Team', value: counts.salesUsers, icon: 'sitemap-outline' as const, color: '#EEF2FF', accent: '#4057C8' },
    { label: 'Agents', value: counts.agents, icon: 'briefcase-account-outline' as const, color: '#F0FDF4', accent: '#067647' },
    { label: 'Customers', value: counts.customers, icon: 'card-account-details-outline' as const, color: '#FEEFEF', accent: '#B42318' },
  ];

  return (
    <View style={styles.summaryGrid}>
      {items.map((item) => (
        <View key={item.label} style={styles.summaryCard}>
          <View style={[styles.summaryIcon, { backgroundColor: item.color }]}>
            <MaterialCommunityIcons name={item.icon} size={22} color={item.accent} />
          </View>
          <Text style={styles.summaryValue}>{item.value}</Text>
          <Text style={styles.summaryLabel} numberOfLines={1}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function SearchShortcut({ onPress }: { onPress: () => void }) {
  return (
    <AnimatedPressable onPress={onPress} style={styles.searchCard}>
      <View style={styles.searchIcon}>
        <MaterialCommunityIcons name="magnify" size={22} color="#0B63CE" />
      </View>
      <View style={styles.searchCopy}>
        <Text style={styles.searchTitle}>Search Users</Text>
        <Text style={styles.searchText} numberOfLines={1}>Find by name, email, phone, or employee code</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={23} color="#667085" />
    </AnimatedPressable>
  );
}

function ManagementTools({ onUsers, onCreate, onTree, onInactive }: { onUsers: () => void; onCreate: () => void; onTree: () => void; onInactive: () => void }) {
  const tools = [
    { title: 'Manage Users', description: 'Create, edit, and reactivate profiles', icon: 'account-cog-outline' as const, onPress: onUsers, tone: '#E8F1FB', color: '#0B63CE' },
    { title: 'Organization Tree', description: 'View reporting hierarchy', icon: 'family-tree' as const, onPress: onTree, tone: '#EAF8F0', color: '#18A058' },
    { title: 'Create User Profile', description: 'Add a new user profile', icon: 'account-plus-outline' as const, onPress: onCreate, tone: '#FFF4E5', color: '#F79009' },
    { title: 'Role Assignment', description: 'Assign role and manager', icon: 'account-switch-outline' as const, onPress: onUsers, tone: '#EEF2FF', color: '#4057C8' },
    { title: 'Inactive Users', description: 'Review disabled profiles', icon: 'account-alert-outline' as const, onPress: onInactive, tone: '#FEEFEF', color: '#B42318' },
  ];

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Management Tools</Text>
      <View style={styles.toolGrid}>
        {tools.map((tool) => (
          <AnimatedPressable key={tool.title} onPress={tool.onPress} wrapperStyle={styles.toolSlot} style={styles.toolCard}>
            <View style={[styles.toolIcon, { backgroundColor: tool.tone }]}>
              <MaterialCommunityIcons name={tool.icon} size={23} color={tool.color} />
            </View>
            <Text style={styles.toolTitle} numberOfLines={1}>{tool.title}</Text>
            <Text style={styles.toolDescription} numberOfLines={2}>{tool.description}</Text>
          </AnimatedPressable>
        ))}
      </View>
    </View>
  );
}

function OrganizationPreview({ onTree }: { onTree: () => void }) {
  const steps = ['Director', 'Sales Head', 'Zonal Head', 'ASM', 'Sales Manager', 'Agent', 'Customer'];
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle}>Organization Overview</Text>
          <Text style={styles.cardText}>Reporting hierarchy guide</Text>
        </View>
        <AnimatedPressable onPress={onTree} style={styles.smallAction}>
          <Text style={styles.smallActionText}>View Full Tree</Text>
        </AnimatedPressable>
      </View>
      <View style={styles.hierarchyWrap}>
        {steps.map((step, index) => (
          <View key={step} style={styles.hierarchyItem}>
            <View style={[styles.hierarchyDot, index === 0 && styles.hierarchyDotActive]} />
            <Text style={styles.hierarchyText} numberOfLines={1}>{step}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function RecentActivity({ profiles }: { profiles: RecentProfile[] }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Recent Activity</Text>
      {profiles.length ? (
        <View style={styles.activityList}>
          {profiles.map((item) => (
            <View key={item.id} style={styles.activityRow}>
              <View style={[styles.activityStatus, item.is_active ? styles.activityActive : styles.activityInactive]} />
              <View style={styles.activityCopy}>
                <Text style={styles.activityName} numberOfLines={1}>{item.full_name}</Text>
                <Text style={styles.activityMeta} numberOfLines={1}>{roleLabels[item.role as AppRole] ?? item.role} | {formatDate(item.updated_at)}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="history" size={25} color="#667085" />
          <View style={styles.emptyCopy}>
            <Text style={styles.emptyTitle}>No recent activity</Text>
            <Text style={styles.emptyText}>User management activity will appear here.</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function AnimatedPressable({ children, style, wrapperStyle, ...props }: PressableProps & { children: ReactNode; wrapperStyle?: StyleProp<ViewStyle> }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={[wrapperStyle, { transform: [{ scale }] }]}>
      <Pressable
        {...props}
        onPressIn={(event) => {
          Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 28, bounciness: 4 }).start();
          props.onPressIn?.(event);
        }}
        onPressOut={(event) => {
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 28, bounciness: 5 }).start();
          props.onPressOut?.(event);
        }}
        style={(state) => [typeof style === 'function' ? style(state) : style, state.pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function initialFor(name: string) {
  return name.trim().charAt(0).toUpperCase() || 'I';
}

function formatDate(date?: string) {
  if (!date) return 'Updated recently';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#EEF2F6' },
  screen: { flex: 1, backgroundColor: '#EEF2F6' },
  content: { paddingHorizontal: 16, paddingBottom: 28 },
  header: { paddingTop: 8, marginBottom: 16 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  logoMark: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D8DEE8' },
  brand: { flex: 1, color: '#0B1F3A', fontSize: 22, fontWeight: '900' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0B1F3A', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  headerCard: { minHeight: 144, borderRadius: 26, backgroundColor: '#0B1F3A', padding: 18, overflow: 'hidden', shadowColor: '#0B1F3A', shadowOpacity: 0.16, shadowRadius: 16, elevation: 3 },
  headerGlow: { position: 'absolute', width: 160, height: 160, borderRadius: 80, right: -44, top: -56, backgroundColor: 'rgba(24,160,88,0.28)' },
  headerEyebrow: { color: '#99F6C8', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8 },
  headerTitle: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', lineHeight: 34 },
  headerSubtitle: { color: '#C7D7EA', fontSize: 14, lineHeight: 20, marginTop: 7 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 16 },
  summaryCard: { width: '48.3%', minHeight: 118, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D8DEE8', padding: 14, shadowColor: '#0B1F3A', shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  summaryIcon: { width: 40, height: 40, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  summaryValue: { color: '#0B1F3A', fontSize: 27, fontWeight: '900' },
  summaryLabel: { color: '#667085', fontSize: 12, fontWeight: '800', marginTop: 2 },
  searchCard: { minHeight: 76, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#B9D5FF', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, shadowColor: '#0B63CE', shadowOpacity: 0.08, shadowRadius: 14, elevation: 2 },
  searchIcon: { width: 44, height: 44, borderRadius: 16, backgroundColor: '#E8F1FB', alignItems: 'center', justifyContent: 'center' },
  searchCopy: { flex: 1, minWidth: 0 },
  searchTitle: { color: '#0B1F3A', fontSize: 16, fontWeight: '900' },
  searchText: { color: '#667085', fontSize: 12, marginTop: 3 },
  section: { marginBottom: 16 },
  sectionTitle: { color: '#0B1F3A', fontSize: 20, fontWeight: '900', marginBottom: 11 },
  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  toolSlot: { width: '48.3%' },
  toolCard: { width: '100%', minHeight: 136, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D8DEE8', padding: 14, shadowColor: '#0B1F3A', shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  toolIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 11 },
  toolTitle: { color: '#0B1F3A', fontSize: 14, fontWeight: '900', lineHeight: 18 },
  toolDescription: { color: '#667085', fontSize: 11, lineHeight: 16, marginTop: 5 },
  card: { borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D8DEE8', padding: 16, marginBottom: 16, shadowColor: '#0B1F3A', shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 },
  cardTitle: { color: '#0B1F3A', fontSize: 18, fontWeight: '900' },
  cardText: { color: '#667085', fontSize: 12, marginTop: 3 },
  smallAction: { borderRadius: 14, backgroundColor: '#E8F1FB', minHeight: 38, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  smallActionText: { color: '#0B63CE', fontSize: 12, fontWeight: '900' },
  hierarchyWrap: { gap: 9 },
  hierarchyItem: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 30 },
  hierarchyDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#C7D7EA' },
  hierarchyDotActive: { backgroundColor: '#18A058' },
  hierarchyText: { color: '#0B1F3A', fontSize: 13, fontWeight: '800' },
  activityList: { gap: 11, marginTop: 12 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  activityStatus: { width: 10, height: 38, borderRadius: 5 },
  activityActive: { backgroundColor: '#18A058' },
  activityInactive: { backgroundColor: '#F79009' },
  activityCopy: { flex: 1, minWidth: 0 },
  activityName: { color: '#0B1F3A', fontSize: 14, fontWeight: '900' },
  activityMeta: { color: '#667085', fontSize: 12, marginTop: 3 },
  emptyState: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, backgroundColor: '#F8FAFC', padding: 14, marginTop: 12 },
  emptyCopy: { flex: 1 },
  emptyTitle: { color: '#0B1F3A', fontSize: 15, fontWeight: '900' },
  emptyText: { color: '#667085', fontSize: 12, lineHeight: 17, marginTop: 3 },
  pressed: { opacity: 0.92 },
});
