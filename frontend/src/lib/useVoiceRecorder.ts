'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
const SAMPLE_RATE = 16000;

export interface SpeakerTranscript {
    speakerId: number;
    text: string;
}

interface UseVoiceRecorderReturn {
    isRecording: boolean;
    isConnecting: boolean;
    speakerTranscripts: Map<number, string>;
    error: string | null;
    startRecording: () => Promise<void>;
    stopRecording: () => void;
    clearTranscripts: () => void;
    getMergedTranscript: () => string;
    clearError: () => void;
}

export function useVoiceRecorder(
    onTranscriptUpdate?: (transcripts: Map<number, string>) => void
): UseVoiceRecorderReturn {
    const [isRecording, setIsRecording] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [speakerTranscripts, setSpeakerTranscripts] = useState<Map<number, string>>(new Map());
    const [error, setError] = useState<string | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);

    // Cleanup function
    const cleanup = useCallback(() => {
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            // Send commit message before closing
            try {
                wsRef.current.send(JSON.stringify({ type: 'commit' }));
            } catch (e) {
                // Ignore errors when sending commit
            }
            wsRef.current.close();
        }
        wsRef.current = null;
        setIsRecording(false);
        setIsConnecting(false);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return cleanup;
    }, [cleanup]);

    const startRecording = useCallback(async () => {
        setError(null);
        setIsConnecting(true);

        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: SAMPLE_RATE,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                }
            });
            mediaStreamRef.current = stream;

            // Connect to WebSocket
            const ws = new WebSocket(`${WS_URL}/ws/transcribe`);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('WebSocket connected');
                // Send config
                ws.send(JSON.stringify({
                    type: 'config',
                    sample_rate: SAMPLE_RATE,
                }));

                // Set up audio processing
                const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
                audioContextRef.current = audioContext;

                const source = audioContext.createMediaStreamSource(stream);
                const processor = audioContext.createScriptProcessor(4096, 1, 1);
                processorRef.current = processor;

                processor.onaudioprocess = (e) => {
                    if (ws.readyState !== WebSocket.OPEN) return;

                    const inputData = e.inputBuffer.getChannelData(0);
                    // Convert Float32 to Int16 PCM
                    const pcmData = new Int16Array(inputData.length);
                    for (let i = 0; i < inputData.length; i++) {
                        const s = Math.max(-1, Math.min(1, inputData[i]));
                        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                    }
                    ws.send(pcmData.buffer);
                };

                source.connect(processor);
                processor.connect(audioContext.destination);

                setIsConnecting(false);
                setIsRecording(true);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'transcript' && data.text) {
                        const newText = data.text.trim();
                        const speakerId = data.speaker_id ?? 0;

                        if (newText) {
                            setSpeakerTranscripts(prev => {
                                const updated = new Map(prev);
                                const existing = updated.get(speakerId) || '';
                                updated.set(speakerId, existing ? `${existing} ${newText}` : newText);

                                if (onTranscriptUpdate) {
                                    onTranscriptUpdate(updated);
                                }
                                return updated;
                            });
                        }
                    } else if (data.type === 'error') {
                        setError(data.message || 'Transcription error');
                    }
                } catch (e) {
                    console.error('Failed to parse WebSocket message:', e);
                }
            };

            ws.onerror = (event) => {
                console.error('WebSocket error:', event);
                setError('Connection error. Please try again.');
                cleanup();
            };

            ws.onclose = () => {
                console.log('WebSocket closed');
                setIsRecording(false);
                setIsConnecting(false);
            };

        } catch (err) {
            console.error('Failed to start recording:', err);
            if (err instanceof Error) {
                if (err.name === 'NotAllowedError') {
                    setError('Microphone permission denied');
                } else if (err.name === 'NotFoundError') {
                    setError('No microphone found');
                } else {
                    setError(err.message);
                }
            } else {
                setError('Failed to start recording');
            }
            setIsConnecting(false);
            cleanup();
        }
    }, [cleanup, onTranscriptUpdate]);

    const stopRecording = useCallback(() => {
        cleanup();
    }, [cleanup]);

    const clearTranscripts = useCallback(() => {
        setSpeakerTranscripts(new Map());
    }, []);

    const getMergedTranscript = useCallback(() => {
        // Merge all speaker transcripts into one string
        const allTexts: string[] = [];
        speakerTranscripts.forEach((text) => {
            if (text.trim()) {
                allTexts.push(text.trim());
            }
        });
        return allTexts.join(' ');
    }, [speakerTranscripts]);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        isRecording,
        isConnecting,
        speakerTranscripts,
        error,
        startRecording,
        stopRecording,
        clearTranscripts,
        getMergedTranscript,
        clearError,
    };
}
