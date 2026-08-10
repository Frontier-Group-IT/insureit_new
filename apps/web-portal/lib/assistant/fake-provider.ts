import type { AssistantProvider, AssistantProviderMessage, AssistantProviderResult } from "./provider.ts";

export function createFakeAssistantProvider(sequence: AssistantProviderResult[]): AssistantProvider & { calls: Array<{ messages: AssistantProviderMessage[] }> } {
  const calls: Array<{ messages: AssistantProviderMessage[] }> = [];
  let index = 0;
  return {
    calls,
    async complete(input) {
      calls.push({ messages: input.messages.map((message) => ({ ...message })) });
      const result = sequence[index++];
      if (!result) throw new Error("fake_provider_sequence_exhausted");
      return structuredClone(result);
    },
  };
}
