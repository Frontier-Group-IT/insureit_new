import { getCustomerIdentity } from './customer-identity';
import { getFirebaseCustomerDocumentUrl, type FirebasePrivateDocumentBucket } from './firebase-document-client';
import { uploadFirebaseCustomerDocument, type FirebaseCustomerUploadBucket } from './firebase-upload-client';

/** Customer-only private Storage boundary. Never reuse stale Supabase sessions for Firebase. */
export async function getCustomerPrivateDocumentUrl(bucket: string, path: string): Promise<string> {
  const identity = await getCustomerIdentity();
  if (!identity) throw new Error('Customer sign-in required.');
  if (identity.provider === 'firebase') {
    if (bucket !== 'claim-documents' && bucket !== 'customer-documents' && bucket !== 'policy-documents') {
      throw new Error('Document bucket is not approved.');
    }
    return getFirebaseCustomerDocumentUrl(bucket as FirebasePrivateDocumentBucket, path);
  }
  const { data, error } = await identity.data.storage.from(bucket).createSignedUrl(path, 60);
  if (error || !data?.signedUrl) throw new Error('Customer document access failed.');
  return data.signedUrl;
}

export async function uploadCustomerPrivateDocument(input: {
  bucket: FirebaseCustomerUploadBucket;
  path: string;
  bytes: ArrayBuffer;
  contentType: string;
}): Promise<void> {
  const identity = await getCustomerIdentity();
  if (!identity) throw new Error('Customer sign-in required.');
  if (identity.provider === 'firebase') {
    await uploadFirebaseCustomerDocument({
      bucket: input.bucket, path: input.path, file: input.bytes, contentType: input.contentType,
    });
    return;
  }
  const { error } = await identity.data.storage.from(input.bucket).upload(input.path, input.bytes, {
    contentType: input.contentType, upsert: false,
  });
  if (error) throw new Error('Customer document upload failed.');
}

/** Firebase deletion must wait for a separately verified server ownership check. */
export async function removeCustomerPrivateDocument(bucket: string, path: string): Promise<boolean> {
  const identity = await getCustomerIdentity();
  if (!identity) throw new Error('Customer sign-in required.');
  if (identity.provider === 'firebase') return false;
  const { error } = await identity.data.storage.from(bucket).remove([path]);
  return !error;
}
