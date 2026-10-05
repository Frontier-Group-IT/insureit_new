import * as Updates from 'expo-updates';

export type CustomerUpdateResult =
  | { status: 'disabled'; message: string }
  | { status: 'current'; message: string }
  | { status: 'restarting'; message: string };

export async function checkForCustomerUpdate(): Promise<CustomerUpdateResult> {
  if (__DEV__ || !Updates.isEnabled) {
    return {
      status: 'disabled',
      message: 'Update checks are available in the installed INSUREIT app.',
    };
  }

  const check = await Updates.checkForUpdateAsync();
  if (!check.isAvailable) {
    return {
      status: 'current',
      message: 'You are using the latest INSUREIT update.',
    };
  }

  await Updates.fetchUpdateAsync();
  await Updates.reloadAsync();

  return {
    status: 'restarting',
    message: 'Update installed. Restarting INSUREIT…',
  };
}
