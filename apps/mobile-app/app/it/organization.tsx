import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, LoadingState, Message } from '@/components/ui';
import { getCurrentSession, getProfile, isValidProfile } from '@/lib/auth';
import { canManageUsers, roleLabels } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

type OrgNode = Profile & { children: OrgNode[] };

export default function ItOrganizationScreen() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const session = await getCurrentSession();
        if (!session?.user) return router.replace('/login');
        const profile = await getProfile(session.user.id);
        if (!isValidProfile(profile) || !canManageUsers(profile.role)) return router.replace('/access-denied');
        const { data, error } = await supabase.from('profiles').select('*').order('full_name');
        if (error) throw error;
        setProfiles(data ?? []);
      } catch (error) {
        console.error('IT organization load failed', error);
        setMessage('We could not load the organization hierarchy.');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [router]);

  const tree = useMemo(() => buildTree(profiles), [profiles]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingState label="Loading hierarchy" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <MaterialCommunityIcons name="family-tree" size={24} color="#18A058" />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Organization Hierarchy</Text>
            <Text style={styles.subtitle}>Reporting managers and team structure</Text>
          </View>
        </View>
        {message ? <Message type="error">{message}</Message> : null}
        {tree.length ? tree.map((node) => <NodeCard key={node.id} node={node} depth={0} />) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No profiles found</Text>
            <Text style={styles.emptyText}>Create users to start building the hierarchy.</Text>
          </View>
        )}
        <Button label="Back to control center" variant="secondary" onPress={() => router.replace('/it/dashboard')} />
      </ScrollView>
    </SafeAreaView>
  );
}

function buildTree(rows: Profile[]) {
  const nodes = new Map<string, OrgNode>();
  rows.forEach((row) => nodes.set(row.id, { ...row, children: [] }));
  const roots: OrgNode[] = [];
  nodes.forEach((node) => {
    const parent = node.reporting_manager_id ? nodes.get(node.reporting_manager_id) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });
  return roots;
}

function NodeCard({ node, depth }: { node: OrgNode; depth: number }) {
  return (
    <View style={[styles.nodeCard, { marginLeft: Math.min(depth * 14, 42) }]}>
      <View style={styles.nodeTop}>
        <View style={[styles.statusDot, node.is_active ? styles.activeDot : styles.inactiveDot]} />
        <View style={styles.nodeCopy}>
          <Text style={styles.nodeName} numberOfLines={1}>{node.full_name}</Text>
          <Text style={styles.nodeMeta} numberOfLines={1}>{roleLabels[node.role]} {node.employee_code ? `| ${node.employee_code}` : ''}</Text>
        </View>
        <Text style={[styles.statusText, node.is_active ? styles.activeText : styles.inactiveText]}>{node.is_active ? 'Active' : 'Inactive'}</Text>
      </View>
      {node.children.length ? (
        <View style={styles.children}>
          {node.children.map((child) => <NodeCard key={child.id} node={child} depth={depth + 1} />)}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#EEF2F6' },
  screen: { flex: 1, backgroundColor: '#EEF2F6' },
  content: { padding: 16, paddingBottom: 28 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  headerIcon: { width: 48, height: 48, borderRadius: 18, backgroundColor: '#EAF8F0', alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { color: '#0B1F3A', fontSize: 24, fontWeight: '900' },
  subtitle: { color: '#667085', fontSize: 13, marginTop: 3 },
  nodeCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: '#D8DEE8', shadowColor: '#0B1F3A', shadowOpacity: 0.05, shadowRadius: 10, elevation: 1 },
  nodeTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot: { width: 11, height: 11, borderRadius: 6 },
  activeDot: { backgroundColor: '#18A058' },
  inactiveDot: { backgroundColor: '#F79009' },
  nodeCopy: { flex: 1, minWidth: 0 },
  nodeName: { color: '#0B1F3A', fontSize: 15, fontWeight: '900' },
  nodeMeta: { color: '#667085', fontSize: 12, marginTop: 3 },
  statusText: { fontSize: 11, fontWeight: '900' },
  activeText: { color: '#067647' },
  inactiveText: { color: '#B54708' },
  children: { marginTop: 10 },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 16, borderWidth: 1, borderColor: '#D8DEE8', marginBottom: 16 },
  emptyTitle: { color: '#0B1F3A', fontSize: 17, fontWeight: '900' },
  emptyText: { color: '#667085', fontSize: 13, marginTop: 5 },
});
