import { useEffect, useState } from 'react';

import { Button, Card, EmptyState, LoadingState, Message, Row, Screen, TextField } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { ClaimDocument } from '@/lib/types';

export default function DocumentsScreen() {
  const [documents, setDocuments] = useState<ClaimDocument[]>([]);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase.from('claim_documents').select('*').order('created_at', { ascending: false }).limit(50);
    setDocuments(data ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function review(document: ClaimDocument, verification_status: 'verified' | 'rejected') {
    const session = await getCurrentSession();
    const { error } = await supabase.from('claim_documents').update({ verification_status, verified_by: session?.user.id ?? null, verified_at: new Date().toISOString(), rejection_reason: verification_status === 'rejected' ? reason.trim() || 'Needs review' : null }).eq('id', document.id);
    if (error) setMessage('We could not save the document review.');
    else void load();
  }

  if (loading) return <Screen title="Document Review"><LoadingState /></Screen>;

  return (
    <Screen title="Document Review" showLogout>
      {message ? <Message type="error">{message}</Message> : null}
      <TextField label="Rejection reason" value={reason} onChangeText={setReason} />
      {documents.length === 0 ? <EmptyState title="No documents found" body="Customer uploads appear here for review." /> : documents.map((document) => (
        <Card key={document.id}>
          <Row label="Document" value={document.file_name} />
          <Row label="Type" value={document.document_type} />
          <Row label="Status" value={document.verification_status} />
          <Button label="Mark verified" onPress={() => void review(document, 'verified')} />
          <Button label="Mark rejected" variant="danger" onPress={() => void review(document, 'rejected')} />
        </Card>
      ))}
    </Screen>
  );
}
