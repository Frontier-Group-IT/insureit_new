export type PrivateVoiceProviderName = "unconfigured" | "sarvam" | "custom";

export type PrivateVoiceExecutionMode = "shadow" | "internal" | "pilot";

export type PrivateVoiceSessionState =
  | "created"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "completed"
  | "failed";

export interface PrivateVoiceCustomerContext {
  opportunityId: string;
  customerName?: string | null;
  registrationNumber?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  insurer?: string | null;
  policyNumber?: string | null;
  policyExpiryDate?: string | null;
  previousCallSummary?: string | null;
}

export interface PrivateVoiceStructuredOutcome {
  disposition?: string | null;
  customerInterest?: "high" | "medium" | "low" | "unknown" | null;
  customerObjection?: string | null;
  followUpRequired?: boolean | null;
  followUpAt?: string | null;
  quoteRequested?: boolean | null;
  humanAssistanceRequired?: boolean | null;
  doNotContact?: boolean | null;
  wrongPerson?: boolean | null;
  alreadyRenewed?: boolean | null;
  summary?: string | null;
  nextAction?: string | null;
}

export interface PrivateVoiceTelephonyProvider {
  readonly name: string;
  connectOutboundCall(input: {
    attemptId: string;
    destination: string;
    streamUrl: string;
  }): Promise<{ providerCallId: string }>;
  hangup(providerCallId: string): Promise<void>;
}

export interface PrivateVoiceSpeechToTextProvider {
  readonly name: string;
  createSession(input: {
    sessionId: string;
    languageHint?: string | null;
  }): Promise<unknown>;
}

export interface PrivateVoiceLanguageModelProvider {
  readonly name: string;
  respond(input: {
    sessionId: string;
    customerContext: PrivateVoiceCustomerContext;
    conversation: Array<{ role: "customer" | "agent"; text: string }>;
  }): Promise<{ text: string; outcome?: PrivateVoiceStructuredOutcome }>;
}

export interface PrivateVoiceTextToSpeechProvider {
  readonly name: string;
  synthesize(input: {
    sessionId: string;
    text: string;
    languageHint?: string | null;
  }): Promise<unknown>;
}

/**
 * Phase 1 boundary only. No provider implementation is registered here yet.
 * The private runtime must depend on these interfaces rather than Sarvam-specific code.
 */
export interface PrivateVoiceProviderBundle {
  telephony: PrivateVoiceTelephonyProvider;
  stt: PrivateVoiceSpeechToTextProvider;
  llm: PrivateVoiceLanguageModelProvider;
  tts: PrivateVoiceTextToSpeechProvider;
}
