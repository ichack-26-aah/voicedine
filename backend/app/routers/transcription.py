"""
WebSocket endpoint for real-time speech transcription using ElevenLabs Scribe.
"""
import asyncio
import io
import json
import os
import wave
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from elevenlabs.client import ElevenLabs

router = APIRouter(prefix="/ws", tags=["transcription"])


def get_elevenlabs_client() -> Optional[ElevenLabs]:
    """Get ElevenLabs client with API key from environment."""
    api_key = os.getenv("ELEVENLABS_API_KEY", "")
    if not api_key:
        print("ERROR: ELEVENLABS_API_KEY is not set")
        return None
    return ElevenLabs(api_key=api_key)


def create_wav_from_pcm(pcm_data: bytes, sample_rate: int = 16000, channels: int = 1, sample_width: int = 2) -> bytes:
    """Wrap raw PCM data in a WAV container."""
    wav_buffer = io.BytesIO()
    with wave.open(wav_buffer, 'wb') as wav_file:
        wav_file.setnchannels(channels)
        wav_file.setsampwidth(sample_width)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_data)
    wav_buffer.seek(0)
    return wav_buffer.read()


def extract_speaker_segments(result: Any) -> List[Dict]:
    """Extract speaker segments from ElevenLabs transcription result."""
    segments = []
    
    # Try to access words with speaker info
    if hasattr(result, 'words') and result.words:
        current_speaker = None
        current_text = []
        
        for word in result.words:
            word_text = getattr(word, 'text', '') or getattr(word, 'word', '') or str(word)
            speaker_id = getattr(word, 'speaker_id', None) or getattr(word, 'speaker', 0)
            
            # Convert speaker_id to int if it's a string like "speaker_0"
            if isinstance(speaker_id, str):
                try:
                    speaker_id = int(speaker_id.replace('speaker_', ''))
                except:
                    speaker_id = 0
            
            if speaker_id != current_speaker and current_text:
                # New speaker, save current segment
                segments.append({
                    "text": ' '.join(current_text),
                    "speaker_id": current_speaker or 0,
                })
                current_text = []
            
            current_speaker = speaker_id
            current_text.append(word_text)
        
        # Don't forget the last segment
        if current_text:
            segments.append({
                "text": ' '.join(current_text),
                "speaker_id": current_speaker or 0,
            })
    
    # If no word-level data, use the full text
    if not segments and hasattr(result, 'text') and result.text:
        segments.append({
            "text": result.text,
            "speaker_id": 0,
        })
    
    return segments

def print_segments(segments: List[Dict]):
    """Print extracted segments to terminal with simple formatting."""
    for segment in segments:
        speaker = segment["speaker_id"]
        text = segment["text"].strip()
        if text:
            # Simple color coding for terminal
            # Speaker 0: Green, Speaker 1: Blue, Speaker 2: Yellow, Others: White
            colors = {0: "\033[92m", 1: "\033[94m", 2: "\033[93m"}
            color = colors.get(speaker, "\033[0m")
            reset = "\033[0m"
            print(f"{color}[Speaker {speaker}]: {text}{reset}")


@router.websocket("/transcribe")
async def websocket_transcribe(websocket: WebSocket):
    """
    WebSocket endpoint that receives audio from client and returns transcriptions.
    Uses ElevenLabs Scribe for speech-to-text with speaker diarization.
    """
    await websocket.accept()
    print("Client WebSocket connection accepted")

    # Buffer to accumulate audio chunks for batch processing
    # 5 seconds of audio gives ElevenLabs more context for speaker diarization
    audio_buffer = bytearray()
    CHUNK_SIZE = 16000 * 2 * 5  # 5 seconds of 16kHz 16-bit audio
    sample_rate = 16000

    try:
        # Wait for initial config message from client
        first_message = await websocket.receive()
        
        if "text" in first_message:
            try:
                config = json.loads(first_message["text"])
                if config.get("type") == "config":
                    sample_rate = config.get("sample_rate", 16000)
                    print(f"Received config: sample_rate={sample_rate}")
            except json.JSONDecodeError:
                pass

        client = get_elevenlabs_client()
        if client is None:
            await websocket.send_json({
                "type": "error",
                "message": "Failed to initialize ElevenLabs client. Check API key."
            })
            await websocket.close()
            return

        print("ElevenLabs client initialized successfully")

        async def transcribe_audio(audio_data: bytes) -> List[Dict]:
            """Transcribe audio data using ElevenLabs SDK with speaker diarization."""
            try:
                # Wrap PCM in WAV format
                wav_data = create_wav_from_pcm(audio_data, sample_rate=sample_rate)
                
                # Create file tuple for the SDK
                file_tuple = ("audio.wav", wav_data, "audio/wav")
                
                # Use sync transcribe in thread to avoid blocking
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(
                    None,
                    lambda: client.speech_to_text.convert(
                        file=file_tuple,
                        model_id="scribe_v2",
                        language_code="en",
                        diarize=True,
                        timestamps_granularity="word",
                    )
                )
                
                # Extract speaker segments
                return extract_speaker_segments(result)
                
            except Exception as e:
                print(f"Transcription error: {type(e).__name__}: {e}")
                return []

        # Process audio in chunks
        while True:
            message = await websocket.receive()

            if "bytes" in message:
                # Accumulate audio data
                audio_buffer.extend(message["bytes"])
                
                # When we have enough audio, transcribe it
                if len(audio_buffer) >= CHUNK_SIZE:
                    audio_data = bytes(audio_buffer)
                    audio_buffer.clear()
                    
                    segments = await transcribe_audio(audio_data)
                    if segments:
                        print_segments(segments)
                        for segment in segments:
                            transcript_data = {
                                "type": "transcript",
                                "text": segment["text"],
                                "speaker_id": segment["speaker_id"],
                                "is_final": True,
                            }
                            await websocket.send_json(transcript_data)
            
            elif "text" in message:
                try:
                    cmd = json.loads(message["text"])
                    if cmd.get("type") == "commit":
                        # Process remaining audio in buffer
                        if len(audio_buffer) > 1000:  # Only transcribe if there's meaningful audio
                            audio_data = bytes(audio_buffer)
                            audio_buffer.clear()
                            
                            segments = await transcribe_audio(audio_data)
                            
                            if segments:
                                print_segments(segments)
                                for segment in segments:
                                    await websocket.send_json({
                                        "type": "transcript",
                                        "text": segment["text"],
                                        "speaker_id": segment["speaker_id"],
                                        "is_final": True,
                                    })
                except json.JSONDecodeError:
                    pass

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"WebSocket error: {type(e).__name__}: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
        except Exception:
            pass
