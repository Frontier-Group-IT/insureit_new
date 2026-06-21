import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppBadge } from '@/components/design-system';
import { EmptyState, LoadingState, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { palette, radii } from '@/lib/theme';
import type { ClaimTask } from '@/lib/types';

export default function TasksScreen() {
  const [tasks, setTasks] = useState<ClaimTask[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase.from('claim_tasks').select('*').order('due_date', { ascending: true }).limit(50);
    setTasks(data ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function complete(task: ClaimTask) {
    await supabase.from('claim_tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', task.id);
    void load();
  }

  if (loading) return <Screen title="Tasks"><LoadingState /></Screen>;

  return (
    <Screen title="Tasks" subtitle={`${tasks.length} follow-ups`} showLogout>
      {tasks.length === 0 ? <EmptyState title="No tasks found" body="Claim follow-ups will appear here." /> : tasks.map((task) => (
        <View key={task.id} style={styles.taskRow}>
          <View style={styles.taskIcon}>
            <MaterialCommunityIcons name={task.status === 'completed' ? 'check-circle-outline' : 'clipboard-clock-outline'} size={20} color={task.status === 'completed' ? palette.emerald : palette.amber} />
          </View>
          <View style={styles.taskCopy}>
            <Text style={styles.taskTitle}>{task.title}</Text>
            {task.description ? <Text style={styles.taskDescription} numberOfLines={2}>{task.description}</Text> : null}
            <Text style={styles.taskMeta}>{task.due_date ?? 'No due date'}</Text>
          </View>
          <View style={styles.taskSide}>
            <AppBadge label={task.status} tone={task.status === 'completed' ? 'success' : 'warning'} />
            {task.status !== 'completed' ? (
              <Pressable accessibilityRole="button" onPress={() => void complete(task)} style={styles.doneButton}>
                <Text style={styles.doneText}>Done</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: radii.sm, padding: 11, marginBottom: 8 },
  taskIcon: { width: 38, height: 38, borderRadius: radii.sm, backgroundColor: palette.amberSoft, alignItems: 'center', justifyContent: 'center' },
  taskCopy: { flex: 1, minWidth: 0 },
  taskTitle: { color: palette.ink, fontSize: 14, fontWeight: '700' },
  taskDescription: { color: palette.slate, fontSize: 12, fontWeight: '500', lineHeight: 17, marginTop: 3 },
  taskMeta: { color: palette.slate, fontSize: 12, fontWeight: '500', marginTop: 4 },
  taskSide: { alignItems: 'flex-end', gap: 8 },
  doneButton: { minHeight: 30, borderRadius: radii.sm, backgroundColor: palette.emeraldSoft, borderWidth: 1, borderColor: '#BCEBD5', paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  doneText: { color: palette.emerald, fontSize: 12, fontWeight: '700' },
});
