'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, MapPin, Loader2 } from 'lucide-react';
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

interface Position {
    lat: number;
    lng: number;
}

interface LiveMapProps {
    onBack?: () => void;
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

const LiveMap: React.FC<LiveMapProps> = ({ onBack }) => {
    const [position, setPosition] = useState<Position | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

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
                zoom={16}
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

                {/* Accuracy Circle */}
                <Circle
                    center={[position.lat, position.lng]}
                    radius={50}
                    pathOptions={{
                        color: '#6366f1',
                        fillColor: '#6366f1',
                        fillOpacity: 0.2,
                        weight: 2,
                    }}
                />
            </MapContainer>

            {/* Location Info Overlay */}
            <div className="absolute top-4 left-4 z-[1000] bg-gray-900/90 backdrop-blur-md p-4 rounded-xl border border-gray-700 shadow-2xl max-w-sm">
                <div className="flex items-center gap-2 mb-2">
                    <Navigation className="text-indigo-400" />
                    <h2 className="text-xl font-bold text-white">Your Location</h2>
                </div>
                <p className="text-gray-400 text-sm mb-2">
                    Finding restaurants near you based on your conversation...
                </p>
                {error && (
                    <p className="text-yellow-400 text-xs">{error}</p>
                )}
            </div>

            {/* Back Button */}
            {onBack && (
                <button
                    onClick={onBack}
                    className="absolute top-4 right-4 z-[1000] flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white transition-colors bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full backdrop-blur-md border border-white/10"
                >
                    <MapPin size={16} />
                    New Recording
                </button>
            )}
        </div>
    );
};

export default LiveMap;
