'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Search, Loader2, AlertCircle, X, Mic, MicOff } from 'lucide-react';
import { useVoiceRecorder } from '@/lib/useVoiceRecorder';
import TranscriptBubbles from './TranscriptBubbles';

interface SearchBarProps {
    onSearch: (query: string) => Promise<void>;
    isLoading: boolean;
    error: string | null;
    resultCount: number | null;
    onClearError: () => void;
    autoStartRecording?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
    onSearch,
    isLoading,
    error,
    resultCount,
    onClearError,
    autoStartRecording = false,
}) => {
    const [validationError, setValidationError] = useState<string | null>(null);
    const hasAutoStarted = useRef(false);

    const {
        isRecording,
        isConnecting,
        speakerTranscripts,
        error: voiceError,
        startRecording,
        stopRecording,
        clearTranscripts,
        getMergedTranscript,
        clearError: clearVoiceError,
    } = useVoiceRecorder();

    // Auto-start recording when component mounts (if enabled)
    useEffect(() => {
        if (autoStartRecording && !hasAutoStarted.current && !isRecording && !isConnecting) {
            hasAutoStarted.current = true;
            // Small delay to ensure component is fully mounted
            const timer = setTimeout(() => {
                startRecording();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [autoStartRecording, isRecording, isConnecting, startRecording]);

    // New mic click behavior: stop → submit merged transcript → clear → restart
    const handleMicClick = useCallback(async () => {
        if (isRecording) {
            // Stop recording first
            stopRecording();

            // Get merged transcript from all speakers
            const mergedQuery = getMergedTranscript().trim();

            // If there's a query, submit it
            if (mergedQuery) {
                setValidationError(null);
                onClearError();

                // Submit the search
                await onSearch(mergedQuery);
            }

            // Clear the transcript bubbles
            clearTranscripts();

            // Restart recording after a brief delay
            setTimeout(async () => {
                await startRecording();
            }, 300);
        } else {
            // If not recording (edge case), just start
            clearTranscripts();
            await startRecording();
        }
    }, [isRecording, stopRecording, getMergedTranscript, onSearch, onClearError, startRecording, clearTranscripts]);

    const displayError = validationError || error || voiceError;

    const handleClearError = () => {
        setValidationError(null);
        onClearError();
        clearVoiceError();
    };

    // Check if there are any transcripts to display
    const hasTranscripts = speakerTranscripts.size > 0 &&
        Array.from(speakerTranscripts.values()).some(t => t.trim().length > 0);

    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-2xl px-4">
            {/* Results count */}
            {resultCount !== null && !isLoading && (
                <div className="mb-3 text-center">
                    <span className="inline-flex items-center gap-2 bg-green-500/20 backdrop-blur-md text-green-300 text-sm font-medium px-4 py-2 rounded-full border border-green-500/30">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        Found {resultCount} restaurant{resultCount !== 1 ? 's' : ''}
                    </span>
                </div>
            )}

            {/* Transcript Bubbles - per speaker */}
            {hasTranscripts && (
                <TranscriptBubbles speakerTranscripts={speakerTranscripts} />
            )}

            {/* Recording indicator */}
            {(isRecording || isConnecting) && !hasTranscripts && (
                <div className="mb-3 text-center">
                    <span className="inline-flex items-center gap-2 bg-red-500/20 backdrop-blur-md text-red-300 text-sm font-medium px-4 py-2 rounded-full border border-red-500/30 animate-pulse">
                        <span className="w-2 h-2 bg-red-500 rounded-full" />
                        {isConnecting ? 'Connecting...' : 'Listening... Speak now'}
                    </span>
                </div>
            )}

            {/* Error message */}
            {displayError && !isRecording && !isConnecting && (
                <div className="mb-3 flex justify-center">
                    <div className="inline-flex items-center gap-2 bg-red-500/20 backdrop-blur-md text-red-300 text-sm font-medium px-4 py-2 rounded-full border border-red-500/30">
                        <AlertCircle size={16} />
                        {displayError}
                        <button
                            onClick={handleClearError}
                            className="ml-1 hover:text-red-100 transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* Search bar - minimal when recording */}
            <div className="relative">
                <div className="flex items-center gap-2 bg-gray-900/90 backdrop-blur-xl rounded-full shadow-2xl border border-gray-700/50 p-2 transition-all duration-300 focus-within:border-indigo-500/50 focus-within:shadow-indigo-500/10">
                    <div className="flex-1 flex items-center gap-3 pl-4">
                        <Search className="text-gray-400 flex-shrink-0" size={20} />
                        <div className="w-full text-gray-500 text-base">
                            {isRecording
                                ? (hasTranscripts ? 'Click mic to search...' : 'Speak your search...')
                                : 'Voice search enabled'}
                        </div>
                    </div>

                    {/* Microphone button - main action button */}
                    <button
                        type="button"
                        onClick={handleMicClick}
                        disabled={isLoading || isConnecting}
                        className={`
                            flex items-center justify-center p-3 rounded-full transition-all duration-200
                            ${isRecording
                                ? 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-500/30 animate-pulse'
                                : isConnecting
                                    ? 'bg-gray-600 cursor-wait'
                                    : 'bg-gray-700 hover:bg-gray-600'
                            }
                            disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                        title={isRecording ? 'Stop & Search' : 'Start voice input'}
                    >
                        {isConnecting ? (
                            <Loader2 size={20} className="text-white animate-spin" />
                        ) : isRecording ? (
                            <MicOff size={20} className="text-white" />
                        ) : (
                            <Mic size={20} className="text-white" />
                        )}
                    </button>

                    {/* Search button - shows loading state */}
                    {isLoading && (
                        <div className="flex items-center justify-center gap-2 bg-indigo-600/50 text-white font-medium px-6 py-3 rounded-full">
                            <Loader2 size={18} className="animate-spin" />
                            <span>Searching...</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Hint text */}
            <p className="mt-3 text-center text-gray-500 text-xs">
                {isRecording
                    ? 'Speak your search • Click mic to search • Multiple speakers supported'
                    : 'Voice recording will auto-start • Click mic to search'}
            </p>
        </div>
    );
};

export default SearchBar;
