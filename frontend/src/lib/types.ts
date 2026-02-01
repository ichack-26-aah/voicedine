export interface Coordinate {
  lat: number;
  lng: number;
}

export interface LocationMarker {
  id: string;
  name: string;
  type: 'restaurant' | 'shop' | 'landmark';
  position: Coordinate;
  description: string;
}

export interface RouteData {
  id: string;
  name: string;
  path: Coordinate[];
  color: string;
}

// export interface TranscriptSegment {
//   id: string;
//   text: string;
//   speaker_id: number;
//   is_final: boolean;
//   timestamp: number;
// }

// Exa API restaurant search types
export interface Geolocation {
  latitude: number;
  longitude: number;
}

export interface RestaurantResult {
  name: string;
  address: string;
  cuisine: string;
  rating: number;
  match_score: number;
  match_criteria: string[];
  price_range: string;
  url: string;
  geolocation: Geolocation;
}
