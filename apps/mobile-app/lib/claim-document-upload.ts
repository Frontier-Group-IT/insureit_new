export type ClaimUploadDescriptor =
  | { ok: true; mimeType: string; storageExtension: string }
  | { ok: false; message: string };

export type ClaimUploadStorageFailureKind = 'auth' | 'already_exists' | 'transient' | 'terminal';

const MIME_ALIASES: Record<string, string> = {
  'application/x-pdf': 'application/pdf',
  'image/jpg': 'image/jpeg',
  'image/heif': 'image/heic',
};

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heic',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  m4a: 'audio/m4a',
};

const EXTENSION_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-matroska': 'mkv',
  'video/x-msvideo': 'avi',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
};

const GENERIC_MIME_TYPES = new Set([
  '',
  'application/octet-stream',
  'binary/octet-stream',
  'application/binary',
]);

function normalizedMimeType(value?: string | null) {
  const raw = (value ?? '').split(';')[0].trim().toLowerCase();
  return MIME_ALIASES[raw] ?? raw;
}

function fileExtension(name: string) {
  const cleanName = name.split(/[?#]/)[0];
  const dot = cleanName.lastIndexOf('.');
  if (dot < 0 || dot === cleanName.length - 1) return '';
  return cleanName.slice(dot + 1).toLowerCase();
}

function unsupportedMessage(name: string) {
  const label = name.trim() || 'This file';
  return `${label} is not a supported claim document. Choose a PDF, JPG, PNG, WEBP, HEIC, or a supported video/audio file.`;
}

function storageErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message.toLowerCase();
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message ?? '').toLowerCase();
  return String(error ?? '').toLowerCase();
}

export function claimUploadStorageErrorStatus(error: unknown) {
  if (!error || typeof error !== 'object') return null;
  const candidate = (error as { statusCode?: unknown; status?: unknown }).statusCode ?? (error as { status?: unknown }).status;
  const numeric = typeof candidate === 'number' ? candidate : Number(candidate);
  return Number.isFinite(numeric) ? numeric : null;
}

export function classifyClaimUploadStorageError(error: unknown): ClaimUploadStorageFailureKind {
  const status = claimUploadStorageErrorStatus(error);
  const message = storageErrorMessage(error);

  if (status === 409 || /already exists|duplicate|resource exists/.test(message)) return 'already_exists';
  if (status === 401 || status === 403 || /unauthori[sz]ed|jwt|token expired|invalid token|authentication/.test(message)) return 'auth';
  if (
    status === 408 ||
    status === 425 ||
    status === 429 ||
    (status !== null && status >= 500) ||
    /network|fetch|timeout|timed out|connection|econn|socket|temporar|unavailable|gateway/.test(message)
  ) return 'transient';
  return 'terminal';
}

export function resolveClaimUploadDescriptor(file: { name: string; mimeType?: string | null }): ClaimUploadDescriptor {
  const mimeType = normalizedMimeType(file.mimeType);
  const extension = fileExtension(file.name);
  const extensionMimeType = MIME_BY_EXTENSION[extension];
  const hasSpecificMimeType = Boolean(mimeType) && !GENERIC_MIME_TYPES.has(mimeType);

  if (hasSpecificMimeType) {
    const canonicalExtension = EXTENSION_BY_MIME[mimeType];
    if (!canonicalExtension) return { ok: false, message: unsupportedMessage(file.name) };
    return {
      ok: true,
      mimeType,
      storageExtension: extensionMimeType === mimeType ? extension : canonicalExtension,
    };
  }

  if (extensionMimeType) {
    return { ok: true, mimeType: extensionMimeType, storageExtension: extension };
  }

  return { ok: false, message: unsupportedMessage(file.name) };
}

export function claimUploadFileReadMessage(name: string) {
  const label = name.trim() || 'The selected file';
  return `${label} could not be read from this device. Please download it locally and try again.`;
}

export function claimUploadTooLargeMessage(name: string, maxSizeLabel: string) {
  const label = name.trim() || 'The selected file';
  return `${label} is larger than ${maxSizeLabel}. Please choose a smaller file.`;
}

export function claimUploadStorageMessage(name: string, afterRetry = false) {
  const label = name.trim() || 'The selected file';
  if (afterRetry) return `${label} could not be uploaded after retrying. Please tap the document again to try once more.`;
  return `${label} could not be uploaded to secure storage. Please try again.`;
}

export function claimUploadMetadataMessage(name: string) {
  const label = name.trim() || 'The selected file';
  return `${label} was uploaded, but could not be attached to the claim. Please try again.`;
}
