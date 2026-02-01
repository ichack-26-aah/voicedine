'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { TranscriptSegment } from './types';

interface UseLiveScribeOptions {
    onTranscript?: (segment: TranscriptSegment) => void;
    onError?: (error: string) => void;
    onVolumeChange?: (volume: number) => void;
    onRecordingStop?: () => void;
}

interface UseLiveScribeReturn {
    isRecording: boolean;
    isConnecting: boolean;
    error: string | null;
    transcript: TranscriptSegment[];
    startRecording: () => Promise<void>;
    stopRecording: () => void;
    clearTranscript: () => void;
}

export function useLiveScribe(options: UseLiveScribeOptions = {}): UseLiveScribeReturn {
    const { onTranscript, onError, onVolumeChange, onRecordingStop } = options;

    const [isRecording, setIsRecording] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);

    const wsRef = useRef<WebSocket | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    // Volume monitoring
    const monitorVolume = useCallback(() => {
        if (!analyserRef.current || !onVolumeChange) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average volume (0-255 range)
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const normalizedVolume = average / 255; // 0-1 range

        onVolumeChange(normalizedVolume);

        animationFrameRef.current = requestAnimationFrame(monitorVolume);
    }, [onVolumeChange]);

    // Convert Float32 to Int16 PCM
    const floatTo16BitPCM = (float32Array: Float32Array): ArrayBuffer => {
        const buffer = new ArrayBuffer(float32Array.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < float32Array.length; i++) {
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        }
        return buffer;
    };

    // Downsample audio to 16kHz
    const downsampleBuffer = (buffer: Float32Array, inputSampleRate: number, outputSampleRate: number): Float32Array => {
        if (inputSampleRate === outputSampleRate) {
            return buffer;
        }
        const sampleRateRatio = inputSampleRate / outputSampleRate;
        const newLength = Math.round(buffer.length / sampleRateRatio);
        const result = new Float32Array(newLength);
        let offsetResult = 0;
        let offsetBuffer = 0;
        while (offsetResult < result.length) {
            const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
            let accum = 0;
            let count = 0;
            for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
                accum += buffer[i];
                count++;
            }
            result[offsetResult] = accum / count;
            offsetResult++;
            offsetBuffer = nextOffsetBuffer;
        }
        return result;
    };

    const startRecording = useCallback(async () => {
        try {
            setIsConnecting(true);
            setError(null);

            // Get microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                },
            });
            mediaStreamRef.current = stream;

            // Set up Web Audio API
            const audioContext = new AudioContext({ sampleRate: 16000 });
            audioContextRef.current = audioContext;

            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            analyserRef.current = analyser;

            // Script processor for getting raw audio data
            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            source.connect(analyser);
            analyser.connect(processor);
            processor.connect(audioContext.destination);

            // Connect to backend WebSocket
            const wsUrl = `${process.env.NEXT_PUBLIC_API_URL?.replace('http', 'ws') || 'ws://localhost:8000'}/ws/transcribe`;
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                setIsConnecting(false);
                setIsRecording(true);

                // Start volume monitoring
                if (onVolumeChange) {
                    monitorVolume();
                }

                // Send audio configuration
                ws.send(JSON.stringify({
                    type: 'config',
                    sample_rate: audioContext.sampleRate,
                    encoding: 'pcm_s16le',
                }));
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === 'transcript') {
                        const segment: TranscriptSegment = {
                            id: crypto.randomUUID(),
                            text: data.text || '',
                            speaker_id: data.speaker_id ?? 0,
                            is_final: data.is_final ?? false,
                            timestamp: Date.now(),
                        };

                        setTranscript((prev) => {
                            // If not final, update the last non-final segment from same speaker
                            if (!segment.is_final) {
                                const lastIdx = prev.findIndex(
                                    (s) => !s.is_final && s.speaker_id === segment.speaker_id
                                );
                                if (lastIdx >= 0) {
                                    const updated = [...prev];
                                    updated[lastIdx] = segment;
                                    return updated;
                                }
                            }
                            return [...prev, segment];
                        });

                        onTranscript?.(segment);
                    } else if (data.type === 'error') {
                        setError(data.message);
                        onError?.(data.message);
                    }
                } catch (e) {
                    console.error('Failed to parse WebSocket message:', e);
                }
            };

            ws.onerror = () => {
                const errorMsg = 'WebSocket connection error';
                setError(errorMsg);
                onError?.(errorMsg);
            };

            ws.onclose = () => {
                setIsRecording(false);
                setIsConnecting(false);
            };

            // Process audio and send to WebSocket
            processor.onaudioprocess = (e) => {
                if (ws.readyState === WebSocket.OPEN) {
                    const inputData = e.inputBuffer.getChannelData(0);
                    const downsampled = downsampleBuffer(inputData, audioContext.sampleRate, 16000);
                    const pcmData = floatTo16BitPCM(downsampled);
                    ws.send(pcmData);
                }
            };
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to start recording';
            setError(errorMsg);
            onError?.(errorMsg);
            setIsConnecting(false);
        }
    }, [onTranscript, onError, onVolumeChange, monitorVolume]);

    const stopRecording = useCallback(() => {
        // Stop animation frame
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        // Close WebSocket
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        // Stop processor
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }

        // Close audio context
        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        // Stop media stream
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
        }

        setIsRecording(false);
        setIsConnecting(false);

        // Call callback when recording stops
        onRecordingStop?.();
    }, [onRecordingStop]);

    const clearTranscript = useCallback(() => {
        setTranscript([]);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopRecording();
        };
    }, [stopRecording]);

    return {
        isRecording,
        isConnecting,
        error,
        transcript,
        startRecording,
        stopRecording,
        clearTranscript,
    };
}
