import { setTimeout } from 'node:timers/promises';
import { isNonEmpty } from 'ts-array-length';
import { log } from '@lib/log';
import { getEnv } from '@lib/util';
import { geoCoding } from './db';
import type { GeocodingResponse, LatLng } from 'types/bot/features/earthquake';

const locationPoints = new Map<string, LatLng | null>();

export const geocode = async (prefecture: string, address: string, loopCount: number = 0): Promise<LatLng | null> => {
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

      geoCoding.add(prefecture, address, location.lat, location.lng);
      locationPoints.set(concatenatedAddress, location);
      return location;
    }
    else {
      log(`earthquake#${geocode.name}:`, 'failed to geocode', json);
    }
  }
  catch (e) {
    if (e instanceof Error) {
      log(`earthquake#${geocode.name}:`, 'failed to geocode', e.stack ?? `${e.name}: ${e.message}`);
    }
    else {
      throw e;
    }
  }
  return null;
};
