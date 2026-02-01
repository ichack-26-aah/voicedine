'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { CHAMPS_ELYSEES_COORDS, LOCATIONS, WALKING_ROUTE } from '@/lib/constants';

// User's position - hardcoded to Arc de Triomphe
const USER_POSITION = { lat: 48.8738, lng: 2.2950 };
import { RestaurantResult, DishItem } from '@/lib/types';
import { apiClient } from '@/lib/api';
import { MapPin } from 'lucide-react';
import SearchBar from './SearchBar';
import DishCarousel from './DishCarousel';
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

// Cuisine-based icon mapping using Flaticon food icons
const CUISINE_ICONS: Record<string, string> = {
  'italian': 'https://cdn-icons-png.flaticon.com/512/3595/3595455.png', // Pizza
  'pizza': 'https://cdn-icons-png.flaticon.com/512/3595/3595455.png',
  'pasta': 'https://cdn-icons-png.flaticon.com/512/3480/3480618.png', // Spaghetti
  'french': 'https://cdn-icons-png.flaticon.com/512/5787/5787016.png', // Croissant
  'japanese': 'https://cdn-icons-png.flaticon.com/512/2252/2252075.png', // Sushi
  'sushi': 'https://cdn-icons-png.flaticon.com/512/2252/2252075.png',
  'chinese': 'https://cdn-icons-png.flaticon.com/512/1046/1046786.png', // Noodles
  'asian': 'https://cdn-icons-png.flaticon.com/512/1046/1046786.png',
  'indian': 'https://cdn-icons-png.flaticon.com/512/2515/2515183.png', // Curry
  'mexican': 'https://cdn-icons-png.flaticon.com/512/5787/5787100.png', // Taco
  'american': 'https://cdn-icons-png.flaticon.com/512/1046/1046769.png', // Burger
  'burger': 'https://cdn-icons-png.flaticon.com/512/1046/1046769.png',
  'fast food': 'https://cdn-icons-png.flaticon.com/512/1046/1046769.png',
  'thai': 'https://cdn-icons-png.flaticon.com/512/2276/2276931.png', // Thai bowl
  'vietnamese': 'https://cdn-icons-png.flaticon.com/512/2276/2276931.png',
  'korean': 'https://cdn-icons-png.flaticon.com/512/2276/2276931.png',
  'mediterranean': 'https://cdn-icons-png.flaticon.com/512/3480/3480823.png', // Salad
  'greek': 'https://cdn-icons-png.flaticon.com/512/3480/3480823.png',
  'seafood': 'https://cdn-icons-png.flaticon.com/512/2515/2515269.png', // Fish
  'fish': 'https://cdn-icons-png.flaticon.com/512/2515/2515269.png',
  'steakhouse': 'https://cdn-icons-png.flaticon.com/512/3143/3143643.png', // Steak
  'steak': 'https://cdn-icons-png.flaticon.com/512/3143/3143643.png',
  'bbq': 'https://cdn-icons-png.flaticon.com/512/3143/3143643.png',
  'bakery': 'https://cdn-icons-png.flaticon.com/512/3081/3081967.png', // Bread
  'cafe': 'https://cdn-icons-png.flaticon.com/512/924/924514.png', // Coffee
  'coffee': 'https://cdn-icons-png.flaticon.com/512/924/924514.png',
  'dessert': 'https://cdn-icons-png.flaticon.com/512/3081/3081949.png', // Cake
  'ice cream': 'https://cdn-icons-png.flaticon.com/512/3081/3081949.png',
  'vegetarian': 'https://cdn-icons-png.flaticon.com/512/2515/2515263.png', // Salad
  'vegan': 'https://cdn-icons-png.flaticon.com/512/2515/2515263.png',
  'healthy': 'https://cdn-icons-png.flaticon.com/512/2515/2515263.png',
  'spanish': 'https://cdn-icons-png.flaticon.com/512/5787/5787089.png', // Tapas
  'default': 'https://cdn-icons-png.flaticon.com/512/1046/1046784.png', // Generic restaurant
};

