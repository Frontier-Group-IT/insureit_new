import { useEffect, useState } from 'react';

import { Button, Card, EmptyState, LoadingState, Row, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';
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

  if (loading) return <Screen title="Follow-up Tasks"><LoadingState /></Screen>;

  return (
    <Screen title="Follow-up Tasks" showLogout>
      {tasks.length === 0 ? <EmptyState title="No tasks found" body="Claim follow-up work will appear here." /> : tasks.map((task) => (
        <Card key={task.id}>
          <Row label="Task" value={task.title} />
          <Row label="Description" value={task.description} />
          <Row label="Due date" value={task.due_date} />
          <Row label="Status" value={task.status} />
          {task.status !== 'completed' ? <Button label="Mark completed" onPress={() => void complete(task)} /> : null}
        </Card>
      ))}
    </Screen>
  );
}
