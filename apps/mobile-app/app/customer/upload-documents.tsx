import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { Button, Card, Message, Row, Screen, TextField } from '@/components/ui';
import { getCurrentSession, getCustomerForUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Claim } from '@/lib/types';

type PickedFile = { uri: string; name: string; mimeType: string | null; size: number | null };

export default function UploadDocumentsScreen() {
  const router = useRouter();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [claimNo, setClaimNo] = useState('');
  const [documentType, setDocumentType] = useState('Accident photo');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');
      const customer = await getCustomerForUser(session.user.id);
      if (customer) {
        const { data } = await supabase.from('claims').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false });
        setClaims(data ?? []);
      }
    }
    void load();
  }, [router]);

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setFile({ uri: asset.uri, name: asset.fileName ?? `accident-photo-${Date.now()}.jpg`, mimeType: asset.mimeType ?? 'image/jpeg', size: asset.fileSize ?? null });
    }
  }

  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], copyToCacheDirectory: true });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? null, size: asset.size ?? null });
    }
  }

  async function upload() {
    setMessage('');
    setSuccess('');
    const session = await getCurrentSession();
    if (!session?.user) return router.replace('/login');
    const customer = await getCustomerForUser(session.user.id);
    const claim = claims.find((item) => item.claim_no.toLowerCase() === claimNo.trim().toLowerCase());
    if (!customer || !claim || !file) return setMessage('Choose a claim and file before uploading.');

    const extension = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
    const storagePath = `${customer.id}/${claim.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    const response = await fetch(file.uri);
    const body = await response.arrayBuffer();
    const uploadResult = await supabase.storage.from('claim-documents').upload(storagePath, body, { contentType: file.mimeType ?? 'application/octet-stream', upsert: false });
    if (uploadResult.error) return setMessage('We could not upload this file. Please try again.');
    const { error } = await supabase.from('claim_documents').insert({ claim_id: claim.id, customer_id: customer.id, document_type: documentType.trim(), file_name: file.name, storage_bucket: 'claim-documents', storage_path: storagePath, mime_type: file.mimeType, file_size: file.size, uploaded_by: session.user.id });
    if (error) setMessage('The file uploaded, but the document record could not be saved. Please contact support.');
    else {
      setSuccess('Document uploaded successfully.');
      setFile(null);
    }
  }

  return (
    <Screen title="Upload Claim Documents" subtitle="Attach accident photos, bills, reports, or other claim files." showLogout>
      <Card>
        {message ? <Message type="error">{message}</Message> : null}
        {success ? <Message type="success">{success}</Message> : null}
        <TextField label="Claim number" value={claimNo} onChangeText={setClaimNo} />
        <TextField label="Document type" value={documentType} onChangeText={setDocumentType} />
        <Button label="Choose accident photo" variant="secondary" onPress={pickPhoto} />
        <Button label="Choose document" variant="secondary" onPress={pickDocument} />
        <Row label="Selected file" value={file?.name} />
        <Button label="Upload file" onPress={upload} />
      </Card>
      <Card>
        <Row label="Your claims" value={claims.map((item) => item.claim_no).join(', ')} />
      </Card>
    </Screen>
  );
}
