import { getAuth } from '@react-native-firebase/auth';
import { createClient } from '@supabase/supabase-js';

/** Upload only to a verified customer-owned path with a server-signed ticket.
 * Never exposes Supabase service credentials or bypasses customer identity.
 */
export type FirebaseCustomerUploadBucket = 'claim-documents' | 'customer-documents';
export type FirebaseCustomerUploadFile = Blob | File | ArrayBuffer;

export async function uploadFirebaseCustomerDocument(input: {
  bucket: FirebaseCustomerUploadBucket;
  path: string;
  file: FirebaseCustomerUploadFile;
  contentType: string;
}): Promise<void> {
  const { bucket, path, file, contentType } = input;
  if (!['claim-documents', 'customer-documents'].includes(bucket) ||
      path.length < 38 || path.length > 1024 || path.includes('%') ||
      path.includes('\\') || path.startsWith('/') ||
      path.split('/').some((section) => !section || section === '.' || section === '..')) {
    throw new Error('The customer document path is invalid.');
  }
  const uid = getAuth().currentUser?.uid;
  if (!uid) throw new Error('Firebase customer sign-in is required.');
  const idToken = await getAuth().currentUser?.getIdToken();
  if (!idToken) throw new Error('Firebase sign-in token unavailable.');

  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !base.startsWith('https://') || !publicKey) {
    throw new Error('Customer document uploads are not configured.');
  }
  const response = await fetch(`${base}/functions/v1/customer-firebase-upload-url`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, apikey: publicKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket, path }),
  });
  if (!response.ok) throw new Error('Upload access was not approved for your account.');
  const ticket: { bucket?: string; path?: string; token?: string; signedUrl?: string } = await response.json();
  if (ticket.bucket !== bucket || ticket.path !== path ||
      typeof ticket.token !== 'string' || !ticket.token ||
      typeof ticket.signedUrl !== 'string' ||
      !ticket.signedUrl.startsWith(base + '/storage/v1/')) {
    throw new Error('The upload authorization ticket is invalid.');
  }

  // The short-scope upload ticket is independently checked by Supabase
  // Storage. Use a distinct public-key client: do not send Firebase bearer
  // JWTs directly to Storage endpoints where auth.uid() expects UUID.
  if (getAuth().currentUser?.uid !== uid) throw new Error('Customer changed during upload.');
  const uploader = createClient(base, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await uploader.storage.from(bucket)
    .uploadToSignedUrl(path, ticket.token, file, {
      contentType,
      upsert: false,
    });
  if (error) throw new Error('Customer document upload could not be completed.');
}
