/** Load GPS only after a user gesture: older OTA binaries may not include its native module. */
export async function getPartnerCurrentLocation(): Promise<string> {
  // Expo Modules can register native modules through the JSI host object rather than
  // NativeModulesProxy. Checking the proxy alone incorrectly rejects newer iOS builds.
  const { requireOptionalNativeModule } = require('expo-modules-core') as {
    requireOptionalNativeModule: (name: string) => unknown | null;
  };
  if (typeof requireOptionalNativeModule !== 'function' || !requireOptionalNativeModule('ExpoLocation')) {
    throw new Error('GPS is not available in this installed app version. Please update INSUREIT Partner or enter the location manually.');
  }

  let location: typeof import('expo-location');
  try {
    // Never import at module scope: doing so can crash an older OTA runtime.
    location = require('expo-location') as typeof import('expo-location');
    if (!location?.requestForegroundPermissionsAsync || !location?.getCurrentPositionAsync) {
      throw new Error('Unavailable native location module');
    }
  } catch {
    throw new Error('GPS is not available in this installed app version. Please enter the location manually.');
  }

  try {
    if (!(await location.hasServicesEnabledAsync())) {
      throw new Error('Location Services are turned off. Enable them in your phone settings or enter the location manually.');
    }
    const permission = await location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Location permission is not allowed. Enable it for INSUREIT Partner in your phone settings, or enter the location manually.');
    }
    const position = await location.getCurrentPositionAsync({ accuracy: location.Accuracy.Balanced });
    const { latitude, longitude } = position.coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error('The phone returned an invalid GPS position. Please try again or enter the location manually.');
    }
    try {
      const places = await location.reverseGeocodeAsync({ latitude, longitude });
      const place = places[0];
      if (place) {
        const address = [place.street, place.district, place.city, place.region, place.postalCode]
          .filter((part, i, values) => Boolean(part) && values.indexOf(part) === i)
          .join(', ');
        if (address) return address;
      }
    } catch {
      // Reverse geocoding is optional; a valid coordinate should still be usable.
    }
    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  } catch (error) {
    if (error instanceof Error && (
      error.message.startsWith('Location Services') ||
      error.message.startsWith('Location permission') ||
      error.message.startsWith('The phone returned')
    )) throw error;
    throw new Error('Unable to read your current location. Check location permission and GPS signal, then try again or enter it manually.');
  }
}
