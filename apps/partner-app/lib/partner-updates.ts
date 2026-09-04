import * as Updates from 'expo-updates';

export type PartnerUpdateResult =
  | { status: 'disabled'; message: string }
  | { status: 'current'; message: string }
  | { status: 'restarting'; message: string };

export async function checkForPartnerUpdate(): Promise<PartnerUpdateResult> {
  if (__DEV__ || !Updates.isEnabled) {
    return {
      status: 'disabled',
      message: 'Update checks are available in the installed Partner preview app.',
    };
  }

  const check = await Updates.checkForUpdateAsync();
  if (!check.isAvailable) {
    return {
      status: 'current',
      message: 'You already have the latest Partner update.',
    };
  }

  await Updates.fetchUpdateAsync();
  await Updates.reloadAsync();

  return {
    status: 'restarting',
    message: 'Update installed. Restarting INSUREIT Partner…',
  };
}
