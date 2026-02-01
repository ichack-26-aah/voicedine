'use client';

import React from 'react';
import { User } from 'lucide-react';

interface TranscriptBubblesProps {
    speakerTranscripts: Map<number, string>;
}

// Color palette for speakers
const SPEAKER_COLORS = [
    { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-300', icon: 'text-blue-400' },
    { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-300', icon: 'text-emerald-400' },
    { bg: 'bg-purple-500/20', border: 'border-purple-500/40', text: 'text-purple-300', icon: 'text-purple-400' },
    { bg: 'bg-amber-500/20', border: 'border-amber-500/40', text: 'text-amber-300', icon: 'text-amber-400' },
    { bg: 'bg-pink-500/20', border: 'border-pink-500/40', text: 'text-pink-300', icon: 'text-pink-400' },
    { bg: 'bg-cyan-500/20', border: 'border-cyan-500/40', text: 'text-cyan-300', icon: 'text-cyan-400' },
];

const getSpeakerColor = (speakerId: number) => {
    return SPEAKER_COLORS[speakerId % SPEAKER_COLORS.length];
};

const TranscriptBubbles: React.FC<TranscriptBubblesProps> = ({ speakerTranscripts }) => {
    // Convert map to sorted array
    const speakers = Array.from(speakerTranscripts.entries())
        .filter(([, text]) => text.trim().length > 0)
        .sort((a, b) => a[0] - b[0]);

    if (speakers.length === 0) {
        return null;
    }

    return (
        <div className="w-full space-y-2 mb-4 animate-fadeIn">
            {speakers.map(([speakerId, text]) => {
                const colors = getSpeakerColor(speakerId);
                return (
                    <div
                        key={speakerId}
                        className={`
                            ${colors.bg} ${colors.border} border
                            backdrop-blur-md rounded-xl p-3
                            transition-all duration-300 animate-slideIn
                        `}
                    >
                        <div className="flex items-start gap-3">
                            <div className={`flex-shrink-0 w-8 h-8 rounded-full ${colors.bg} ${colors.border} border flex items-center justify-center`}>
                                <User size={16} className={colors.icon} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className={`text-xs font-medium ${colors.icon} mb-1`}>
                                    Speaker {speakerId + 1}
                                </div>
                                <p className={`${colors.text} text-sm leading-relaxed break-words`}>
                                    {text}
                                </p>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default TranscriptBubbles;
