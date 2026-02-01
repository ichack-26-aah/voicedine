'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { CHAMPS_ELYSEES_COORDS, LOCATIONS, WALKING_ROUTE } from '@/lib/constants';

// User's position - hardcoded to Arc de Triomphe
const USER_POSITION = { lat: 48.8738, lng: 2.2950 };
import { RestaurantResult } from '@/lib/types';
import { apiClient } from '@/lib/api';
import { MapPin } from 'lucide-react';
import SearchBar from './SearchBar';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet marker icons in React
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom Icons
const restaurantIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448609.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const shopIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3081/3081559.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const landmarkIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/263/263062.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

// Search result restaurant icon - bright and distinctive food icon
const searchResultIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/1046/1046784.png', // Colorful restaurant plate icon
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

// User position icon - blue pulsing circle
const userPositionIcon = L.divIcon({
  className: 'user-position-marker',
  html: `
    <div style="
      width: 24px;
      height: 24px;
      background: #3b82f6;
      border: 4px solid white;
      border-radius: 50%;
      box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3), 0 2px 8px rgba(0,0,0,0.3);
    "></div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const getIcon = (type: string) => {
  switch (type) {
    case 'restaurant': return restaurantIcon;
    case 'shop': return shopIcon;
    default: return landmarkIcon;
  }
}

// Component to handle initial flyTo animation
const FlyToLocation = ({ coords }: { coords: { lat: number; lng: number } }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(coords, 16, {
      duration: 2,
      easeLinearity: 0.25
    });
  }, [coords, map]);
  return null;
};

// Component to fit bounds to restaurant markers
const FitBoundsToMarkers = ({ restaurants }: { restaurants: RestaurantResult[] }) => {
  const map = useMap();

  useEffect(() => {
    if (restaurants.length === 0) return;

    const bounds = L.latLngBounds(
      restaurants.map(r => [r.geolocation.latitude, r.geolocation.longitude])
    );

    // Add padding and fly to bounds
    map.flyToBounds(bounds, {
      padding: [50, 50],
      duration: 1.5,
      maxZoom: 15,
    });
  }, [restaurants, map]);

  return null;
};

// Calculate distance between two points using Haversine formula (returns miles)
const calculateDistance = (
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number => {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Star rating component
const StarRating = ({ rating }: { rating: number }) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;

  return (
    <div className="flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => (
        <span
          key={i}
          className={`text-sm ${i < fullStars
            ? 'text-yellow-400'
            : i === fullStars && hasHalfStar
              ? 'text-yellow-400/50'
              : 'text-gray-400'
            }`}
        >
          ★
        </span>
      ))}
      <span className="text-xs text-gray-300 ml-1">({rating.toFixed(1)})</span>
    </div>
  );
};

const StreetView: React.FC = () => {
  const [restaurants, setRestaurants] = useState<RestaurantResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultCount, setResultCount] = useState<number | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantResult | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);

  // Fetch route from OSRM when a restaurant is selected
  useEffect(() => {
    if (!selectedRestaurant) {
      setRouteCoordinates([]);
      setRouteDistance(null);
      return;
    }

    const fetchRoute = async () => {
      try {
        const start = `${USER_POSITION.lng},${USER_POSITION.lat}`;
        const end = `${selectedRestaurant.geolocation.longitude},${selectedRestaurant.geolocation.latitude}`;

        // Use OSRM demo server for walking route (free, no API key needed)
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/foot/${start};${end}?overview=full&geometries=geojson`
        );

        if (!response.ok) throw new Error('Failed to fetch route');

        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          // Convert GeoJSON coordinates [lng, lat] to Leaflet format [lat, lng]
          const coords: [number, number][] = route.geometry.coordinates.map(
            (coord: [number, number]) => [coord[1], coord[0]]
          );
          setRouteCoordinates(coords);
          // Distance is in meters, convert to miles
          setRouteDistance(route.distance / 1609.344);
        }
      } catch (err) {
        console.error('Failed to fetch route:', err);
        // Fallback to straight line if OSRM fails
        setRouteCoordinates([
          [USER_POSITION.lat, USER_POSITION.lng],
          [selectedRestaurant.geolocation.latitude, selectedRestaurant.geolocation.longitude]
        ]);
        // Use Haversine as fallback
        setRouteDistance(calculateDistance(
          USER_POSITION.lat, USER_POSITION.lng,
          selectedRestaurant.geolocation.latitude, selectedRestaurant.geolocation.longitude
        ));
      }
    };

    fetchRoute();
  }, [selectedRestaurant]);

  const handleSearch = useCallback(async (query: string) => {
    setIsLoading(true);
    setError(null);
    setRestaurants([]); // Clear previous markers
    setResultCount(null);
    setSelectedRestaurant(null); // Clear previous route

    try {
      const results = await apiClient.post<RestaurantResult[]>(
        '/api/exa/research/sync',
        { prompt: query }
      );

      // Filter out restaurants without valid geolocation
      const validResults = results.filter(
        r => r.geolocation &&
          typeof r.geolocation.latitude === 'number' &&
          typeof r.geolocation.longitude === 'number'
      );

      setRestaurants(validResults);
      setResultCount(validResults.length);

      if (validResults.length === 0) {
        setError('No restaurants found with valid locations. Try a different search.');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to search restaurants. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleClearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <div className="relative w-full h-full opacity-0 animate-fadeIn">
      <MapContainer
        center={[CHAMPS_ELYSEES_COORDS.lat, CHAMPS_ELYSEES_COORDS.lng]}
        zoom={13}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', background: '#111' }}
        zoomControl={false}
      >
        <FlyToLocation coords={CHAMPS_ELYSEES_COORDS} />

        {/* Fit bounds when restaurants change */}
        {restaurants.length > 0 && (
          <FitBoundsToMarkers restaurants={restaurants} />
        )}

        {/* Dark Matter Tiles - Free, No API Key */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* User Position Marker */}
        <Marker
          position={[USER_POSITION.lat, USER_POSITION.lng]}
          icon={userPositionIcon}
          zIndexOffset={1000}
        >
          <Popup>
            <div className="p-2 text-center">
              <h3 className="font-bold text-blue-500">Your Location</h3>
              <p className="text-sm text-gray-600">Arc de Triomphe, Paris</p>
            </div>
          </Popup>
        </Marker>

        {/* Static Location Markers */}
        {LOCATIONS.map((loc) => (
          <Marker key={loc.id} position={[loc.position.lat, loc.position.lng]} icon={getIcon(loc.type)}>
            <Popup className="custom-popup">
              <div className="p-2">
                <h3 className="font-bold text-lg text-indigo-400">{loc.name}</h3>
                <p className="text-sm text-gray-300">{loc.description}</p>
                <span className="text-xs uppercase tracking-wider text-gray-500 mt-2 block">{loc.type}</span>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Search Result Restaurant Markers */}
        {restaurants.map((restaurant, index) => {
          const distance = calculateDistance(
            USER_POSITION.lat, USER_POSITION.lng,
            restaurant.geolocation.latitude, restaurant.geolocation.longitude
          );
          const isSelected = selectedRestaurant?.name === restaurant.name &&
            selectedRestaurant?.address === restaurant.address;
          const displayDistance = isSelected && routeDistance !== null
            ? routeDistance
            : distance;
          const distanceLabel = isSelected && routeDistance !== null
            ? 'Walking:'
            : 'Distance:';

          return (
            <Marker
              key={`search-${index}-${restaurant.name}`}
              position={[restaurant.geolocation.latitude, restaurant.geolocation.longitude]}
              icon={searchResultIcon}
              eventHandlers={{
                click: () => setSelectedRestaurant(restaurant),
              }}
            >
              <Popup className="custom-popup" maxWidth={300}>
                <div className="p-3 min-w-[220px]">
                  <h3 className="font-bold text-lg text-indigo-400 mb-1">{restaurant.name}</h3>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">{distanceLabel}</span>
                      <span className={`font-bold ${isSelected ? 'text-cyan-400' : 'text-gray-300'}`}>
                        {displayDistance.toFixed(2)} miles
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Cuisine:</span>
                      <span className="text-white font-medium">{restaurant.cuisine}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Rating:</span>
                      <StarRating rating={restaurant.rating} />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Price:</span>
                      <span className="text-emerald-400 font-medium">{restaurant.price_range}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Match Score:</span>
                      <span className="text-amber-400 font-bold">{restaurant.match_score.toFixed(1)}/10</span>
                    </div>

                    <p className="text-gray-300 text-xs pt-1 border-t border-gray-600">
                      {restaurant.address}
                    </p>

                    {restaurant.match_criteria && restaurant.match_criteria.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {restaurant.match_criteria.slice(0, 3).map((criteria, i) => (
                          <span
                            key={i}
                            className="text-xs bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full"
                          >
                            {criteria}
                          </span>
                        ))}
                      </div>
                    )}

                    {restaurant.url && (
                      <a
                        href={restaurant.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-center text-xs bg-indigo-600 hover:bg-indigo-500 text-white py-1.5 rounded-md mt-2 transition-colors"
                      >
                        View Details →
                      </a>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Route from user to selected restaurant */}
        {routeCoordinates.length > 0 && (
          <Polyline
            positions={routeCoordinates}
            pathOptions={{
              color: '#06b6d4', // Cyan color
              weight: 4,
              opacity: 0.9,
            }}
          />
        )}

        {/* Walking Route */}
        <Polyline
          positions={WALKING_ROUTE.path.map(p => [p.lat, p.lng])}
          pathOptions={{ color: WALKING_ROUTE.color, weight: 5, opacity: 0.7, dashArray: '10, 10' }}
        >
          <Popup>
            <div className="font-bold text-violet-400">{WALKING_ROUTE.name}</div>
          </Popup>
        </Polyline>
      </MapContainer>

      {/* Overlay UI for Map */}
      <div className="absolute top-4 left-4 z-[1000] bg-gray-900/90 backdrop-blur-md p-4 rounded-xl border border-gray-700 shadow-2xl max-w-sm">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="text-indigo-400" />
          <h2 className="text-xl font-bold text-white">Avenue des Champs-Élysées</h2>
        </div>
        <p className="text-gray-400 text-sm mb-4">
          Explore the world&apos;s most beautiful avenue in Paris. Click markers for details or follow the purple path for a scenic walk.
        </p>
      </div>

      {/* Legend */}
      <div className="absolute bottom-28 right-4 z-[1000] bg-gray-900/80 backdrop-blur-sm p-3 rounded-lg border border-gray-700 text-xs text-white">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-sm"></span> Your Location
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-full bg-[#8b5cf6]"></span> Walking Route
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-full bg-gray-400"></span> Locations
        </div>
        {restaurants.length > 0 && (
          <div className="flex items-center gap-2 mb-1">
            <span className="w-3 h-3 rounded-full bg-amber-500"></span> Search Results
          </div>
        )}
        {selectedRestaurant && (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-cyan-500"></span> Route to Restaurant
          </div>
        )}
      </div>

      {/* Search Bar */}
      <SearchBar
        onSearch={handleSearch}
        isLoading={isLoading}
        error={error}
        resultCount={resultCount}
        onClearError={handleClearError}
      />
    </div>
  );
};

export default StreetView;
