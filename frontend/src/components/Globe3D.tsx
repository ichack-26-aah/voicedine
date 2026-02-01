'use client';

import React, { useEffect, useRef } from 'react';
import Globe, { GlobeMethods } from 'react-globe.gl';
import { CHAMPS_ELYSEES_COORDS } from '@/lib/constants';

interface Globe3DProps {
  onZoomComplete: () => void;
  isZooming: boolean;
}

const Globe3D: React.FC<Globe3DProps> = ({ onZoomComplete, isZooming }) => {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);

  // Ensure auto-rotation and default view when in idle state (load or return)
  useEffect(() => {
    if (!isZooming && globeRef.current) {
      // Force auto-rotate on
      const controls = globeRef.current.controls();
      if (controls) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.5;
      }

      // Reset camera to a nice global view
      globeRef.current.pointOfView({
        lat: 20, 
        lng: 0,
        altitude: 2.5 
      }, 1000);
    }
  }, [isZooming]);

  useEffect(() => {
    if (isZooming && globeRef.current) {
      // Disable auto-rotation for the dive
      const controls = globeRef.current.controls();
      if (controls) {
        controls.autoRotate = false;
      }
      
      // Animate camera to Paris
      // Slower animation (2500ms) and closer zoom (0.05) for better visual
      globeRef.current.pointOfView(
        {
          lat: CHAMPS_ELYSEES_COORDS.lat,
          lng: CHAMPS_ELYSEES_COORDS.lng,
          altitude: 0.05 
        },
        2500 
      );

      // Trigger the completion callback after animation
      const timer = setTimeout(() => {
        onZoomComplete();
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [isZooming, onZoomComplete]);

  // Only show the target marker when zooming/traveling
  const pointsData = isZooming ? [
    { lat: CHAMPS_ELYSEES_COORDS.lat, lng: CHAMPS_ELYSEES_COORDS.lng, size: 1, color: 'red' }
  ] : [];

  return (
    // Added w-full h-full to ensure container sizing
    <div className={`w-full h-full transition-opacity duration-1000 ease-in-out ${isZooming ? 'opacity-0 delay-[1500ms]' : 'opacity-100'}`}>
      <Globe
        ref={globeRef}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
        atmosphereColor="#3a228a"
        atmosphereAltitude={0.15}
        pointsData={pointsData}
        pointAltitude={0.1}
        pointColor="color"
        pointRadius={0.5}
        backgroundColor="rgba(0,0,0,0)"
        onGlobeReady={() => {
          if (globeRef.current) {
            const controls = globeRef.current.controls();
            if (controls) {
              controls.autoRotate = true;
              controls.autoRotateSpeed = 0.5;
            }
          }
        }}
      />
    </div>
  );
};

export default Globe3D;
