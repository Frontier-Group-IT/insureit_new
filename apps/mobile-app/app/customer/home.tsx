import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AccidentHeroCard,
  ActionRequiredCard,
  ActiveClaimCard,
  ActiveClaimView,
  BottomNavigation,
  DashboardHeader,
  DashboardShell,
  PolicyReminderCard,
  QuickActionGrid,
  SummaryCards,
  SupportCard,
} from '@/components/customer-dashboard';
import { LoadingState } from '@/components/ui';
import { getCurrentSession, getCustomerForUser, getProfile, isValidProfile, signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Claim, ClaimDocument, Customer, Policy, Profile, Vehicle } from '@/lib/types';

const activeClaimStatuses = new Set([
  'Draft',
  'Accident Reported',
  'Documents Pending',
  'Documents Submitted',
  'Claim Intimated',
  'Surveyor Appointed',
  'Vehicle Inspected',
  'Estimate Submitted',
  'Approval Pending',
  'Repair Started',
  'Repair Completed',
  'Final Bill Submitted',
  'Settlement Under Process',
]);

export default function CustomerHomeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [documents, setDocuments] = useState<ClaimDocument[]>([]);
  const [counts, setCounts] = useState({ vehicles: 0, policies: 0, claims: 0 });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setError('');
        const session = await withTimeout(getCurrentSession(), 12000);
        if (!active) return;
        if (!session?.user) return router.replace('/login');
        const nextProfile = await withTimeout(getProfile(session.user.id), 12000);
        if (!active) return;
        if (!isValidProfile(nextProfile) || nextProfile.role !== 'customer') return router.replace('/access-denied');
        const nextCustomer = await withTimeout(getCustomerForUser(session.user.id), 12000);
        if (!active) return;
        setProfile(nextProfile);
        setCustomer(nextCustomer);

        if (nextCustomer) {
          const [vehicleResult, policyResult, claimResult, documentResult] = await withTimeout(Promise.all([
            supabase.from('vehicles').select('*').eq('customer_id', nextCustomer.id).order('created_at', { ascending: false }),
            supabase.from('policies').select('*').eq('customer_id', nextCustomer.id).order('end_date', { ascending: true }),
            supabase.from('claims').select('*').eq('customer_id', nextCustomer.id).order('created_at', { ascending: false }),
            supabase.from('claim_documents').select('*').eq('customer_id', nextCustomer.id).order('created_at', { ascending: false }),
          ]), 15000);
          if (!active) return;
          const nextVehicles = vehicleResult.data ?? [];
          const nextPolicies = policyResult.data ?? [];
          const nextClaims = claimResult.data ?? [];
          setVehicles(nextVehicles);
          setPolicies(nextPolicies);
          setClaims(nextClaims);
          setDocuments(documentResult.data ?? []);
          setCounts({
            vehicles: nextVehicles.length,
            policies: nextPolicies.filter((policy) => isActiveDate(policy.end_date)).length,
            claims: nextClaims.length,
          });
        }
      } catch {
        if (active) setError('We could not load your dashboard. Check your connection and try again.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [router]);

  const displayName = customer?.contact_name ?? profile?.full_name ?? 'Customer';
  const latestActiveClaim = useMemo(() => claims.find((claim) => activeClaimStatuses.has(claim.current_status)), [claims]);
  const activeClaimVehicle = latestActiveClaim ? vehicles.find((vehicle) => vehicle.id === latestActiveClaim.vehicle_id) : null;
  const activeClaimView: ActiveClaimView | null = latestActiveClaim ? {
    id: latestActiveClaim.id,
    claimNo: latestActiveClaim.claim_no,
    vehicleNo: activeClaimVehicle?.vehicle_no ?? 'Not available',
    status: latestActiveClaim.current_status,
    lastUpdated: formatDateTime(latestActiveClaim.updated_at ?? latestActiveClaim.created_at),
  } : null;
  const rejectedDocuments = documents.filter((document) => document.verification_status === 'rejected');
  const needsDocuments = latestActiveClaim?.current_status === 'Documents Pending' || rejectedDocuments.length > 0;
  const expiringPolicy = useMemo(() => findExpiringPolicy(policies), [policies]);
  const expiringVehicle = expiringPolicy ? vehicles.find((vehicle) => vehicle.id === expiringPolicy.vehicle_id) : null;

  if (loading) return <LoadingShell />;
  if (error) return <ErrorShell message={error} onRetry={() => router.replace('/customer/home')} onSignOut={() => void signOut(router)} />;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <DashboardShell>
          <DashboardHeader name={displayName} onProfile={() => router.push('/customer/profile')} />
          <AccidentHeroCard onPress={() => router.push('/customer/report-accident')} />
          <ActiveClaimCard claim={activeClaimView} onOpen={() => activeClaimView && router.push({ pathname: '/customer/claim-detail', params: { id: activeClaimView.id } })} />
          <ActionRequiredCard required={needsDocuments} count={rejectedDocuments.length || (needsDocuments ? 1 : 0)} onUpload={() => router.push('/customer/upload-documents')} />
          <QuickActionGrid actions={[
            { title: 'My Claims', subtitle: 'Track every claim', icon: 'file-document-check-outline', tone: '#E8F1FB', onPress: () => router.push('/customer/claims') },
            { title: 'My Vehicles', subtitle: 'Registered fleet', icon: 'truck-outline', tone: '#EAF8F0', onPress: () => router.push('/customer/vehicles') },
            { title: 'My Policies', subtitle: 'Policy records', icon: 'shield-outline', tone: '#FFF4E5', onPress: () => router.push('/customer/policies') },
            { title: 'Upload Docs', subtitle: 'Send claim files', icon: 'cloud-upload-outline', tone: '#FEEFEF', onPress: () => router.push('/customer/upload-documents') },
            { title: 'Support', subtitle: 'Get assistance', icon: 'headset', tone: '#E8F1FB', onPress: () => router.push('/customer/support') },
            { title: 'Reminders', subtitle: 'Policy alerts', icon: 'bell-outline', tone: '#EAF8F0', onPress: () => router.push('/customer/policies') },
          ]} />
          <SummaryCards counts={counts} />
          <PolicyReminderCard vehicleNo={expiringVehicle?.vehicle_no} expiry={expiringPolicy ? formatDate(expiringPolicy.end_date) : undefined} onView={() => router.push('/customer/policies')} />
          <SupportCard onSupport={() => router.push('/customer/support')} />
          <BottomNavigation
            onClaims={() => router.push('/customer/claims')}
            onVehicles={() => router.push('/customer/vehicles')}
            onDocuments={() => router.push('/customer/upload-documents')}
            onSupport={() => router.push('/customer/support')}
          />
        </DashboardShell>
      </ScrollView>
    </SafeAreaView>
  );
}

