import type { PrivateVoiceProviderName } from "./contracts";

function enabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

function provider(value: string | undefined): PrivateVoiceProviderName {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "sarvam" || normalized === "custom") return normalized;
  return "unconfigured";
}

export interface PrivateVoiceRuntimeConfig {
  workspaceEnabled: boolean;
  outboundEnabled: boolean;
  shadowEnabled: boolean;
  telephonyProvider: PrivateVoiceProviderName;
  sttProvider: PrivateVoiceProviderName;
  llmProvider: PrivateVoiceProviderName;
  ttsProvider: PrivateVoiceProviderName;
}

export function getPrivateVoiceRuntimeConfig(): PrivateVoiceRuntimeConfig {
  return {
    workspaceEnabled: enabled(process.env.PRIVATE_VOICE_ENABLED),
    outboundEnabled: enabled(process.env.PRIVATE_VOICE_OUTBOUND_ENABLED),
    shadowEnabled: enabled(process.env.PRIVATE_VOICE_SHADOW_ENABLED),
    telephonyProvider: provider(process.env.PRIVATE_VOICE_TELEPHONY_PROVIDER),
    sttProvider: provider(process.env.PRIVATE_VOICE_STT_PROVIDER),
    llmProvider: provider(process.env.PRIVATE_VOICE_LLM_PROVIDER),
    ttsProvider: provider(process.env.PRIVATE_VOICE_TTS_PROVIDER),
  };
}

export function privateVoiceOutboundAllowed(config = getPrivateVoiceRuntimeConfig()) {
  return config.workspaceEnabled && config.outboundEnabled;
}

export const PRIVATE_VOICE_ENVIRONMENT_KEYS = [
  "PRIVATE_VOICE_ENABLED",
  "PRIVATE_VOICE_OUTBOUND_ENABLED",
  "PRIVATE_VOICE_SHADOW_ENABLED",
  "PRIVATE_VOICE_TELEPHONY_PROVIDER",
  "PRIVATE_VOICE_STT_PROVIDER",
  "PRIVATE_VOICE_LLM_PROVIDER",
  "PRIVATE_VOICE_TTS_PROVIDER",
] as const;
