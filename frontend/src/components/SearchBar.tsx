'use client';

import React, { useState } from 'react';
import { Search, Loader2, AlertCircle, X } from 'lucide-react';

interface SearchBarProps {
    onSearch: (query: string) => Promise<void>;
    isLoading: boolean;
    error: string | null;
    resultCount: number | null;
    onClearError: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
    onSearch,
    isLoading,
    error,
    resultCount,
    onClearError,
}) => {
    const [query, setQuery] = useState('');
    const [validationError, setValidationError] = useState<string | null>(null);

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

    const displayError = validationError || error;

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

            {/* Error message */}
            {displayError && (
                <div className="mb-3 flex justify-center">
                    <div className="inline-flex items-center gap-2 bg-red-500/20 backdrop-blur-md text-red-300 text-sm font-medium px-4 py-2 rounded-full border border-red-500/30">
                        <AlertCircle size={16} />
                        {displayError}
                        <button
                            onClick={() => {
                                setValidationError(null);
                                onClearError();
                            }}
                            className="ml-1 hover:text-red-100 transition-colors"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* Search bar */}
            <form onSubmit={handleSubmit} className="relative">
                <div className="flex items-center gap-3 bg-gray-900/90 backdrop-blur-xl rounded-full shadow-2xl border border-gray-700/50 p-2 transition-all duration-300 focus-within:border-indigo-500/50 focus-within:shadow-indigo-500/10">
                    <div className="flex-1 flex items-center gap-3 pl-4">
                        <Search className="text-gray-400 flex-shrink-0" size={20} />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="e.g., Italian restaurants with gluten-free options"
                            className="w-full bg-transparent text-white placeholder-gray-500 text-base outline-none"
                            disabled={isLoading}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
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
                Search for restaurants by cuisine, dietary needs, or preferences
            </p>
        </div>
    );
};

export default SearchBar;
