export type GeocodingResponse = GeocodingSuccessResponse | GeocodingFailureResponse;

interface GeocodingSuccessResponse {
  status: 'OK';
  results: {
    address_components: {
      long_name: string;
      short_name: string;
      types: LocationType[];
    }[];
    formatted_address: string;
    geometry: {
      bounds: {
        northeast: LatLng;
        southwest: LatLng;
      };
      location: LatLng;
      location_type: 'APPROXIMATE';
      viewport: {
        northeast: LatLng;
        southwest: LatLng;
      };
    };
    place_id: string;
    types: LocationType[];
  }[];
}

interface GeocodingFailureResponse {
  status: 'ZERO_RESULTS' | 'OVER_DAILY_LIMIT' | 'OVER_QUERY_LIMIT' | 'REQUEST_DENIED' | 'INVALID_REQUEST' | 'UNKNOWN_ERROR';
  error_message?: string;
  results: [];
}

export interface LatLng {
  lat: number;
  lng: number;
}

type LocationType =
  | 'country'
  | 'political'
  | 'locality'
  | 'administrative_area_level_1'
  | 'administrative_area_level_2';
