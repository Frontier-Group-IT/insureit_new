import * as Haptics from 'expo-haptics';

async function safely(run: () => Promise<void>) {
  try {
    await run();
  } catch {
    // Haptics must never block or fail a business action.
  }
}

export function partnerSelectionHaptic() {
  return safely(() => Haptics.selectionAsync());
}

export function partnerSuccessHaptic() {
  return safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function partnerWarningHaptic() {
  return safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

export function partnerErrorHaptic() {
  return safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}
