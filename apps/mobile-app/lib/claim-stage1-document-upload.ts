import type { User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type StageOnePickedDocument = {
  name: string;
  uri: string;
  mimeType?: string | null;
  size?: number | null;
};

export type StageOneUploadedDocument = StageOnePickedDocument & {
  id: string;
  storageBucket: string;
  storagePath: string;
};

type UploadInput = {
  claimId: string;
  customerId: string;
  documentType: string;
  file: StageOnePickedDocument;
  user: User;
  maxBytes: number;
};

export async function uploadStageOneDocument({ claimId, customerId, documentType, file, user, maxBytes }: UploadInput): Promise<StageOneUploadedDocument> {
  const response = await fetch(file.uri);
  const body = await response.arrayBuffer();
  if (body.byteLength > maxBytes) throw new Error('file_too_large');

  const extension = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
  const storagePath = `${customerId}/${claimId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const storageBucket = 'claim-documents';
  const uploaded = await supabase.storage.from(storageBucket).upload(storagePath, body, {
    contentType: file.mimeType ?? 'application/octet-stream',
    upsert: false,
  });
  if (uploaded.error) throw uploaded.error;

  const { data, error } = await supabase.from('claim_documents').insert({
    claim_id: claimId,
    customer_id: customerId,
    document_type: documentType,
    file_name: file.name,
    storage_bucket: storageBucket,
    storage_path: storagePath,
    mime_type: file.mimeType ?? null,
    file_size: file.size ?? body.byteLength,
    uploaded_by: user.id,
  }).select('id').single();

  if (error || !data?.id) {
    await supabase.storage.from(storageBucket).remove([storagePath]);
    throw error ?? new Error('claim_document_not_saved');
  }

  return { ...file, id: data.id, storageBucket, storagePath };
}

export async function uploadStageOneDocumentsConcurrently<T>(items: readonly T[], upload: (item: T) => Promise<StageOneUploadedDocument>, concurrency = 3) {
  const results: PromiseSettledResult<StageOneUploadedDocument>[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      try {
        results[index] = { status: 'fulfilled', value: await upload(items[index]) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export async function deleteStageOneDocuments(documents: StageOneUploadedDocument[]) {
  if (!documents.length) return;
  const ids = documents.map((document) => document.id);
  const removeRecords = await supabase.from('claim_documents').delete().in('id', ids);
  if (removeRecords.error) throw removeRecords.error;

  const pathsByBucket = new Map<string, string[]>();
  for (const document of documents) {
    pathsByBucket.set(document.storageBucket, [...(pathsByBucket.get(document.storageBucket) ?? []), document.storagePath]);
  }
  await Promise.all([...pathsByBucket.entries()].map(async ([bucket, paths]) => {
    await supabase.storage.from(bucket).remove(paths);
  }));
}
