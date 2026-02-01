'use client';

import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, MapPin, Loader2, Store, ExternalLink, Star } from 'lucide-react';
import { RestaurantResult } from '@/lib/types';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet marker icons in React
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom user location icon
const userLocationIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
});

// Restaurant icon
const restaurantIcon = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/1046/1046784.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
});

interface Position {
    lat: number;
    lng: number;
}

interface LiveMapProps {
    onBack?: () => void;
    transcript?: string;
}

// Component to handle flyTo animation when position changes
const FlyToLocation = ({ coords }: { coords: Position }) => {
    const map = useMap();
    useEffect(() => {
        map.flyTo([coords.lat, coords.lng], 16, {
            duration: 2,
            easeLinearity: 0.25
        });
    }, [coords, map]);
    return null;
};

const LiveMap: React.FC<LiveMapProps> = ({ onBack, transcript }) => {
    const [position, setPosition] = useState<Position | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Restaurant search state
    const [restaurants, setRestaurants] = useState<RestaurantResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const hasSearchedRef = useRef(false);

    useEffect(() => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser');
            setLoading(false);
            return;
        }

        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                setPosition({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                });
                setLoading(false);
                setError(null);
            },
            (err) => {
                console.error('Geolocation error:', err);
                setError(`Unable to get your location: ${err.message}`);
                setLoading(false);
                // Default to a fallback location (London)
                setPosition({ lat: 51.5074, lng: -0.1278 });
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
            }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    // Effect to trigger search when position is found and transcript exists
    useEffect(() => {
        const searchRestaurants = async () => {
            if (!position || !transcript || hasSearchedRef.current) return;

            // Only search if we have a meaningful transcript
            if (transcript.length < 5) return;

            setSearching(true);
            setSearchError(null);
            console.log('🔍 Starting Exa search...');

            try {
                // Construct prompt with location context
                const prompt = `Find restaurants near ${position.lat}, ${position.lng} that match this request: "${transcript}"`;

                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/exa/research/sync`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        prompt,
                        model: 'exa-research-pro' // Use pro model for better local results
                    }),
                });

                if (!response.ok) {
                    throw new Error(`Search failed: ${response.statusText}`);
                }

                const data: RestaurantResult[] = await response.json();
                console.log('🍽️ Found restaurants:', data);
                setRestaurants(data);
                hasSearchedRef.current = true;
            } catch (err) {
                console.error('Exa search error:', err);
                setSearchError(err instanceof Error ? err.message : 'Search failed');
            } finally {
                setSearching(false);
            }
        };

        searchRestaurants();
    }, [position, transcript]);

    if (loading) {
        return (
            <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
                    <p className="text-white text-lg">Getting your location...</p>
                </div>
            </div>
        );
    }

    if (!position) {
        return (
            <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                <div className="text-center text-white">
                    <MapPin className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <p className="text-lg">{error || 'Unable to get location'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full opacity-0 animate-fadeIn">
            <MapContainer
                center={[position.lat, position.lng]}
                zoom={15}
                scrollWheelZoom={true}
                style={{ height: '100%', width: '100%', background: '#111' }}
                zoomControl={false}
            >
                <FlyToLocation coords={position} />

                {/* Dark Matter Tiles */}
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />

                {/* User Location Marker */}
                <Marker position={[position.lat, position.lng]} icon={userLocationIcon}>
                    <Popup className="custom-popup">
                        <div className="p-2">
                            <h3 className="font-bold text-lg text-indigo-400">Your Location</h3>
                            <p className="text-sm text-gray-300">
                                {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
                            </p>
                        </div>
                    </Popup>
                </Marker>

                {/* Restaurant Markers */}
                {restaurants.map((place, idx) => (
                    <Marker
                        key={idx}
                        position={[place.geolocation.latitude, place.geolocation.longitude]}
                        icon={restaurantIcon}
                    >
                        <Popup className="custom-popup">
                            <div className="p-3 w-64">
                                <h3 className="font-bold text-lg text-white mb-1">{place.name}</h3>
                                <div className="flex items-center gap-1 text-yellow-400 mb-2">
                                    <Star size={14} fill="currentColor" />
                                    <span className="text-sm font-bold">{place.rating}</span>
                                    <span className="text-xs text-gray-400">({place.match_score.toFixed(1)} match)</span>
                                </div>
                                <p className="text-xs text-gray-300 mb-2 line-clamp-2">{place.address}</p>
                                <p className="text-xs text-indigo-300 font-medium mb-3 uppercase tracking-wide">{place.cuisine}</p>

                                {place.match_criteria && place.match_criteria.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-3">
                                        {place.match_criteria.slice(0, 3).map((tag, i) => (
                                            <span key={i} className="text-[10px] bg-white/10 text-gray-300 px-1.5 py-0.5 rounded">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <a
                                    href={place.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 rounded transition-colors"
                                >
                                    view details <ExternalLink size={12} />
                                </a>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {/* Accuracy Circle */}
                <Circle
                    center={[position.lat, position.lng]}
                    radius={50}
                    pathOptions={{
                        color: '#6366f1',
                        fillColor: '#6366f1',
                        fillOpacity: 0.1,
                        weight: 1,
                    }}
                />
            </MapContainer>

            {/* Location & Search Info Overlay */}
            <div className="absolute top-28 left-4 z-[1000] bg-gray-900/90 backdrop-blur-md p-4 rounded-xl border border-gray-700 shadow-2xl max-w-sm">
                <div className="flex items-center gap-2 mb-2">
                    <Navigation className="text-indigo-400" />
                    <h2 className="text-xl font-bold text-white">Your Location</h2>
                </div>

                {searching ? (
                    <div className="flex items-center gap-2 text-indigo-300 text-sm mt-2 animate-pulse">
                        <Loader2 size={16} className="animate-spin" />
                        <span>Searching for restaurants...</span>
                    </div>
                ) : restaurants.length > 0 ? (
                    <div className="mt-2">
                        <p className="text-green-400 text-sm font-bold mb-1">
                            Found {restaurants.length} matches!
                        </p>
                        <p className="text-gray-400 text-xs">
                            Based on: "{transcript?.substring(0, 50)}..."
                        </p>
                    </div>
                ) : searchError ? (
                    <p className="text-red-400 text-sm mt-1">Error: {searchError}</p>
                ) : (
                    <p className="text-gray-400 text-sm mb-2">
                        Ready to find places near you.
                    </p>
                )}

                {error && (
                    <p className="text-yellow-400 text-xs mt-2">{error}</p>
                )}
            </div>

            {/* Back Button */}
            {onBack && (
                <button
                    onClick={onBack}
                    className="absolute top-4 right-4 z-[1000] flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white transition-colors bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full backdrop-blur-md border border-white/10"
                >
                    <MapPin size={16} />
                    New Session
                </button>
            )}
        </div>
    );
};

export default LiveMap;
