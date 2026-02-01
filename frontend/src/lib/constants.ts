import { LocationMarker, RouteData, Coordinate } from './types';

export const CHAMPS_ELYSEES_COORDS: Coordinate = {
  lat: 48.8698,
  lng: 2.3075
};

// Mock locations around Champs-Élysées
export const LOCATIONS: LocationMarker[] = [
  {
    id: '1',
    name: 'Ladurée',
    type: 'restaurant',
    position: { lat: 48.8709, lng: 2.3033 },
    description: 'Famous luxury bakery known for the best macarons in Paris.'
  },
  {
    id: '2',
    name: 'Louis Vuitton',
    type: 'shop',
    position: { lat: 48.8716, lng: 2.3012 },
    description: 'Flagship luxury fashion store with iconic architecture.'
  },
  {
    id: '3',
    name: 'Arc de Triomphe',
    type: 'landmark',
    position: { lat: 48.8738, lng: 2.2950 },
    description: 'Iconic triumphal arch honoring those who fought for France.'
  },
  {
    id: '4',
    name: 'Fouquet\'s',
    type: 'restaurant',
    position: { lat: 48.8713, lng: 2.3018 },
    description: 'Historic brasserie known for its celebrity clientele.'
  }
];

// A walking path along the Avenue
export const WALKING_ROUTE: RouteData = {
  id: 'route-1',
  name: 'Champs-Élysées Stroll',
  color: '#8b5cf6', // Violet-500
  path: [
    { lat: 48.8738, lng: 2.2950 }, // Start at Arc de Triomphe
    { lat: 48.8728, lng: 2.2980 },
    { lat: 48.8716, lng: 2.3012 }, // Louis Vuitton
    { lat: 48.8709, lng: 2.3033 }, // Ladurée
    { lat: 48.8698, lng: 2.3075 }, // Mid-avenue
  ]
};
