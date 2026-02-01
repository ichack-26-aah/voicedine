'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Globe, Zap, Map } from 'lucide-react';
import AudioRecorderButton from '@/components/AudioRecorderButton';
import { useLiveScribe } from '@/lib/useLiveScribe';

// Dynamic imports to avoid SSR issues with WebGL and Leaflet
const Globe3D = dynamic(() => import('@/components/Globe3D'), { ssr: false });
const StreetView = dynamic(() => import('@/components/StreetView'), { ssr: false });
const LiveMap = dynamic(() => import('@/components/LiveMap'), { ssr: false });

enum ViewState {
  GLOBE_IDLE,
  GLOBE_ZOOMING,
  STREET_VIEW,
  LIVE_MAP,
}

export default function Home() {
  const [viewState, setViewState] = useState<ViewState>(ViewState.GLOBE_IDLE);
  const [mounted, setMounted] = useState(false);
  const [volume, setVolume] = useState(0);

  // Navigate to map when recording stops
  const handleRecordingStop = useCallback(() => {
    console.log('🎤 Recording stopped! Navigating to map...');
    setViewState(ViewState.LIVE_MAP);
  }, []);

  const {
    isRecording,
    isConnecting,
    error,
    startRecording,
    stopRecording,
  } = useLiveScribe({
    onVolumeChange: setVolume,
    onError: (err) => console.error('❌ Transcription error:', err),
    onRecordingStop: handleRecordingStop,
    onTranscript: (segment) => {
      // Log transcripts to console instead of showing in UI
      console.log(`📝 [Speaker ${segment.speaker_id}]: ${segment.text}`);
    },
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleZoomComplete = () => {
    setViewState(ViewState.STREET_VIEW);
  };

  const resetView = () => {
    setViewState(ViewState.GLOBE_IDLE);
  };

  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      console.log('🛑 Stopping recording...');
      stopRecording();
    } else {
      console.log('🎙️ Starting recording...');
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

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
      {(viewState === ViewState.GLOBE_IDLE || viewState === ViewState.GLOBE_ZOOMING) && (
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

      {/* Live Map Container */}
      {viewState === ViewState.LIVE_MAP && (
        <div className="absolute inset-0 z-10">
          <LiveMap onBack={resetView} />
        </div>
      )}

      {/* Main UI Overlay - Header */}
      <header className="absolute top-0 left-0 w-full p-6 z-50 pointer-events-none flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent">
        <div className="pointer-events-auto">
          <h1 className="text-3xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500">
            THE FIXER
          </h1>
          <p className="text-xs text-gray-400 tracking-widest uppercase mt-1 flex items-center gap-2">
            <Zap size={12} className="text-yellow-500" />
            Voice Intelligence System
          </p>
        </div>

        {(viewState === ViewState.STREET_VIEW || viewState === ViewState.LIVE_MAP) && (
          <button
            onClick={resetView}
            className="pointer-events-auto flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white transition-colors bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full backdrop-blur-md border border-white/10"
          >
            <Globe size={16} />
            New Session
          </button>
        )}
      </header>

      {/* Bottom Center - Audio Recorder Button (hide on map view) */}
      {viewState !== ViewState.LIVE_MAP && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
          <AudioRecorderButton
            isRecording={isRecording}
            isConnecting={isConnecting}
            volume={volume}
            onToggle={handleToggleRecording}
          />
        </div>
      )}

      {/* Status Indicator */}
      {isRecording && (
        <div className="absolute bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 bg-red-500/20 rounded-full border border-red-500/30">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] font-bold tracking-wider text-red-400 uppercase">
            Recording
          </span>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-red-500/20 rounded-lg border border-red-500/30">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Map indicator when on map view */}
      {viewState === ViewState.LIVE_MAP && (
        <div className="absolute bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 bg-indigo-500/20 rounded-full border border-indigo-500/30">
          <Map size={12} className="text-indigo-400" />
          <span className="text-[10px] font-bold tracking-wider text-indigo-400 uppercase">
            Finding Restaurants
          </span>
        </div>
      )}

      {/* Footer / Credits */}
      <div className="absolute bottom-4 left-4 z-40 text-[10px] text-gray-600 pointer-events-none">
        Powered by ElevenLabs Scribe v2
      </div>
    </div>
  );
}
