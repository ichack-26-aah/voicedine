'use client';

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { CHAMPS_ELYSEES_COORDS, LOCATIONS, WALKING_ROUTE } from '@/lib/constants';
import { MapPin } from 'lucide-react';
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

const getIcon = (type: string) => {
  switch(type) {
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

const StreetView: React.FC = () => {
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
        
        {/* Dark Matter Tiles - Free, No API Key */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* Dynamic Markers */}
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
      <div className="absolute bottom-8 right-4 z-[1000] bg-gray-900/80 backdrop-blur-sm p-3 rounded-lg border border-gray-700 text-xs text-white">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-full bg-[#8b5cf6]"></span> Walking Route
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-500"></span> Locations
        </div>
      </div>
    </div>
  );
};

export default StreetView;
