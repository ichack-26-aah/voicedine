'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Search, Loader2, AlertCircle, X, Mic, MicOff } from 'lucide-react';
import { useVoiceRecorder } from '@/lib/useVoiceRecorder';

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
    const [query, setQuery] = useState('');
    const [validationError, setValidationError] = useState<string | null>(null);
    const hasAutoStarted = useRef(false);

    // Voice recording hook
    const handleTranscript = useCallback((text: string) => {
        setQuery(text);
    }, []);

    const {
        isRecording,
        isConnecting,
        error: voiceError,
        startRecording,
        stopRecording,
        clearTranscript,
        clearError: clearVoiceError,
    } = useVoiceRecorder(handleTranscript);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Clear previous errors
        setValidationError(null);
        onClearError();

        // Validate input
        const trimmedQuery = query.trim();
        if (!trimmedQuery) {
            setValidationError('Please enter a search query');
            return;
        }

        await onSearch(trimmedQuery);
    };

    // New mic click behavior: stop → submit → clear → restart
    const handleMicClick = useCallback(async () => {
        if (isRecording) {
            // Stop recording first
            stopRecording();

            // Get current query before clearing
            const currentQuery = query.trim();

            // If there's a query, submit it
            if (currentQuery) {
                setValidationError(null);
                onClearError();

                // Submit the search
                await onSearch(currentQuery);

                // Clear the text box for next query
                setQuery('');
                clearTranscript();
            }

            // Restart recording after a brief delay
            setTimeout(async () => {
                await startRecording();
            }, 300);
        } else {
            // If not recording (edge case), just start
            clearTranscript();
            await startRecording();
        }
    }, [isRecording, stopRecording, query, onSearch, onClearError, startRecording, clearTranscript]);

    const displayError = validationError || error || voiceError;

    const handleClearError = () => {
        setValidationError(null);
        onClearError();
        clearVoiceError();
    };

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

            {/* Recording indicator */}
            {(isRecording || isConnecting) && (
                <div className="mb-3 text-center">
                    <span className="inline-flex items-center gap-2 bg-red-500/20 backdrop-blur-md text-red-300 text-sm font-medium px-4 py-2 rounded-full border border-red-500/30 animate-pulse">
                        <span className="w-2 h-2 bg-red-500 rounded-full" />
                        {isConnecting ? 'Connecting...' : 'Listening... Click mic to search'}
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

            {/* Search bar */}
            <form onSubmit={handleSubmit} className="relative">
                <div className="flex items-center gap-2 bg-gray-900/90 backdrop-blur-xl rounded-full shadow-2xl border border-gray-700/50 p-2 transition-all duration-300 focus-within:border-indigo-500/50 focus-within:shadow-indigo-500/10">
                    <div className="flex-1 flex items-center gap-3 pl-4">
                        <Search className="text-gray-400 flex-shrink-0" size={20} />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={isRecording ? "Speak your search..." : "e.g., Italian restaurants with gluten-free options"}
                            className="w-full bg-transparent text-white placeholder-gray-500 text-base outline-none"
                            disabled={isLoading}
                            readOnly={isRecording}
                        />
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

                    {/* Search button - for manual text search */}
                    <button
                        type="submit"
                        disabled={isLoading || isRecording}
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
                {isRecording
                    ? 'Speak your search query, then click the mic button to search'
                    : 'Voice recording will auto-start • Click mic to search'}
            </p>
        </div>
    );
};

export default SearchBar;
