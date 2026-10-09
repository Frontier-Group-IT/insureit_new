import { getAuth } from '@react-native-firebase/auth';

/**
 * Firebase customer document reader for the controlled migration.
 * Calls only the trusted, document ownership checked backend.
 * Never uses a service role key, caller-selected profile UUID or a
 * long-lived signed URL cache.
 */
export type FirebasePrivateDocumentBucket = 'claim-documents' | 'customer-documents';

export async function getFirebaseCustomerDocumentUrl(
  bucket: FirebasePrivateDocumentBucket,
  path: string,
): Promise<string> {
  if (!['claim-documents', 'customer-documents'].includes(bucket)) {
    throw new Error('Document bucket is not supported.');
  }
  if (!path || path.length > 1024 || path.startsWith('/') ||
      path.split('/').some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error('Document path is invalid.');
  }
  const user = getAuth().currentUser;
  if (!user) throw new Error('Firebase customer authentication required.');
  const token = await user.getIdToken();
  if (!token) throw new Error('Firebase token unavailable.');
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !base.startsWith('https://') || !key) {
    throw new Error('Customer document service unavailable.');
  }
  const response = await fetch(`${base}/functions/v1/customer-firebase-doc-read`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket, path }),
  });
  if (!response.ok) throw new Error('This document is unavailable for your customer account.');
  const result: { url?: string; expiresIn?: number } = await response.json();
  if (typeof result.url !== 'string' || !result.url.startsWith(base + '/storage/v1/') ||
      typeof result.expiresIn !== 'number' || result.expiresIn > 60 ||
      result.expiresIn < 1) {
    throw new Error('Document authorization response invalid.');
  }
  return result.url;
}
