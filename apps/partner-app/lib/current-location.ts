/** GPS must not be imported at module scope: older OTA runtimes do not contain expo-location. */
export async function getPartnerCurrentLocation(): Promise<string> {
  // iOS can terminate the process if ExpoLocation is required before its native module exists.
  // Check the native module registry first, without importing expo-location.
  const nativeModules = require('expo-modules-core') as { NativeModulesProxy?: Record<string, unknown> };
  if (!nativeModules.NativeModulesProxy?.ExpoLocation) {
    throw new Error('GPS requires a newer version of INSUREIT Partner. Please enter the location manually.');
  }
  let location: typeof import('expo-location');
  try {
    // Evaluate only after a user action; the optional native module may be absent on older builds.
    location = require('expo-location') as typeof import('expo-location');
    if (!location?.requestForegroundPermissionsAsync || !location?.getCurrentPositionAsync) {
      throw new Error('Unavailable native location module');
    }
  } catch {
    throw new Error('GPS is not available in this app version. Please enter the location manually.');
  }

  const permission = await location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new Error('Location permission was not granted. You can enter the location manually.');
  }
  const position = await location.getCurrentPositionAsync({ accuracy: location.Accuracy.Balanced });
  const { latitude, longitude } = position.coords;
  try {
    const places = await location.reverseGeocodeAsync({ latitude, longitude });
    const place = places[0];
    if (place) {
      const text = [place.street, place.district, place.city, place.region, place.postalCode]
        .filter((part, i, values) => Boolean(part) && values.indexOf(part) === i)
        .join(', ');
      if (text) return text;
    }
  } catch {
    // Preserve a valid coordinate if reverse geocoding cannot complete.
  }
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}