// Get icon URL based on cuisine type
const getCuisineIconUrl = (cuisine: string): string => {
  const lowerCuisine = cuisine.toLowerCase();

  // Check for exact match first
  if (CUISINE_ICONS[lowerCuisine]) {
    return CUISINE_ICONS[lowerCuisine];
  }

  // Check if any keyword is contained in the cuisine string
  for (const [keyword, url] of Object.entries(CUISINE_ICONS)) {
    if (lowerCuisine.includes(keyword) || keyword.includes(lowerCuisine)) {
      return url;
    }
  }

  return CUISINE_ICONS['default'];
};

// Extract domain from URL for favicon
const extractDomain = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return null;
  }
};

// Get favicon URL using Google's favicon service
const getFaviconUrl = (url: string, size: number = 64): string | null => {
  const domain = extractDomain(url);
  if (!domain) return null;
  // Google's favicon service provides high-quality favicons
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
};

// Create favicon-based marker icon with fallback to cuisine icon
const createFaviconIcon = (url: string, cuisine: string) => {
  const faviconUrl = getFaviconUrl(url, 64);
  const fallbackUrl = getCuisineIconUrl(cuisine);
  
  return L.divIcon({
    className: 'favicon-marker',
    html: `
      <div style="
        width: 48px;
        height: 48px;
        background: white;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        border: 3px solid #6366f1;
        overflow: hidden;
        position: relative;
      ">
        <img 
          src="${faviconUrl || fallbackUrl}" 
          style="width: 32px; height: 32px; object-fit: contain;"
          onerror="this.onerror=null; this.src='${fallbackUrl}';"
        />
      </div>
      <div style="
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-top: 10px solid #6366f1;
        margin: -2px auto 0;
      "></div>
    `,
    iconSize: [48, 58],
    iconAnchor: [24, 58],
    popupAnchor: [0, -58],
  });
};

