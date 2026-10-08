/**
 * Customer OTP provider boundary.
 * Default implementation preserves Supabase Auth sessions and roles.
 * Firebase implementation cannot be enabled until a native provider, validated
 * identity mapping and authorized data-access client are available.
 */
import { supabase } from './supabase';

export type CustomerOtpDelivery = 'login' | 'signup';
export type CustomerOtpSignup = { fullName: string; email?: string };
export type CustomerOtpProvider = {
  sendLogin: (phone: string) => Promise<Awaited<ReturnType<typeof supabase.auth.signInWithOtp>>['data']>;
  sendSignup: (phone: string, signup: CustomerOtpSignup) => Promise<Awaited<ReturnType<typeof supabase.auth.signInWithOtp>>['data']>;
  verify: (phone: string, token: string) => ReturnType<typeof supabase.auth.verifyOtp>;
};

/** The only enabled provider in the existing production runtime. */
export const legacySupabaseOtpProvider: CustomerOtpProvider = {
  async sendLogin(phone) {
    const { data, error } = await supabase.auth.signInWithOtp({
      phone, options: { channel: 'sms', shouldCreateUser: false },
    });
    if (error) throw error;
    return data;
  },
  async sendSignup(phone, signup) {
    const { data, error } = await supabase.auth.signInWithOtp({
      phone,
      options: {
        channel: 'sms',
        shouldCreateUser: true,
        data: {
          app_role: 'customer',
          full_name: signup.fullName,
          phone,
          ...(signup.email ? { email: signup.email } : {}),
        },
      },
    });
    if (error) throw error;
    return data;
  },
  async verify(phone, token) {
    const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
    if (error) throw error;
    return { data, error: null };
  },
};

/**
 * A Firebase OTP confirmation is not interchangeable with a Supabase Auth
 * verifyOtp() result. The caller must not invent a Supabase session.
 */
export function activeCustomerOtpProvider(): CustomerOtpProvider {
  return legacySupabaseOtpProvider;
}
