import { setTimeout } from 'node:timers/promises';
import { isNonEmpty } from 'ts-array-length';
import { log } from '../../lib/log.js';
import { getEnv } from '../../lib/util.js';

/** @type {Map<string, import('types/bot/features/earthquake/geocoding').LatLng | null>} */
const locationPoints = new Map();

/**
 * @param {string} address
 * @returns {Promise<import('types/bot/features/earthquake/geocoding').LatLng | null>}
 */
export const geocode = async address => {
  if (locationPoints.has(address)) {
    const location = locationPoints.get(address) ?? null;

    // wait for previous geocoding to finish
    if (location === null) {
      await setTimeout();
      return await geocode(address);
    }

    return location;
  }

  // prevent multiple geocoding at the same time
  // `null` means that geocoding is in progress
  locationPoints.set(address, null);

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

      locationPoints.set(address, location);
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
