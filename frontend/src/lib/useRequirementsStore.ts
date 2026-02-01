'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface RequirementItem {
    id: string;
    text: string;
    speaker: string;
    timestamp: number;
}

interface RequirementsState {
    requirements: RequirementItem[];
    addRequirements: (newRequirements: string[]) => void;
    clearRequirements: () => void;
    getAllRequirements: () => string[];
    getRequirementsList: () => RequirementItem[];
}

const RequirementsContext = createContext<RequirementsState | null>(null);

/**
 * Parse a requirement string like "Italian food [User 0]" into text and speaker
 */
function parseRequirement(req: string): { text: string; speaker: string } {
    const match = req.match(/^(.+?)\s*\[(.+?)\]$/);
    if (match) {
        return { text: match[1].trim(), speaker: match[2].trim() };
    }
    return { text: req, speaker: 'Unknown' };
}

export function RequirementsProvider({ children }: { children: ReactNode }) {
    const [requirements, setRequirements] = useState<RequirementItem[]>([]);

    const addRequirements = useCallback((newRequirements: string[]) => {
        if (!newRequirements || newRequirements.length === 0) return;

        const now = Date.now();
        const newItems: RequirementItem[] = newRequirements.map((req, index) => {
            const { text, speaker } = parseRequirement(req);
            return {
                id: `${now}-${index}-${Math.random().toString(36).substr(2, 9)}`,
                text,
                speaker,
                timestamp: now,
            };
        });

        setRequirements(prev => [...prev, ...newItems]);
    }, []);

    const clearRequirements = useCallback(() => {
        setRequirements([]);
    }, []);

    const getAllRequirements = useCallback((): string[] => {
        // Return just the text portion for search queries
        return requirements.map(r => r.text);
    }, [requirements]);

    const getRequirementsList = useCallback((): RequirementItem[] => {
        return requirements;
    }, [requirements]);

    const value: RequirementsState = {
        requirements,
        addRequirements,
        clearRequirements,
        getAllRequirements,
        getRequirementsList,
    };

    return React.createElement(
        RequirementsContext.Provider,
        { value },
        children
    );
}

export function useRequirements(): RequirementsState {
    const context = useContext(RequirementsContext);
    if (!context) {
        throw new Error('useRequirements must be used within a RequirementsProvider');
    }
    return context;
}
