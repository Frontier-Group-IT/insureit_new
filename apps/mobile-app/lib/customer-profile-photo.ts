import { supabase } from '@/lib/supabase';

type PhotoUpdate = { customerId: string; url: string | null };
const listeners = new Set<(update: PhotoUpdate) => void>();

/** The same latest "Profile Photo" customer document used on the Profile screen. */
export async function getCustomerProfilePhotoUrl(customerId: string): Promise<string | null> {
  const { data, error } = await supabase.from('customer_documents')
    .select('storage_bucket,storage_path')
    .eq('customer_id', customerId)
    .eq('document_type', 'Profile Photo')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.storage_bucket || !data.storage_path) return null;

  const signed = await supabase.storage.from(data.storage_bucket)
    .createSignedUrl(data.storage_path, 3600);
  return signed.error ? null : signed.data?.signedUrl ?? null;
}

/** Keep the top-right avatar current immediately after an in-app photo upload. */
export function publishCustomerProfilePhoto(update: PhotoUpdate) {
  listeners.forEach((listener) => listener(update));
}

export function subscribeCustomerProfilePhoto(listener: (update: PhotoUpdate) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
