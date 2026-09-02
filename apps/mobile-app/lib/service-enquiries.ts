import { supabase } from '@/lib/supabase';

export type ServiceEnquiryType = 'insurance_quote' | 'challan_assistance';
export type ServiceEnquirySource = 'guest_login' | 'guest_signup' | 'customer_dashboard';

export type GuestVerification = {
  challengeId: string;
  verificationToken: string;
};

export const SERVICE_ENQUIRY_CONSENT_VERSION = '2026-09-02-v1';
export const SERVICE_ENQUIRY_TERMS_VERSION = '2026-07-04';
export const SERVICE_ENQUIRY_PRIVACY_VERSION = '2026-07-04';

export type ServiceEnquiryConsent = {
  consentAccepted: true;
  whatsappOptIn: boolean;
};

export async function requestGuestEnquiryOtp(phone: string) {
  const { data, error } = await supabase.functions.invoke('guest-service-enquiry', {
    body: { action: 'request_otp', phone },
  });
  if (error) throw new Error(await functionErrorMessage(error, 'Could not send OTP. Please try again.'));
  if (data?.error) throw new Error(String(data.error));
  if (!data?.challengeId) throw new Error('Could not start mobile verification.');
  return {
    challengeId: String(data.challengeId),
    maskedPhone: String(data.phone ?? ''),
  };
}

export async function verifyGuestEnquiryOtp(challengeId: string, otp: string) {
  const { data, error } = await supabase.functions.invoke('guest-service-enquiry', {
    body: { action: 'verify_otp', challengeId, otp },
  });
  if (error) throw new Error(await functionErrorMessage(error, 'Could not verify OTP. Please try again.'));
  if (data?.error) throw new Error(String(data.error));
  if (!data?.verificationToken) throw new Error('Mobile verification could not be completed.');
  return String(data.verificationToken);
}

export async function submitGuestServiceEnquiry(input: {
  challengeId: string;
  verificationToken: string;
  serviceType: ServiceEnquiryType;
  source: Extract<ServiceEnquirySource, 'guest_login' | 'guest_signup'>;
  guestName: string;
  guestEmail?: string;
  vehicleNo: string;
  subject: string;
  description: string;
  details?: Record<string, unknown>;
  consent: ServiceEnquiryConsent;
}) {
  const { data, error } = await supabase.functions.invoke('guest-service-enquiry', {
    body: {
      action: 'submit_enquiry',
      ...input,
      consentAccepted: input.consent.consentAccepted,
      consentVersion: SERVICE_ENQUIRY_CONSENT_VERSION,
      termsVersion: SERVICE_ENQUIRY_TERMS_VERSION,
      privacyPolicyVersion: SERVICE_ENQUIRY_PRIVACY_VERSION,
      whatsappOptIn: input.consent.whatsappOptIn,
    },
  });
  if (error) throw new Error(await functionErrorMessage(error, 'Could not submit your request. Please try again.'));
  if (data?.error) throw new Error(String(data.error));
  if (!data?.enquiry?.enquiry_no) throw new Error('Request submitted without a reference number.');
  return data.enquiry as { id: string; enquiry_no: string; status: string };
}

export async function submitCustomerServiceEnquiry(input: {
  serviceType: ServiceEnquiryType;
  customerId: string;
  profileId: string;
  vehicleId?: string | null;
  vehicleNo?: string | null;
  subject: string;
  description: string;
  details?: Record<string, unknown>;
  consent: ServiceEnquiryConsent;
}) {
  const { data, error } = await (supabase as any)
    .from('service_enquiries')
    .insert({
      enquiry_no: '',
      service_type: input.serviceType,
      source: 'customer_dashboard',
      customer_id: input.customerId,
      created_by: input.profileId,
      guest_name: null,
      guest_phone: null,
      guest_email: null,
      vehicle_id: input.vehicleId || null,
      vehicle_no: input.vehicleNo || null,
      subject: input.subject,
      description: input.description,
      details: input.details ?? {},
      consent_accepted: input.consent.consentAccepted,
      consent_accepted_at: new Date().toISOString(),
      consent_version: SERVICE_ENQUIRY_CONSENT_VERSION,
      terms_version: SERVICE_ENQUIRY_TERMS_VERSION,
      privacy_policy_version: SERVICE_ENQUIRY_PRIVACY_VERSION,
      whatsapp_opt_in: input.consent.whatsappOptIn,
      status: 'open',
    })
    .select('id,enquiry_no,status')
    .single();

  if (error || !data) throw new Error(error?.message || 'Could not submit your request. Please try again.');
  return data as { id: string; enquiry_no: string; status: string };
}

async function functionErrorMessage(error: unknown, fallback: string) {
  const context = (error as { context?: Response })?.context;
  if (context && typeof context.clone === 'function') {
    try {
      const payload = await context.clone().json();
      if (payload?.error) return String(payload.error);
    } catch {
      // Fall back to the client error below.
    }
  }
  const message = error instanceof Error ? error.message : '';
  return message || fallback;
}
