export const RENEWAL_VOICE_OPTIONS = [
  { id: "marin", label: "Marin", description: "Warm and natural" },
  { id: "cedar", label: "Cedar", description: "Clear and grounded" },
  { id: "coral", label: "Coral", description: "Friendly and bright" },
  { id: "sage", label: "Sage", description: "Calm and balanced" },
  { id: "verse", label: "Verse", description: "Smooth and conversational" },
  { id: "alloy", label: "Alloy", description: "Neutral and versatile" },
] as const;

export type RenewalVoiceId = (typeof RENEWAL_VOICE_OPTIONS)[number]["id"];

export const RENEWAL_AGENT_TYPES = [
  {
    id: "natural_sales",
    label: "Natural Sales Executive",
    description: "Warm, confident and consultative",
    speed: 1,
  },
  {
    id: "calm_advisor",
    label: "Calm Insurance Advisor",
    description: "Patient, reassuring and explanation-first",
    speed: 0.94,
  },
  {
    id: "relationship_manager",
    label: "Relationship Manager",
    description: "Friendly Indian Hinglish relationship style",
    speed: 0.98,
  },
  {
    id: "concise_professional",
    label: "Concise Professional",
    description: "Direct, polished and efficient",
    speed: 1.04,
  },
] as const;

export type RenewalAgentType = (typeof RENEWAL_AGENT_TYPES)[number]["id"];

export const DEFAULT_RENEWAL_VOICE: RenewalVoiceId = "marin";
export const DEFAULT_RENEWAL_AGENT_TYPE: RenewalAgentType = "natural_sales";

export function isRenewalVoice(value: unknown): value is RenewalVoiceId {
  return typeof value === "string" && RENEWAL_VOICE_OPTIONS.some((option) => option.id === value);
}

export function isRenewalAgentType(value: unknown): value is RenewalAgentType {
  return typeof value === "string" && RENEWAL_AGENT_TYPES.some((option) => option.id === value);
}

export function getRenewalAgentSpeed(agentType: RenewalAgentType) {
  return RENEWAL_AGENT_TYPES.find((option) => option.id === agentType)?.speed ?? 1;
}

export function getRenewalAgentStyleInstructions(agentType: RenewalAgentType) {
  switch (agentType) {
    case "calm_advisor":
      return "Sound like a patient senior insurance advisor. Slow down slightly, reassure without overexplaining, and make the customer feel unhurried.";
    case "relationship_manager":
      return "Sound like a familiar Indian relationship manager. Use easy, natural Hinglish when the customer does, with respectful words such as ji only when they fit naturally. Never overuse them.";
    case "concise_professional":
      return "Sound like a polished renewal specialist. Be crisp and efficient, usually one short sentence followed by one clear question.";
    default:
      return "Sound like a strong Indian renewal sales executive: warm, confident, consultative, conversational, and never pushy.";
  }
}
