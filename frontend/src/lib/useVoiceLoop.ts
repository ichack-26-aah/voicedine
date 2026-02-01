'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { apiClient } from './api';
import type { RestaurantResult } from './types';

const INITIAL_DELAY_MS = 10000; // 10 second initial buffer
const CYCLE_DELAY_MS = 10000; // 10 seconds between cycles

interface GrokResponse {
    requirements: string[];
    success: boolean;
    error?: string;
}

interface RequirementWithSpeaker {
    requirement: string;
    speaker?: string;
    timestamp: number;
}

interface UseVoiceLoopOptions {
    /** Function to get delta transcript (new text since last call) */
    getDeltaTranscript?: () => string;
    /** Function to get full transcript */
    getFullTranscript?: () => string;
    /** User location for Exa search context */
    userLocation?: { lat: number; lng: number };
    /** Called when new requirements are extracted */
    onRequirementsExtracted?: (requirements: RequirementWithSpeaker[]) => void;
    /** Called when Exa results are found */
    onExaResults?: (restaurants: RestaurantResult[]) => void;
    /** Called on errors */
    onError?: (error: string) => void;
    /** Initial delay before first processing cycle (ms) */
    initialDelayMs?: number;
    /** Delay between processing cycles (ms) */
    cycleIntervalMs?: number;
}

interface UseVoiceLoopReturn {
    /** Whether the voice loop is currently active */
    isLoopActive: boolean;
    /** Whether currently processing with Grok */
    isProcessing: boolean;
    /** Start the continuous voice processing loop */
    startLoop: () => void;
    /** Stop the loop */
    stopLoop: () => void;
    /** Get all accumulated requirements */
    requirements: RequirementWithSpeaker[];
    /** Last error message */
    lastError: string | null;
    /** Current cycle count */
    cycleCount: number;
}

