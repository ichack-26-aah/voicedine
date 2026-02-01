'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Globe, ChevronRight, Search } from 'lucide-react';

// Dynamic imports to avoid SSR issues with WebGL and Leaflet
const Globe3D = dynamic(() => import('@/components/Globe3D'), { ssr: false });
const StreetView = dynamic(() => import('@/components/StreetView'), { ssr: false });

enum ViewState {
  GLOBE_IDLE,
  GLOBE_ZOOMING,
  STREET_VIEW
}

const PLACES = [
  "Avenue des Champs-Élysées",
  "Shibuya Crossing", 
  "Times Square", 
  "The Louvre", 
  "Santorini", 
  "Dubai Marina"
];

const TypewriterText = () => {
  const [text, setText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [loopNum, setLoopNum] = useState(0);
  const [typingSpeed, setTypingSpeed] = useState(150);

  useEffect(() => {
    const handleTyping = () => {
      const i = loopNum % PLACES.length;
      const fullText = PLACES[i];

      setText(isDeleting 
        ? fullText.substring(0, text.length - 1) 
        : fullText.substring(0, text.length + 1)
      );

      setTypingSpeed(isDeleting ? 50 : 100);

      if (!isDeleting && text === fullText) {
        setTimeout(() => setIsDeleting(true), 2000);
      } else if (isDeleting && text === '') {
        setIsDeleting(false);
        setLoopNum(loopNum + 1);
      }
    };

    const timer = setTimeout(handleTyping, typingSpeed);
    return () => clearTimeout(timer);
  }, [text, isDeleting, loopNum, typingSpeed]);

  return (
    <span className="text-gray-800">
      Explore <span className="font-bold text-black">{text}</span>
      <span className="animate-pulse ml-0.5 text-indigo-600">|</span>
    </span>
  );
};

export default function Home() {
  const [viewState, setViewState] = useState<ViewState>(ViewState.GLOBE_IDLE);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const startJourney = () => {
    setViewState(ViewState.GLOBE_ZOOMING);
  };

  const handleZoomComplete = () => {
    setViewState(ViewState.STREET_VIEW);
  };

  const resetView = () => {
    setViewState(ViewState.GLOBE_IDLE);
  };

  if (!mounted) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black text-white font-sans selection:bg-indigo-500/30">
      
      {/* Background container for Globe - stays mounted but hidden when needed */}
      {viewState !== ViewState.STREET_VIEW && (
        <div className="absolute inset-0 z-0">
          <Globe3D 
            isZooming={viewState === ViewState.GLOBE_ZOOMING} 
            onZoomComplete={handleZoomComplete} 
          />
        </div>
      )}

      {/* Street View Container */}
      {viewState === ViewState.STREET_VIEW && (
        <div className="absolute inset-0 z-10">
          <StreetView />
        </div>
      )}

      {/* Main UI Overlay - Header */}
      <header className="absolute top-0 left-0 w-full p-6 z-50 pointer-events-none flex justify-end items-start bg-gradient-to-b from-black/80 to-transparent">
        {viewState === ViewState.STREET_VIEW && (
          <button 
            onClick={resetView}
            className="pointer-events-auto flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white transition-colors bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full backdrop-blur-md border border-white/10"
          >
            <Globe size={16} />
            Back to Globe
          </button>
        )}
      </header>

      {/* Call to Action Bar (Only visible on Globe) */}
      {viewState === ViewState.GLOBE_IDLE && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4">
          <button
            onClick={startJourney}
            className="group relative w-full flex items-center justify-between bg-white/90 backdrop-blur-xl text-left px-4 py-3 rounded-full shadow-[0_0_50px_-10px_rgba(255,255,255,0.3)] hover:scale-[1.02] hover:bg-white transition-all duration-300 border border-white/20"
          >
            <div className="flex items-center gap-4 pl-2">
              <Search className="text-gray-400" size={24} />
              <div className="text-lg font-medium">
                <TypewriterText />
              </div>
            </div>
            
            <div className="bg-indigo-600 rounded-full p-3 text-white shadow-lg group-hover:bg-indigo-500 transition-colors relative overflow-hidden">
              <ChevronRight size={20} className="relative z-10" />
              {/* Ripple effect hint */}
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            </div>
          </button>
          
          <p className="mt-6 text-center text-gray-400 text-xs tracking-widest uppercase opacity-80">
            Interactive 3D Visualization
          </p>
        </div>
      )}

      {/* Footer / Credits */}
      <div className="absolute bottom-4 right-6 z-50 text-[10px] text-gray-600 pointer-events-none">
        Powered by React Globe GL & Leaflet • No API Keys
      </div>
    </div>
  );
}
