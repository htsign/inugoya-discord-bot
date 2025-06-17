import { setTimeout } from 'node:timers/promises';
import { isNonEmpty } from 'ts-array-length';
import type { GeocodingResponse, LatLng } from '../../../types/bot/features/earthquake/index.ts';
import { log, logError } from '../../lib/log.ts';
import { getEnv } from '../../lib/util.ts';
import { geoCoding } from './db.ts';

const locationPoints = new Map<string, LatLng | null>();

export const geocode = async (prefecture: string, address: string, loopCount = 0): Promise<LatLng | null> => {
  const fromDb = geoCoding.get(prefecture, address);
  if (fromDb != null) {
    return { lat: fromDb.latitude, lng: fromDb.longitude };
  }

  const concatenatedAddress = prefecture + address;
  const location = locationPoints.get(concatenatedAddress);

  // wait for previous geocoding to finish
  if (location === null) {
    // avoid infinite loop
    if (loopCount > 10000) return null;

    await setTimeout(1);
    return await geocode(prefecture, address, loopCount + 1);
  }

  // prevent multiple geocoding at the same time
  // `null` means that geocoding is in progress
  locationPoints.set(concatenatedAddress, null);

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('region', 'jp');
  url.searchParams.set('address', address);
  url.searchParams.set('key', getEnv('GOOGLE_MAPS_API_KEY', 'Googlemaps API Key'));

  try {
    const response = await fetch(url.toString());

    const json: GeocodingResponse = await response.json();

    if (json.status === 'OK' && isNonEmpty(json.results)) {
      const [result] = json.results;
      const { location } = result.geometry;

      // round to 2 decimal places
      Object.assign(location, {
        lat: Math.round(location.lat * 100) / 100,
        lng: Math.round(location.lng * 100) / 100,
      });

      geoCoding.add(prefecture, address, location.lat, location.lng);
      locationPoints.set(concatenatedAddress, location);
      return location;
    }

    log(`earthquake#${geocode.name}:`, 'failed to geocode', [...url.searchParams], json);
  }
  catch (e) {
    if (e instanceof Error) {
      logError(e, `earthquake#${geocode.name}:`, 'failed to geocode', [...url.searchParams]);
    }
    else {
      throw e;
    }
  }
  return null;
};
