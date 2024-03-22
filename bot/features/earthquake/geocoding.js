import { setTimeout } from 'node:timers/promises';
import { isNonEmpty } from 'ts-array-length';
import { log } from '../../lib/log.js';
import { getEnv } from '../../lib/util.js';
import { geoCoding } from './db.js';

/** @type {Map<string, import('types/bot/features/earthquake/geocoding').LatLng | null>} */
const locationPoints = new Map();

/**
 * @param {string} prefecture
 * @param {string} address
 * @param {number} [loopCount=0]
 * @returns {Promise<import('types/bot/features/earthquake/geocoding').LatLng | null>}
 */
export const geocode = async (prefecture, address, loopCount = 0) => {
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

    /** @type {import('types/bot/features/earthquake/geocoding').GeocodingResponse} */
    const json = await response.json();

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