export function useVoiceLoop(options: UseVoiceLoopOptions = {}): UseVoiceLoopReturn {
    const { 
        getDeltaTranscript, 
        getFullTranscript,
        userLocation,
        onRequirementsExtracted, 
        onExaResults,
        onError,
        initialDelayMs = INITIAL_DELAY_MS,
        cycleIntervalMs = CYCLE_DELAY_MS,
    } = options;

    const [isLoopActive, setIsLoopActive] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [cycleCount, setCycleCount] = useState(0);
    const [requirements, setRequirements] = useState<RequirementWithSpeaker[]>([]);
    const [lastError, setLastError] = useState<string | null>(null);

    // Loop control refs
    const isLoopActiveRef = useRef(false);
    const loopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const initialDelayPassedRef = useRef(false);

    // Update processing state and notify
    const setProcessingState = useCallback((processing: boolean) => {
        setIsProcessing(processing);
    }, []);

    // Process the delta transcript with Grok
    const processWithGrok = useCallback(async (delta: string): Promise<RequirementWithSpeaker[]> => {
        if (!delta || !delta.trim()) {
            return [];
        }

        try {
            const existingReqs = requirements.map(r => r.requirement);
            const response = await apiClient.post<GrokResponse>('/api/grok/extract', {
                transcript: delta,
                existing_requirements: existingReqs.length > 0 ? existingReqs : undefined,
            });

            if (response.success && response.requirements.length > 0) {
                // Parse requirements with speaker info
                const parsed: RequirementWithSpeaker[] = response.requirements.map(req => {
                    const match = req.match(/^(.+?)\s*\[(.+?)\]$/);
                    return {
                        requirement: match ? match[1].trim() : req,
                        speaker: match ? match[2].trim() : undefined,
                        timestamp: Date.now(),
                    };
                });
                return parsed;
            }

            if (!response.success && response.error) {
                setLastError(response.error);
                onError?.(response.error);
            }

            return [];
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to process with Grok';
            setLastError(errorMsg);
            onError?.(errorMsg);
            return [];
        }
    }, [requirements, onError]);

    // Trigger Exa search with accumulated requirements
    const triggerExaSearch = useCallback(async (reqs: RequirementWithSpeaker[]) => {
        if (reqs.length === 0) return;

        try {
            // We're already in a processing state from runCycle, but ensure it's set
            setProcessingState(true);
            const searchQuery = reqs
                .map(r => r.requirement)
                .join(', ');

            if (!searchQuery.trim()) return;

            const results = await apiClient.post<RestaurantResult[]>(
                '/api/exa/research/sync',
                { prompt: searchQuery }
            );

            if (results && results.length > 0) {
                onExaResults?.(results);
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Exa search failed';
            setLastError(errorMsg);
            onError?.(errorMsg);
        } finally {
            // Processing state is managed by runCycle mostly, but safety check
            // setProcessingState(false);
            // Commented out to avoid flickering in runCycle
        }
    }, [onExaResults, onError, setProcessingState]);

    // Single processing cycle
    const runCycle = useCallback(async () => {
        if (!isLoopActiveRef.current) return;

        setProcessingState(true);
        setCycleCount(prev => prev + 1);

        try {
            // Get delta transcript from the voice recorder
            const delta = getDeltaTranscript?.();
            
            if (delta && delta.trim()) {
                console.log('[VoiceLoop] Processing delta:', delta.substring(0, 50));
                
                // Process with Grok
                const newRequirements = await processWithGrok(delta);

                if (newRequirements.length > 0) {
                    console.log('[VoiceLoop] New requirements found, triggering update and search');
                    // Append to master list
                    setRequirements(prev => {
                        const updated = [
                            ...prev, 
                            ...newRequirements
                        ];
                        
                        // Notify about new requirements
                        onRequirementsExtracted?.(updated);

                        // Trigger Exa search ONLY if we found new requirements
                        // We do this inside the setState callback to ensure we use the updated list
                        // However, setState is not async in that way. We can use 'updated' directly here.
                        // But wait, triggerExaSearch is async. It's safer to call it with the 'updated' list we just computed.
                        
                        // Important: logic modification requested by user:
                        // "if nothing was added to the list i.e list size didn't increase then DONT call exa ai"
                        // Since newRequirements.length > 0 check is already here, we are good.
                        // We are actively inside the block that runs ONLY if new requirements exist.
                        
                        triggerExaSearch(updated);
                        
                        return updated;
                    });
                } else {
                    console.log('[VoiceLoop] No new requirements extracted from delta. Skipping Exa search.');
                }
            } else {
                console.log('[VoiceLoop] No new audio delta. Skipping processing.');
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Processing cycle failed';
            setLastError(errorMsg);
            onError?.(errorMsg);
        } finally {
            setProcessingState(false);
        }

        // Schedule next cycle if loop is still active
        if (isLoopActiveRef.current) {
            loopTimeoutRef.current = setTimeout(runCycle, cycleIntervalMs);
        }
    }, [getDeltaTranscript, processWithGrok, triggerExaSearch, onRequirementsExtracted, onError, cycleIntervalMs, setProcessingState]);

    // Start the loop
    const startLoop = useCallback(() => {
        if (isLoopActiveRef.current) return;

        isLoopActiveRef.current = true;
        setIsLoopActive(true);
        initialDelayPassedRef.current = false;
        setCycleCount(0);
        setRequirements([]);
        setLastError(null);

        console.log(`[VoiceLoop] Starting with ${initialDelayMs}ms initial delay...`);

        // Wait for initial delay before first cycle
        loopTimeoutRef.current = setTimeout(() => {
            initialDelayPassedRef.current = true;
            console.log('[VoiceLoop] Initial delay passed, starting processing cycles');
            runCycle();
        }, initialDelayMs);
    }, [initialDelayMs, runCycle]);

    // Stop the loop
    const stopLoop = useCallback(() => {
        isLoopActiveRef.current = false;
        setIsLoopActive(false);
        
        if (loopTimeoutRef.current) {
            clearTimeout(loopTimeoutRef.current);
            loopTimeoutRef.current = null;
        }

        console.log('[VoiceLoop] Stopped');
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (loopTimeoutRef.current) {
                clearTimeout(loopTimeoutRef.current);
            }
        };
    }, []);

    return {
        isLoopActive,
        isProcessing,
        startLoop,
        stopLoop,
        requirements,
        lastError,
        cycleCount,
    };
}
