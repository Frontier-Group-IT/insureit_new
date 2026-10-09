import type { DocumentPickerAsset } from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';

export type PreparedCustomerDocument = {
  uri: string;
  name: string;
  mimeType: string | null;
  size: number;
};

const CACHE_DIRECTORY_NAME = 'customer-kyc-documents';

export async function prepareCustomerDocument(
  asset: DocumentPickerAsset,
  maxBytes: number,
): Promise<PreparedCustomerDocument> {
  const source = new File(asset);
  if (!source.exists) {
    throw new Error('The selected document is no longer available on this device.');
  }

  const cacheDirectory = new Directory(Paths.cache, CACHE_DIRECTORY_NAME);
  cacheDirectory.create({ idempotent: true, intermediates: true });

  const safeName = sanitizeFileName(asset.name || source.name || 'document');
  const stable = new File(cacheDirectory, `${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`);

  source.copy(stable);

  if (!stable.exists) {
    throw new Error('The selected document could not be copied into secure app storage.');
  }

  const bytes = await stable.bytes();
  if (!bytes.byteLength) {
    tryDelete(stable);
    throw new Error('The selected document is empty or unreadable.');
  }
  if (bytes.byteLength > maxBytes) {
    tryDelete(stable);
    throw new Error('The selected document is larger than the allowed size.');
  }

  return {
    uri: stable.uri,
    name: asset.name || source.name || safeName,
    mimeType: asset.mimeType ?? stable.type ?? null,
    size: bytes.byteLength,
  };
}

export async function readPreparedCustomerDocument(uri: string): Promise<ArrayBuffer> {
  const file = new File(uri);
  if (!file.exists) {
    throw new Error('The selected document is no longer available. Please choose it again.');
  }

  const bytes = await file.bytes();
  if (!bytes.byteLength) {
    throw new Error('The selected document could not be read. Please choose it again.');
  }

  return new Uint8Array(bytes).buffer;
}

export function removePreparedCustomerDocument(uri: string) {
  try {
    const file = new File(uri);
    tryDelete(file);
  } catch {
    // Cache cleanup must never block KYC completion.
  }
}

function tryDelete(file: File) {
  try {
    if (file.exists) file.delete();
  } catch {
    // Best-effort cache cleanup only.
  }
}

function sanitizeFileName(value: string) {
  const cleaned = value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || 'document';
}
