export type PartnerErrorContext = {
  area: string;
  operation?: string;
  route?: string;
  recoverable?: boolean;
  metadata?: Record<string, unknown>;
};

export type PartnerObservedError = {
  name: string;
  message: string;
  stack?: string;
  context: PartnerErrorContext;
  occurredAt: string;
};

const SENSITIVE_KEY = /(token|password|authorization|cookie|phone|mobile|email|pan|aadhaar|aadhar|policy[_-]?no|claim[_-]?no|customer[_-]?name|file[_-]?name)/i;

export function reportPartnerError(error: unknown, context: PartnerErrorContext) {
  const normalized = normalizeError(error, context);

  // Phase 5 intentionally keeps reporting local and sanitized. Phase 6 may
  // attach a native crash/telemetry provider to this single integration point.
  if (__DEV__) {
    console.error('[INSUREIT Partner]', normalized);
  }

  return normalized;
}

export function sanitizePartnerMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;

  return Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [
      key,
      SENSITIVE_KEY.test(key) ? '[REDACTED]' : sanitizeValue(value),
    ]),
  );
}

function normalizeError(error: unknown, context: PartnerErrorContext): PartnerObservedError {
  const base = error instanceof Error
    ? {
        name: error.name || 'Error',
        message: error.message || 'Unexpected error',
        stack: __DEV__ ? error.stack : undefined,
      }
    : {
        name: 'Error',
        message: typeof error === 'string' ? error : 'Unexpected error',
        stack: undefined,
      };

  return {
    ...base,
    context: {
      ...context,
      metadata: sanitizePartnerMetadata(context.metadata),
    },
    occurredAt: new Date().toISOString(),
  };
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === 'object') {
    return sanitizePartnerMetadata(value as Record<string, unknown>);
  }
  if (typeof value === 'string' && value.length > 180) {
    return `${value.slice(0, 180)}…`;
  }
  return value;
}
