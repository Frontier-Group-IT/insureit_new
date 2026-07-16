export type TrackedLoadingEntry = {
  id: string;
  label: string;
  startedAt: number;
};

type Listener = (entries: TrackedLoadingEntry[]) => void;

let sequence = 0;
let entries: TrackedLoadingEntry[] = [];
const listeners = new Set<Listener>();

export function beginTrackedLoading(label = 'Loading') {
  const id = `tracked-loader-${Date.now()}-${sequence++}`;
  entries = [...entries, { id, label, startedAt: Date.now() }];
  emit();
  return id;
}

export function endTrackedLoading(id: string) {
  if (!entries.some((entry) => entry.id === id)) return;
  entries = entries.filter((entry) => entry.id !== id);
  emit();
}

export function getTrackedLoadingEntries() {
  return entries;
}

export function subscribeTrackedLoading(listener: Listener) {
  listeners.add(listener);
  listener(entries);
  return () => {
    listeners.delete(listener);
  };
}

export async function withTrackedLoading<T>(task: () => Promise<T>, label = 'Processing request') {
  const id = beginTrackedLoading(label);
  try {
    return await task();
  } finally {
    endTrackedLoading(id);
  }
}

function emit() {
  for (const listener of listeners) listener(entries);
}