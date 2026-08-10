export type AssistantLimitLease = { ok: true; release(): void } | { ok: false; reason: "rate" | "concurrency" };
export interface AssistantLimiter { acquire(profileId: string): AssistantLimitLease }

type LimiterOptions = { maxRequests?: number; windowMs?: number; maxConcurrent?: number; now?: () => number };
type UserState = { requestTimes: number[]; concurrent: number; lastSeen: number };

/**
 * MVP best-effort limiter. State is process-local and is neither shared nor durable
 * across Vercel/serverless instances or cold starts. Replace with an atomic shared
 * store before relying on this as a hard abuse or billing boundary.
 */
export function createInMemoryAssistantLimiter(options: LimiterOptions = {}): AssistantLimiter {
  const maxRequests = options.maxRequests ?? 20;
  const windowMs = options.windowMs ?? 60_000;
  const maxConcurrent = options.maxConcurrent ?? 1;
  const now = options.now ?? Date.now;
  const states = new Map<string, UserState>();
  let operations = 0;

  return {
    acquire(profileId) {
      const timestamp = now();
      const state = states.get(profileId) ?? { requestTimes: [], concurrent: 0, lastSeen: timestamp };
      state.requestTimes = state.requestTimes.filter((item) => timestamp - item < windowMs);
      state.lastSeen = timestamp;
      states.set(profileId, state);

      if (state.concurrent >= maxConcurrent) return { ok: false, reason: "concurrency" };
      if (state.requestTimes.length >= maxRequests) return { ok: false, reason: "rate" };
      state.requestTimes.push(timestamp);
      state.concurrent += 1;

      operations += 1;
      if (operations % 100 === 0) {
        for (const [key, candidate] of states) {
          if (candidate.concurrent === 0 && timestamp - candidate.lastSeen >= windowMs) states.delete(key);
        }
      }

      let released = false;
      return {
        ok: true,
        release() {
          if (released) return;
          released = true;
          state.concurrent = Math.max(0, state.concurrent - 1);
        },
      };
    },
  };
}

export const assistantLimiter = createInMemoryAssistantLimiter();
