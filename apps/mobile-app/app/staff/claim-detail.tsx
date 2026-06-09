import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Button, Card, EmptyState, LoadingState, Row, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import type { Claim, ClaimDocument, ClaimHistory, ClaimTask } from '@/lib/types';

export default function StaffClaimDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [claim, setClaim] = useState<Claim | null>(null);
  const [history, setHistory] = useState<ClaimHistory[]>([]);
  const [documents, setDocuments] = useState<ClaimDocument[]>([]);
  const [tasks, setTasks] = useState<ClaimTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const [claimResult, historyResult, documentsResult, tasksResult] = await Promise.all([
        supabase.from('claims').select('*').eq('id', id).maybeSingle(),
        supabase.from('claim_status_history').select('*').eq('claim_id', id).order('created_at', { ascending: false }),
        supabase.from('claim_documents').select('*').eq('claim_id', id).order('created_at', { ascending: false }),
        supabase.from('claim_tasks').select('*').eq('claim_id', id).order('created_at', { ascending: false }),
      ]);
      setClaim(claimResult.data);
      setHistory(historyResult.data ?? []);
      setDocuments(documentsResult.data ?? []);
      setTasks(tasksResult.data ?? []);
      setLoading(false);
    }
    void load();
  }, [id]);

  if (loading) return <Screen title="Claim Detail"><LoadingState /></Screen>;
  if (!claim) return <Screen title="Claim Detail"><EmptyState title="Claim not found" body="Select another claim from the list." /></Screen>;

  return (
    <Screen title="Claim Detail" showLogout>
      <Card>
        <Row label="Claim number" value={claim.claim_no} />
        <Row label="Status" value={claim.current_status} />
        <Row label="Location" value={claim.accident_location} />
        <Row label="Estimated loss" value={claim.estimated_loss} />
      </Card>
      <Link href={{ pathname: '/staff/update-status', params: { id: claim.id } }} asChild><Button label="Update Claim Status" onPress={() => undefined} /></Link>
      <Card>
        <Row label="Documents" value={documents.length} />
        {documents.map((document) => <Row key={document.id} label={document.document_type} value={`${document.file_name} • ${document.verification_status}`} />)}
      </Card>
      <Card>
        <Row label="Follow-up tasks" value={tasks.length} />
        {tasks.map((task) => <Row key={task.id} label={task.title} value={task.status} />)}
      </Card>
      <Card>
        <Row label="Status timeline" value={history.length ? undefined : 'No updates yet'} />
        {history.map((item) => <Row key={item.id} label={item.to_status} value={item.notes ?? item.created_at?.slice(0, 10)} />)}
      </Card>
    </Screen>
  );
}
