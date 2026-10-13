/**
 * Privacy-safe error contract for Customer Firebase phone authentication.
 * Never expose or log SDK error.message, phone numbers, OTPs, tokens or IDs.
 */
export type FirebaseOtpStage =
  | 'sms_request'
  | 'firebase_verification'
  | 'customer_registration'
  | 'customer_binding'
  | 'token_refresh'
  | 'customer_authorization';

const knownFirebaseCodes = new Set([
  'auth/invalid-verification-code',
  'auth/code-expired',
  'auth/session-expired',
  'auth/invalid-verification-id',
  'auth/too-many-requests',
  'auth/quota-exceeded',
  'auth/missing-client-identifier',
  'auth/app-not-authorized',
  'auth/invalid-app-credential',
  'auth/captcha-check-failed',
  'auth/network-request-failed',
  'auth/operation-not-allowed',
  'auth/invalid-phone-number',
  'auth/unknown',
]);

export class FirebaseCustomerOtpError extends Error {
  readonly stage: FirebaseOtpStage;
  readonly code: string;
  readonly retryableCode: boolean;
  constructor(stage: FirebaseOtpStage, code: string, retryableCode = false) {
    super('Customer Firebase authentication step failed');
    this.name = 'FirebaseCustomerOtpError';
    this.stage = stage;
    this.code = code;
    this.retryableCode = retryableCode;
  }
}

export function firebaseOtpFailure(stage: FirebaseOtpStage, cause: unknown): FirebaseCustomerOtpError {
  if (cause instanceof FirebaseCustomerOtpError) return cause;
  // Use only recognized Firebase SDK codes; raw error messages may contain
  // numbers, tokens or other untrusted values, and must not reach logs/UI.
  const rawCode = cause && typeof cause === 'object' && 'code' in cause
    ? (cause as { code?: unknown }).code : null;
  const code = typeof rawCode === 'string' && knownFirebaseCodes.has(rawCode)
    ? rawCode : 'auth/unknown';
  const retryable = stage === 'firebase_verification' &&
    code === 'auth/invalid-verification-code';
  return new FirebaseCustomerOtpError(stage, code, retryable);
}

export function firebaseOtpHttpFailure(stage: FirebaseOtpStage, status: number): FirebaseCustomerOtpError {
  const category = status === 401 ? 'unauthorized'
    : status === 403 ? 'forbidden'
    : status === 409 ? 'conflict'
    : status === 429 ? 'rate-limited'
    : status >= 500 ? 'server-unavailable'
    : 'rejected';
  return new FirebaseCustomerOtpError(stage, 'customer/' + category);
}

export function recordFirebaseOtpStage(stage: FirebaseOtpStage, code: string = 'started') {
  // Static stage and allowlisted code only: no phone, OTP, token, UID,
  // arbitrary SDK text or server response body.
  if (code === 'started' || code === 'ok' || knownFirebaseCodes.has(code) ||
      /^customer\/(?:unauthorized|forbidden|conflict|rate-limited|server-unavailable|rejected|identity-unavailable)$/.test(code)) {
    console.info('[customer-firebase-otp]', { stage, code });
  }
}

export function firebaseOtpPublicMessage(error: FirebaseCustomerOtpError): string {
  switch (error.code) {
    case 'auth/invalid-verification-code': return 'Incorrect verification code. Please check the latest SMS and try again.';
    case 'auth/code-expired':
    case 'auth/session-expired':
    case 'auth/invalid-verification-id':
      return 'This verification code has expired. Request a new code.';
    case 'auth/too-many-requests':
    case 'auth/quota-exceeded':
    case 'customer/rate-limited':
      return 'Too many verification attempts. Please wait before requesting another code.';
    case 'auth/network-request-failed':
      return 'Network connection failed. Check your connection and try again.';
    case 'auth/app-not-authorized':
    case 'auth/invalid-app-credential':
    case 'auth/missing-client-identifier':
    case 'auth/captcha-check-failed':
      return 'Android app verification failed. Please contact InsureIT support with this error code.';
    case 'auth/operation-not-allowed':
      return 'Firebase SMS verification is unavailable. Please contact InsureIT support.';
    case 'auth/invalid-phone-number':
      return 'Enter a valid 10-digit mobile number.';
    default:
      switch (error.stage) {
        case 'sms_request': return 'Unable to request Firebase SMS verification. Try again later.';
        case 'firebase_verification': return 'Firebase could not verify this code. Please request a new SMS if needed.';
        case 'customer_registration': return 'Your verified phone could not be registered. Please contact InsureIT support.';
        case 'customer_binding': return 'Your phone is verified but your customer account needs review. Please contact support.';
        case 'token_refresh': return 'Phone verified, but secure authorization could not be refreshed. Please try again.';
        case 'customer_authorization': return 'Phone verified, but customer data access was denied. Please contact support.';
      }
  }
}
