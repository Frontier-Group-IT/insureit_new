import { supabase } from './supabase';

type ResumableUploadOptions = {
  uri: string;
  accessToken: string;
  bucket: string;
  objectPath: string;
  contentType: string;
  maxBytes: number;
  onProgress?: (progress: number) => void;
};

export type ResumableUploadResult = {
  size: number;
};

const TUS_VERSION = '1.0.0';
const TUS_CHUNK_SIZE_BYTES = 6 * 1024 * 1024;
const RETRY_DELAYS_MS = [0, 1000, 3000, 5000, 10000];
const RESUMABLE_VIDEO_UPLOAD_ENABLED = process.env.EXPO_PUBLIC_CLAIM_VIDEO_RESUMABLE_UPLOAD === 'true';

export async function uploadResumableStorageFile({
  uri,
  accessToken,
  bucket,
  objectPath,
  contentType,
  maxBytes,
  onProgress,
}: ResumableUploadOptions): Promise<ResumableUploadResult> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) throw new Error('Missing mobile app environment configuration.');

  const localResponse = await fetch(uri);
  if (!localResponse.ok) throw new Error('The selected video could not be prepared for upload.');
  const fileBlob = await localResponse.blob();
  if (!fileBlob.size || fileBlob.size > maxBytes) throw new Error('The selected video is outside the supported upload size.');

  if (!RESUMABLE_VIDEO_UPLOAD_ENABLED) {
    return uploadStandardStorageFile({ fileBlob, bucket, objectPath, contentType, onProgress });
  }

  const endpoint = resumableEndpoint(supabaseUrl);
  const authHeaders = {
    authorization: `Bearer ${accessToken}`,
    apikey: anonKey,
    'Tus-Resumable': TUS_VERSION,
  };
  let uploadUrl = '';

  try {
    const createResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Upload-Length': String(fileBlob.size),
        'Upload-Metadata': encodeMetadata({
          bucketName: bucket,
          objectName: objectPath,
          contentType,
          cacheControl: '3600',
        }),
      },
    });
    if (createResponse.status !== 201) throw new Error(`Resumable upload could not start (${createResponse.status}).`);

    const location = createResponse.headers.get('location');
    if (!location) throw new Error('Resumable upload did not return an upload location.');
    uploadUrl = new URL(location, endpoint).toString();

    let offset = 0;
    onProgress?.(0);
    while (offset < fileBlob.size) {
      const nextOffset = await uploadChunkWithRecovery({
        uploadUrl,
        fileBlob,
        offset,
        authHeaders,
      });
      if (nextOffset <= offset || nextOffset > fileBlob.size) {
        throw new Error('Resumable upload returned an invalid offset.');
      }
      offset = nextOffset;
      onProgress?.(Math.min(1, offset / fileBlob.size));
    }

    return { size: fileBlob.size };
  } catch (error) {
    await cleanupFailedResumableUpload({ uploadUrl, authHeaders, bucket, objectPath });
    throw error;
  }
}

async function uploadStandardStorageFile({
  fileBlob,
  bucket,
  objectPath,
  contentType,
  onProgress,
}: {
  fileBlob: Blob;
  bucket: string;
  objectPath: string;
  contentType: string;
  onProgress?: (progress: number) => void;
}): Promise<ResumableUploadResult> {
  try {
    const body = await fileBlob.arrayBuffer();
    const storageResult = await supabase.storage.from(bucket).upload(objectPath, body, { contentType, upsert: false });
    if (storageResult.error) throw storageResult.error;
    onProgress?.(1);
    return { size: body.byteLength };
  } catch (error) {
    try {
      await supabase.storage.from(bucket).remove([objectPath]);
    } catch {
      // Best-effort orphan cleanup; preserve the original upload error.
    }
    throw error;
  }
}