// Create cuisine-based icon
const createCuisineIcon = (cuisine: string) => {
  const iconUrl = getCuisineIconUrl(cuisine);
  return L.divIcon({
    className: 'cuisine-marker',
    html: `
      <div style="
        width: 44px;
        height: 44px;
        background: white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 3px 10px rgba(0,0,0,0.3);
        border: 3px solid #f59e0b;
      ">
        <img 
          src="${iconUrl}" 
          style="width: 28px; height: 28px;"
          onerror="this.src='https://cdn-icons-png.flaticon.com/512/1046/1046784.png'"
        />
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 44],
    popupAnchor: [0, -44],
  });
};

// Fallback search result icon
const searchResultIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/1046/1046784.png',
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
  const [activeRequirements, setActiveRequirements] = useState<string[]>([]);
  
  // Dish carousel state - async background Exa call
  const [dishes, setDishes] = useState<DishItem[]>([]);
  const [dishesLoading, setDishesLoading] = useState(false);

  // Booking state
  const [bookingInProgress, setBookingInProgress] = useState<string | null>(null); // restaurant name being booked
  const [bookingStatus, setBookingStatus] = useState<{ name: string; status: 'success' | 'error'; message: string } | null>(null);

  // Background Exa call to fetch dishes when a restaurant is selected
  useEffect(() => {
    if (!selectedRestaurant) {
      setDishes([]);
      setDishesLoading(false);
      return;
    }

    const fetchDishes = async () => {
      setDishesLoading(true);
      setDishes([]); // Clear previous dishes
      try {
        const results = await apiClient.post<DishItem[]>(
          '/api/exa/dishes',
          { 
            restaurantUrl: selectedRestaurant.url, 
            restaurantName: selectedRestaurant.name,
            cuisine: selectedRestaurant.cuisine
          }
        );
        if (results && results.length > 0) {
          setDishes(results);
        }
      } catch (err) {
        console.error('[DishCarousel] Failed to fetch dishes:', err);
        // Silent fail - don't show error to user, just no dishes
      } finally {
        setDishesLoading(false);
      }
    };

    fetchDishes();
  }, [selectedRestaurant]);

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

      // Auto-select the first (topmost) result to show the route
      if (validResults.length > 0) {
        setSelectedRestaurant(validResults[0]);
      } else {
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

  // Handle booking - trigger Bland AI call
  const handleBooking = useCallback(async (restaurantName: string, phoneNumber: string) => {
    // Prevent double-booking
    if (bookingInProgress) return;

    setBookingInProgress(restaurantName);
    setBookingStatus(null);

    try {
      console.log(`[Booking] Initiating call for ${restaurantName}...`);
      await apiClient.bookRestaurant(restaurantName, phoneNumber || '');

      console.log(`[Booking] Call initiated successfully for ${restaurantName}`);
      setBookingStatus({
        name: restaurantName,
        status: 'success',
        message: 'Call initiated! James is booking your table...'
      });
    } catch (err) {
      console.error('[Booking] Failed to initiate call:', err);
      setBookingStatus({
        name: restaurantName,
        status: 'error',
        message: err instanceof Error ? err.message : 'Failed to initiate call'
      });
    } finally {
      setBookingInProgress(null);
      // Clear status after 5 seconds
      setTimeout(() => setBookingStatus(null), 5000);
    }
  }, [bookingInProgress]);

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
              icon={restaurant.url ? createFaviconIcon(restaurant.url, restaurant.cuisine || 'default') : (restaurant.cuisine ? createCuisineIcon(restaurant.cuisine) : searchResultIcon)}
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

                    {/* Make Booking Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBooking(restaurant.name, restaurant.phone || '');
                      }}
                      disabled={bookingInProgress === restaurant.name}
                      className={`
                        w-full text-center text-xs py-2 rounded-md mt-2 transition-all duration-200 font-medium
                        ${bookingInProgress === restaurant.name
                          ? 'bg-yellow-600 text-white cursor-wait'
                          : bookingStatus?.name === restaurant.name && bookingStatus.status === 'success'
                            ? 'bg-green-600 text-white'
                            : bookingStatus?.name === restaurant.name && bookingStatus.status === 'error'
                              ? 'bg-red-600 text-white'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }
                      `}
                    >
                      {bookingInProgress === restaurant.name ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Calling...
                        </span>
                      ) : bookingStatus?.name === restaurant.name ? (
                        <span>{bookingStatus.status === 'success' ? '✓ Call Initiated!' : '✗ Failed'}</span>
                      ) : (
                        <span>📞 Make Booking</span>
                      )}
                    </button>

                    {/* View Details link - secondary */}
                    {restaurant.url && (
                      <a
                        href={restaurant.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-center text-xs text-gray-400 hover:text-gray-200 py-1 mt-1 transition-colors"
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
        <div className="text-gray-400 text-sm mb-4 max-h-40 overflow-y-auto">
          {activeRequirements.length > 0 ? (
            <div className="space-y-1">
              <p className="font-semibold text-indigo-300 mb-1">Active Filters ({activeRequirements.length}):</p>
              {activeRequirements.map((req, index) => (
                <p key={index} className="flex items-start gap-2">
                  <span className="text-indigo-500 mt-1">•</span>
                  <span>{req}</span>
                </p>
              ))}
            </div>
          ) : (
             <p>Explore the world&apos;s most beautiful avenue in Paris. Start speaking to filter restaurants.</p>
          )}
        </div>
      </div>

      {/* Dish Carousel - shows when a restaurant is selected */}
      {selectedRestaurant && (
        <DishCarousel 
          dishes={dishes} 
          loading={dishesLoading} 
          restaurantName={selectedRestaurant.name}
        />
      )}

      {/* Search Bar */}
      <SearchBar
        onSearch={handleSearch}
        onRequirementsUpdate={setActiveRequirements}
        onRestaurantsFound={(results) => {
          // Direct update from voice loop - bypasses search flow
          const validResults = results.filter(
            r => r.geolocation &&
              typeof r.geolocation.latitude === 'number' &&
              typeof r.geolocation.longitude === 'number'
          );
          setRestaurants(validResults);
          setResultCount(validResults.length);
          // Auto-select the top result
          if (validResults.length > 0) {
            setSelectedRestaurant(validResults[0]);
          } else {
            setSelectedRestaurant(null);
          }
        }}
        isLoading={isLoading}
        error={error}
        resultCount={resultCount}
        onClearError={handleClearError}
        autoStartRecording={true}
      />
    </div>
  );
};

export default StreetView;
