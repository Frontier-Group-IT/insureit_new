import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, EmptyState, LoadingState, Message, Screen } from '@/components/ui';
import { getCurrentSession, getProfile, isValidProfile } from '@/lib/auth';
import { canManageUsers, isSalesHierarchyRole, roleLabels } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import { palette, radii } from '@/lib/theme';
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
        if (!isValidProfile(profile) || (!canManageUsers(profile.role) && !isSalesHierarchyRole(profile.role))) return router.replace('/access-denied');
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
      <Screen title="Organization Hierarchy">
        <LoadingState label="Loading hierarchy" />
      </Screen>
    );
  }

  return (
    <Screen title="Organization" subtitle="Reporting structure">
      {message ? <Message type="error">{message}</Message> : null}
      <View style={styles.sectionBadge}>
        <MaterialCommunityIcons name="family-tree" size={22} color="#18A058" />
        <Text style={styles.sectionBadgeText}>Reporting map</Text>
      </View>
      {tree.length ? tree.map((node) => <NodeCard key={node.id} node={node} depth={0} />) : (
        <EmptyState title="No profiles found" body="Create users to start building the hierarchy." />
      )}
      <Button label="Back" variant="secondary" onPress={() => router.back()} />
    </Screen>
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
  sectionBadge: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: palette.surface, borderRadius: radii.sm, borderWidth: 1, borderColor: palette.line, padding: 12, marginBottom: 10 },
  sectionBadgeText: { color: palette.ink, fontSize: 15, fontWeight: '700' },
  nodeCard: { backgroundColor: palette.surface, borderRadius: radii.sm, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: palette.line },
  nodeTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot: { width: 11, height: 11, borderRadius: 6 },
  activeDot: { backgroundColor: palette.emerald },
  inactiveDot: { backgroundColor: palette.amber },
  nodeCopy: { flex: 1, minWidth: 0 },
  nodeName: { color: palette.ink, fontSize: 15, fontWeight: '700' },
  nodeMeta: { color: palette.slate, fontSize: 12, marginTop: 3 },
  statusText: { fontSize: 11, fontWeight: '600' },
  activeText: { color: '#067647' },
  inactiveText: { color: '#B54708' },
  children: { marginTop: 10 },
});
