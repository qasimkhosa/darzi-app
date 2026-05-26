export type Coordinates = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
};

type ExpoLocationModule = typeof import('expo-location');

export type LocationCaptureResult =
  | {
      granted: true;
      coordinates: Coordinates;
    }
  | {
      granted: false;
      reason: string;
    };

export function isValidCoordinate(latitude?: number | null, longitude?: number | null) {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export async function requestCurrentCoordinates(): Promise<LocationCaptureResult> {
  try {
    const Location = (await import('expo-location')) as ExpoLocationModule;
    const permission = await Location.requestForegroundPermissionsAsync();

    if (!permission.granted) {
      return {
        granted: false,
        reason: 'Location permission was not granted.',
      };
    }

    const lastKnownPosition = await Location.getLastKnownPositionAsync({
      maxAge: 5 * 60 * 1000,
      requiredAccuracy: 2500,
    });

    const position =
      lastKnownPosition ??
      (await withTimeout(
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        9000,
      ));

    return {
      granted: true,
      coordinates: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not read location.';

    return {
      granted: false,
      reason: message,
    };
  }
}

export function calculateDistanceKm(origin: Coordinates, destination: Coordinates) {
  const earthRadiusKm = 6371;
  const latitudeDelta = degreesToRadians(destination.latitude - origin.latitude);
  const longitudeDelta = degreesToRadians(destination.longitude - origin.longitude);
  const originLatitude = degreesToRadians(origin.latitude);
  const destinationLatitude = degreesToRadians(destination.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);

  const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return Number((earthRadiusKm * centralAngle).toFixed(1));
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Location lookup timed out. Try again near a window or enable high accuracy GPS.'));
      }, timeoutMs);
    }),
  ]);
}