async function cleanupFailedResumableUpload({
  uploadUrl,
  authHeaders,
  bucket,
  objectPath,
}: {
  uploadUrl: string;
  authHeaders: Record<string, string>;
  bucket: string;
  objectPath: string;
}) {
  if (uploadUrl) {
    try {
      await fetch(uploadUrl, { method: 'DELETE', headers: authHeaders });
    } catch {
      // Supabase expires abandoned resumable sessions; deletion is best-effort.
    }
  }
  try {
    await supabase.storage.from(bucket).remove([objectPath]);
  } catch {
    // Covers acknowledgement-loss cases without hiding the original transfer error.
  }
}

async function uploadChunkWithRecovery({
  uploadUrl,
  fileBlob,
  offset,
  authHeaders,
}: {
  uploadUrl: string;
  fileBlob: Blob;
  offset: number;
  authHeaders: Record<string, string>;
}) {
  let lastError: unknown = new Error('Resumable upload failed.');

  for (const delayMs of RETRY_DELAYS_MS) {
    if (delayMs) await wait(delayMs);
    const chunk = fileBlob.slice(offset, Math.min(offset + TUS_CHUNK_SIZE_BYTES, fileBlob.size));
    let response: Response;
    try {
      response = await fetch(uploadUrl, {
        method: 'PATCH',
        headers: {
          ...authHeaders,
          'Upload-Offset': String(offset),
          'Content-Type': 'application/offset+octet-stream',
        },
        body: chunk,
      });
    } catch (error) {
      lastError = error;
      const recoveredOffset = await tryReadUploadOffset(uploadUrl, authHeaders);
      if (recoveredOffset !== null && recoveredOffset !== offset) return recoveredOffset;
      continue;
    }

    if (response.status === 204) {
      const reportedOffset = Number(response.headers.get('Upload-Offset'));
      return Number.isFinite(reportedOffset) ? reportedOffset : offset + chunk.size;
    }

    lastError = new Error(`Resumable upload chunk failed (${response.status}).`);
    if (!isRetryableStatus(response.status)) throw lastError;

    const recoveredOffset = await tryReadUploadOffset(uploadUrl, authHeaders);
    if (recoveredOffset !== null && recoveredOffset !== offset) return recoveredOffset;
  }

  throw lastError;
}

async function tryReadUploadOffset(uploadUrl: string, authHeaders: Record<string, string>) {
  try {
    return await readUploadOffset(uploadUrl, authHeaders);
  } catch {
    return null;
  }
}

async function readUploadOffset(uploadUrl: string, authHeaders: Record<string, string>) {
  const response = await fetch(uploadUrl, {
    method: 'HEAD',
    headers: authHeaders,
  });
  if (!response.ok) throw new Error(`Resumable upload status check failed (${response.status}).`);
  const offset = Number(response.headers.get('Upload-Offset'));
  if (!Number.isFinite(offset) || offset < 0) throw new Error('Resumable upload status returned an invalid offset.');
  return offset;
}

function resumableEndpoint(supabaseUrl: string) {
  const parsed = new URL(supabaseUrl);
  const projectId = parsed.hostname.split('.')[0];
  if (!projectId) throw new Error('Invalid Supabase project URL.');
  return `${parsed.protocol}//${projectId}.storage.supabase.co/storage/v1/upload/resumable`;
}

function encodeMetadata(values: Record<string, string>) {
  return Object.entries(values).map(([key, value]) => `${key} ${base64EncodeUtf8(value)}`).join(',');
}

function base64EncodeUtf8(value: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) bytes.push(codePoint);
    else if (codePoint <= 0x7ff) bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    else if (codePoint <= 0xffff) bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
    else bytes.push(0xf0 | (codePoint >> 18), 0x80 | ((codePoint >> 12) & 0x3f), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
  }

  let encoded = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const combined = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    encoded += alphabet[(combined >> 18) & 63];
    encoded += alphabet[(combined >> 12) & 63];
    encoded += second === undefined ? '=' : alphabet[(combined >> 6) & 63];
    encoded += third === undefined ? '=' : alphabet[combined & 63];
  }
  return encoded;
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