function LoadingShell() {
  return (
    <View style={styles.loadingScreen}>
      <LoadingState label="Opening your dashboard" />
    </View>
  );
}

function ErrorShell({ message, onRetry, onSignOut }: { message: string; onRetry: () => void; onSignOut: () => void }) {
  return (
    <View style={styles.loadingScreen}>
      <View style={styles.errorCard}>
        <Text style={styles.errorTitle}>Dashboard unavailable</Text>
        <Text style={styles.errorText}>{message}</Text>
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Try Again</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onSignOut} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

function isActiveDate(date: string) {
  return new Date(date).getTime() >= startOfToday().getTime();
}

function findExpiringPolicy(policies: Policy[]) {
  const today = startOfToday().getTime();
  const soon = today + 30 * 24 * 60 * 60 * 1000;
  return policies.find((policy) => {
    const end = new Date(policy.end_date).getTime();
    return end >= today && end <= soon;
  }) ?? null;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(date?: string) {
  if (!date) return 'Not available';
  return new Date(date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out')), timeoutMs);
    }),
  ]);
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#EEF2F6' },
  screen: { flex: 1, backgroundColor: '#EEF2F6' },
  content: { paddingHorizontal: 16, paddingBottom: 26 },
  loadingScreen: { flex: 1, backgroundColor: '#EEF2F6', justifyContent: 'center' },
  errorCard: { width: '90%', alignSelf: 'center', backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: '#D8DEE8' },
  errorTitle: { color: '#0B1F3A', fontSize: 20, fontWeight: '900', marginBottom: 8 },
  errorText: { color: '#667085', fontSize: 14, lineHeight: 20 },
  primaryButton: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 14, backgroundColor: '#18A058' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  secondaryButton: { minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8, borderWidth: 1, borderColor: '#0B1F3A' },
  secondaryButtonText: { color: '#0B1F3A', fontSize: 15, fontWeight: '900' },
});
