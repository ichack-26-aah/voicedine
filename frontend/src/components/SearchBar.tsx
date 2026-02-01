'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Search, Loader2, AlertCircle, X, Mic, MicOff, Zap } from 'lucide-react';
import { useVoiceRecorder } from '@/lib/useVoiceRecorder';
import { useVoiceLoop } from '@/lib/useVoiceLoop';
import TranscriptBubbles from './TranscriptBubbles';
import type { RestaurantResult } from '@/lib/types';

interface SearchBarProps {
    onSearch: (query: string) => Promise<void>;
    /** Direct callback for when voice loop gets restaurant results - bypasses onSearch */
    onRestaurantsFound?: (restaurants: RestaurantResult[]) => void;
    /** Callback for when new requirements are extracted */
    onRequirementsUpdate?: (requirements: string[]) => void;
    isLoading: boolean;
    error: string | null;
    resultCount: number | null;
    onClearError: () => void;
    autoStartRecording?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
    onSearch,
    onRestaurantsFound,
    onRequirementsUpdate,
    isLoading,
    error,
    resultCount,
    onClearError,
    autoStartRecording = false,
}) => {
    const [query, setQuery] = useState('');
    const [validationError, setValidationError] = useState<string | null>(null);
    const [autoStartAttempts, setAutoStartAttempts] = useState(0);
    // Note: requirements are managed in useVoiceLoop, we just get them via callback

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
        getDeltaTranscript,
        getFullTranscript,
    } = useVoiceRecorder();

    // Voice loop for continuous processing
    const {
        isLoopActive,
        isProcessing,
        startLoop,
        stopLoop,
        requirements: extractedRequirements,
        lastError: loopError,
        cycleCount,
    } = useVoiceLoop({
        getDeltaTranscript,
        getFullTranscript,
        onRequirementsExtracted: (allReqs) => {
            console.log('[SearchBar] All requirements:', allReqs);
            // Update parent component with requirement texts
            const reqTexts = allReqs.map(r =>
                r.speaker ? `${r.requirement} [${r.speaker}]` : r.requirement
            );
            if (onRequirementsUpdate) {
                // Defer update to avoid render phase state update warning
                Promise.resolve().then(() => onRequirementsUpdate(reqTexts));
            }
        },
        onExaResults: (restaurants) => {
            console.log('[SearchBar] Exa results received:', restaurants.length);
            // Directly update parent's restaurant state via callback
            if (onRestaurantsFound) {
                onRestaurantsFound(restaurants);
            }
        },
        onError: (err) => {
            console.error('[VoiceLoop] Error:', err);
        },
        initialDelayMs: 10000,
        cycleIntervalMs: 10000, // 10 seconds between cycles
    });

    // Auto-start recording when component mounts (if enabled)
    useEffect(() => {
        const MAX_ATTEMPTS = 3;
        
        if (autoStartRecording && !isRecording && !isConnecting && autoStartAttempts < MAX_ATTEMPTS) {
            // Progressive delay: 500ms, 1500ms, 2500ms
            const delay = 500 + (autoStartAttempts * 1000);
            
            const timer = setTimeout(() => {
                console.log(`[SearchBar] Auto-start attempt ${autoStartAttempts + 1}/${MAX_ATTEMPTS}`);
                startRecording().catch(err => {
                    console.error("[SearchBar] Auto-start attempt failed:", err);
                });
                setAutoStartAttempts(prev => prev + 1);
            }, delay);
            return () => clearTimeout(timer);
        }
    }, [autoStartRecording, isRecording, isConnecting, startRecording, autoStartAttempts]);

    // Start voice loop once recording is active
    useEffect(() => {
        if (autoStartRecording && isRecording && !isLoopActive) {
            console.log('[SearchBar] Recording active, starting voice loop...');
            startLoop();
        }
    }, [autoStartRecording, isRecording, isLoopActive, startLoop]);

    // Handle text form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const trimmedQuery = query.trim();
        if (!trimmedQuery) {
            setValidationError('Please enter a search query');
            return;
        }

        setValidationError(null);
        onClearError();
        await onSearch(trimmedQuery);
        setQuery(''); // Clear after search
    };

    // Mic click: stop → submit merged transcript → clear transcripts only (keep requirements) → restart
    const handleMicClick = useCallback(async () => {
        if (isRecording) {
            stopRecording();
            stopLoop();
            const mergedQuery = getMergedTranscript().trim();

            if (mergedQuery) {
                setValidationError(null);
                onClearError();
                await onSearch(mergedQuery);
            }

            // Only clear transcripts, NOT requirements - useVoiceLoop keeps the master list
            clearTranscripts();
            setTimeout(async () => {
                await startRecording();
                startLoop();
            }, 300);
        } else {
            clearTranscripts();
            await startRecording();
            startLoop();
        }
    }, [isRecording, stopRecording, stopLoop, getMergedTranscript, onSearch, onClearError, startRecording, startLoop, clearTranscripts]);

    const displayError = validationError || error || voiceError || loopError;

    const handleClearError = () => {
        setValidationError(null);
        onClearError();
        clearVoiceError();
    };

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

            {/* Voice Loop Status - Only show when processing */}
            {/* {isLoopActive && isProcessing && (
                <div className="mb-3 text-center">
                    <span className="inline-flex items-center gap-2 bg-indigo-500/20 backdrop-blur-md text-indigo-300 text-xs font-medium px-3 py-1.5 rounded-full border border-indigo-500/30">
                        <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
                        Processing with Grok...
                    </span>
                </div>
            )} */

            {/* Recording indicator */}
            {(isRecording || isConnecting) && !hasTranscripts && !isLoopActive && (
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

            {/* Search bar with text input */}
            <form onSubmit={handleSubmit} className="relative">
                <div className="flex items-center gap-2 bg-gray-900/90 backdrop-blur-xl rounded-full shadow-2xl border border-gray-700/50 p-2 transition-all duration-300 focus-within:border-indigo-500/50 focus-within:shadow-indigo-500/10">
                    <div className="flex-1 flex items-center gap-3 pl-4">
                        <Search className="text-gray-400 flex-shrink-0" size={20} />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={isRecording ? "Or type your search..." : "Search restaurants..."}
                            className="w-full bg-transparent text-white placeholder-gray-500 text-base outline-none"
                            disabled={isLoading}
                        />
                    </div>

                    {/* Microphone button */}
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

                    {/* Search button */}
                    <button
                        type="submit"
                        disabled={isLoading || !query.trim()}
                        className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-full transition-all duration-200 shadow-lg hover:shadow-indigo-500/25"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                <span>Searching...</span>
                            </>
                        ) : (
                            <>
                                <Search size={18} />
                                <span>Search</span>
                            </>
                        )}
                    </button>
                </div>
            </form>

            {/* Hint text */}
            <p className="mt-3 text-center text-gray-500 text-xs">
                {isLoopActive 
                    ? 'Continuous voice mode active • Requirements auto-extracted every cycle'
                    : 'Type or speak your search • Voice recording auto-starts • Multiple speakers supported'
                }
            </p>
        </div>
    );
};

export default SearchBar;

