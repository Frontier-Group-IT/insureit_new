import * as Location from 'expo-location';

/** Requests foreground permission only after an explicit user tap. */
export async function getPartnerCurrentLocation(): Promise<string> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new Error('Location permission was not granted. You can enter the location manually.');
  }
  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const { latitude, longitude } = position.coords;
  try {
    const places = await Location.reverseGeocodeAsync({ latitude, longitude });
    const place = places[0];
    if (place) {
      const text = [place.street, place.district, place.city, place.region, place.postalCode]
        .filter((part, i, values) => Boolean(part) && values.indexOf(part) === i)
        .join(', ');
      if (text) return text;
    }
  } catch {
    // Offline reverse geocoding must not discard the valid GPS position.
  }
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}
