# ElevenLabs Scribe V2 Realtime API Implementation Guide for Hackathon

**Last Updated:** February 1, 2026  
**API Model:** `scribe_v2_realtime`  
**Latency:** ~150ms per transcription event  
**Documentation:** https://elevenlabs.io/docs/developers/guides/cookbooks/speech-to-text/realtime/client-side-streaming

---

## 1. Quick Overview

Scribe V2 Realtime is a WebSocket-based streaming speech-to-text API that:
- Delivers **partial (interim) transcripts** in real-time (~150ms latency)
- Delivers **committed (finalized) transcripts** when segments are complete
- Supports **up to 48 speakers** with automatic diarization (speaker labels)
- Handles **90+ languages** with automatic language detection
- Works with **PCM (8–48 kHz)** and **μ-law encoding** audio formats

**Your use case:** Stream continuous multi-speaker audio → receive updates every ~1 second → send to Exa API for data fetching → update frontend.

---

## 2. Authentication

### Generate Single-Use Token (Server-Side)

You **MUST** generate a single-use token on your backend server. Never expose your API key to the client.

**Endpoint:** `POST /v1/tokens/realtime-scribe`

**Node.js/JavaScript Example:**
```javascript
// Backend Server (Node.js/Express)
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

app.get("/scribe-token", async (req, res) => {
  try {
    const token = await elevenlabs.tokens.singleUse.create("realtime_scribe");
    res.json(token); // Returns: { token: "...", expires_in: 900 }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Python Example:**
```python
from elevenlabs import ElevenLabs

client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

@app.route("/scribe-token", methods=["GET"])
def get_scribe_token():
    try:
        token = client.tokens.single_use.create("realtime_scribe")
        return jsonify({"token": token.token, "expires_in": token.expires_in})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
```

**Token Expiry:** 15 minutes (900 seconds)

---

## 3. WebSocket Connection

### Connection URL
```
wss://api.elevenlabs.io/v1/speech-to-text/stream
```

### Query Parameters
- `token`: Single-use token from step 2 (required)
- `model_id`: Always `scribe_v2_realtime` (required)
- `audio_format`: `pcm_s16le` or `ulaw` (optional, default: `pcm_s16le`)
- `sample_rate`: 8000, 16000, 24000, or 48000 Hz (optional, default: 16000)
- `language_code`: ISO 639-1 code (e.g., `en`, `es`, `fr`) or omit for auto-detection

**Full URL Example:**
```
wss://api.elevenlabs.io/v1/speech-to-text/stream?token=YOUR_TOKEN&model_id=scribe_v2_realtime&sample_rate=16000
```

### JavaScript WebSocket Connection
```javascript
// Client-side
const token = await fetch("/scribe-token").then(r => r.json()).token;

const ws = new WebSocket(
  `wss://api.elevenlabs.io/v1/speech-to-text/stream?token=${token}&model_id=scribe_v2_realtime&sample_rate=16000`
);

ws.onopen = () => {
  console.log("Connected to Scribe V2 Realtime");
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  handleScribeMessage(message);
};

ws.onerror = (error) => {
  console.error("WebSocket error:", error);
};

ws.onclose = () => {
  console.log("Disconnected from Scribe V2 Realtime");
};
```

---

## 4. Audio Streaming Format

### Send Audio Chunks to Server

**Format:** Raw binary data (not JSON)

**Chunk Strategy for Your Use Case:**
- Send audio in **0.5–1 second chunks**
- For 1-second frontend updates, send 0.5-second audio chunks (balance between latency & efficiency)
- Audio should be **16-bit PCM** at your chosen sample rate

**JavaScript Example (using Web Audio API):**
```javascript
// Capture audio and send chunks
let audioContext = new AudioContext({ sampleRate: 16000 });
let mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
let mediaStreamAudioSource = audioContext.createMediaStreamAudioSource(mediaStream);

let processor = audioContext.createScriptProcessor(8192, 1, 1);

processor.onaudioprocess = (event) => {
  const audioData = event.inputBuffer.getChannelData(0);
  const pcmData = convertFloat32ToPCM16(audioData);
  
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(pcmData); // Send raw binary
  }
};

mediaStreamAudioSource.connect(processor);
processor.connect(audioContext.destination);

// Helper function
function convertFloat32ToPCM16(float32Array) {
  let pcm16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    pcm16Array[i] = Math.max(-1, Math.min(1, float32Array[i])) * 0x7FFF;
  }
  return pcm16Array.buffer;
}
```

**Python Example (using PyAudio):**
```python
import pyaudio
import struct

SAMPLE_RATE = 16000
CHUNK = 8192  # 0.5 seconds at 16kHz

p = pyaudio.PyAudio()
stream = p.open(
    format=pyaudio.paInt16,
    channels=1,
    rate=SAMPLE_RATE,
    input=True,
    frames_per_buffer=CHUNK
)

try:
    while ws.connected:
        data = stream.read(CHUNK)
        ws.send(data)  # Send raw binary (PCM)
except KeyboardInterrupt:
    stream.stop_stream()
    stream.close()
    p.terminate()
```

---

## 5. Server Events (Messages Received)

The WebSocket server sends JSON messages in this format:

### Event Structure
```json
{
  "event_type": "TranscriptEvent",
  "result": {
    "text": "partial or committed text",
    "is_final": false,
    "speaker_id": "speaker_0",
    "start_time": 0.5,
    "end_time": 1.2,
    "words": [
      {
        "text": "word",
        "start": 0.5,
        "end": 0.7,
        "confidence": 0.99
      }
    ]
  }
}
```

### Event Types

#### 1. **Partial Transcript (is_final: false)**
Interim results as the user speaks. Expect these frequently (~every 150ms).

```json
{
  "event_type": "TranscriptEvent",
  "result": {
    "text": "hello wo",
    "is_final": false,
    "speaker_id": "speaker_0",
    "start_time": 0.0,
    "end_time": 0.5
  }
}
```

**Your handling:** Buffer these, don't send to API yet (optional: update frontend in real-time as "typing").

#### 2. **Committed Transcript (is_final: true)**
Final, locked result for a segment. This is when you should send to your API.

```json
{
  "event_type": "TranscriptEvent",
  "result": {
    "text": "hello world",
    "is_final": true,
    "speaker_id": "speaker_0",
    "start_time": 0.0,
    "end_time": 1.2,
    "words": [
      { "text": "hello", "start": 0.0, "end": 0.4, "confidence": 0.99 },
      { "text": "world", "start": 0.5, "end": 1.2, "confidence": 0.98 }
    ]
  }
}
```

**Your handling:** Send this + previous committed segments to Exa API in your 1-second update cycle.

#### 3. **Other Events**

- **ConnectionEstablished**: Initial handshake
- **ConnectionClosed**: Stream ended
- **Error**: Audio or processing error

```json
{
  "event_type": "ConnectionEstablished",
  "connection_id": "conn_123"
}
```

```json
{
  "event_type": "Error",
  "error": "Invalid audio format or other error"
}
```

---

## 6. Handling Diarization (Multi-Speaker Detection)

### Current Status (Feb 2026)
Speaker diarization with streaming requires **manual commit strategy**. Auto-diarization is "coming soon" but may now be released.

### Speaker Labels
Each transcript event includes a `speaker_id`:
- `speaker_0`, `speaker_1`, `speaker_2`, ... up to `speaker_47`
- Automatically assigned based on voice characteristics

### Implementation Pattern
```javascript
const speakerTranscripts = {}; // Track by speaker

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.event_type === "TranscriptEvent" && message.result.is_final) {
    const { text, speaker_id } = message.result;
    
    if (!speakerTranscripts[speaker_id]) {
      speakerTranscripts[speaker_id] = [];
    }
    speakerTranscripts[speaker_id].push({
      text,
      timestamp: Date.now(),
      words: message.result.words
    });
    
    // Send to Exa API with speaker context
    updateExaAPI(speakerTranscripts);
  }
};
```

---

## 7. Commit Strategy (When to Lock Transcripts)

### Two Strategies

#### Strategy 1: Voice Activity Detection (VAD) - Recommended for Continuous Speech
- **Automatic silence detection**: Server commits transcripts when ~1-2 seconds of silence detected
- **Best for:** Your use case (continuous conversation)
- **Configuration in frontend:** Built-in, no configuration needed

#### Strategy 2: Manual Commit
- **You control commitment** via `Commit` message
- **Best for:** Custom logic (e.g., after user clicks button)

**Manual Commit Message (if needed):**
```json
{
  "type": "Commit"
}
```

For your 1-second polling cycle, **use VAD** (automatic). The model will commit segments naturally during pauses between speakers.

---

## 8. Your 1-Second Update Pattern

Here's the recommended architecture for your hackathon:

### Frontend (Web App)
```javascript
class ScribeController {
  constructor() {
    this.bufferedTranscripts = [];
    this.lastExaApiCall = 0;
    this.apiUpdateInterval = 1000; // 1 second
  }

  async connect() {
    const token = await fetch("/scribe-token").then(r => r.json()).token;
    
    this.ws = new WebSocket(
      `wss://api.elevenlabs.io/v1/speech-to-text/stream?token=${token}&model_id=scribe_v2_realtime&sample_rate=16000`
    );
    
    this.ws.onmessage = (event) => this.handleMessage(event);
    
    // 1-second polling loop
    setInterval(() => this.pollAndUpdateUI(), this.apiUpdateInterval);
  }

  handleMessage(event) {
    const message = JSON.parse(event.data);
    
    if (message.event_type === "TranscriptEvent") {
      const { text, is_final, speaker_id, words } = message.result;
      
      this.bufferedTranscripts.push({
        text,
        is_final,
        speaker_id,
        words,
        timestamp: Date.now()
      });
    }
  }

  async pollAndUpdateUI() {
    if (this.bufferedTranscripts.length === 0) return;
    
    // Get only NEW (finalized) transcripts since last call
    const finalizedOnly = this.bufferedTranscripts.filter(t => t.is_final);
    
    if (finalizedOnly.length === 0) return;
    
    try {
      // Call Exa API with speaker-aware context
      const exaResponse = await fetch("/api/exa-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcripts: finalizedOnly,
          context: "multi-speaker conversation"
        })
      }).then(r => r.json());
      
      // Update frontend with results
      this.updateUI(finalizedOnly, exaResponse);
      
      // Remove sent transcripts
      this.bufferedTranscripts = this.bufferedTranscripts.filter(t => !t.is_final);
      
    } catch (error) {
      console.error("Exa API error:", error);
    }
  }

  updateUI(transcripts, exaData) {
    // Group by speaker
    const bySpeak = {};
    transcripts.forEach(t => {
      if (!bySpeaker[t.speaker_id]) bySpeaker[t.speaker_id] = [];
      bySpeaker[t.speaker_id].push(t.text);
    });
    
    // Render speaker labels + text + Exa results
    Object.entries(bySpeaker).forEach(([speaker, texts]) => {
      const elem = document.getElementById(`speaker-${speaker}`);
      elem.innerHTML = `<strong>${speaker}:</strong> ${texts.join(" ")}`;
    });
    
    // Render Exa results
    document.getElementById("exa-results").innerHTML = 
      exaData.results.map(r => `<p>${r.title}: ${r.url}</p>`).join("");
  }
}

// Usage
const scribe = new ScribeController();
scribe.connect();
```

### Backend (Node.js)
```javascript
// Token endpoint
app.get("/scribe-token", async (req, res) => {
  const token = await elevenlabs.tokens.singleUse.create("realtime_scribe");
  res.json({ token: token.token });
});

// Exa API wrapper
app.post("/api/exa-search", async (req, res) => {
  const { transcripts, context } = req.body;
  
  // Build search query from all speaker transcripts
  const query = transcripts.map(t => t.text).join(" ");
  
  // Call Exa API
  const results = await exa.search(query, { numResults: 5 });
  
  res.json({ results });
});
```

---

## 9. Important Constraints & Quirks

### Language Limitations
- Scribe V2 Realtime works best in: **English, French, German, Italian, Spanish, Portuguese, Chinese, Japanese**
- Still supports 90+ languages but accuracy highest in above 8 languages

### Diarization Limitation
- **Current:** Diarization requires manual commit or VAD (automatic silence-based)
- **Limitation:** 8-minute length limit on diarization (batch mode only; you're using streaming, so this doesn't apply)
- **Auto-diarization:** May be released post-Jan 2026

### Text Conditioning
- If your WebSocket connection drops, use text from previous commits as "context" to maintain continuity
- Example: When reconnecting, send the last committed transcript as context

```json
{
  "type": "Condition",
  "text": "the previous context was discussing AI"
}
```

### Audio Format
- **Only PCM 16-bit signed** or **μ-law** encoding
- Not MP3, AAC, or other compressed formats
- Decode first if source is compressed

---

## 10. Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Invalid token` | Token expired or malformed | Regenerate token from backend |
| `Invalid audio format` | Not PCM16 or wrong sample rate | Verify audio encoding & sample rate |
| `Connection closed unexpectedly` | Network issue or timeout | Reconnect with exponential backoff |
| `Unauthorized` | Wrong API key or expired token | Check API key, regenerate token |

### Retry Strategy
```javascript
async function connectWithRetry(maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await scribeController.connect();
      return;
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error);
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i))); // Exponential backoff
    }
  }
  throw new Error("Failed to connect after max retries");
}
```

---

## 11. Pricing (As of Feb 2026)

- **Base pricing:** $0.28 per hour of transcription
- **Annual plan:** Discounted rate (~50% off)
- **Diarization:** Included (no extra cost)

For a 6-hour hackathon: ~$1.68 (base) or ~$0.84 (annual)

---

## 12. SDK Options

### Option 1: React Hook (Easiest for Web Apps)
```javascript
import { useScribe } from "@elevenlabs/react";

function MyComponent() {
  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    onPartialTranscript: (data) => console.log("Partial:", data.text),
    onCommittedTranscript: (data) => console.log("Committed:", data.text),
  });

  return (
    <>
      <button onClick={() => scribe.connect({ microphone: true })}>
        Start
      </button>
      <button onClick={() => scribe.disconnect()}>Stop</button>
    </>
  );
}
```

**Install:** `npm install @elevenlabs/react @elevenlabs/elevenlabs-js`

### Option 2: Raw WebSocket (Most Control)
Use the approach in sections 3–8 above.

### Option 3: Python (Server-Side Only)
```python
import asyncio
from elevenlabs import ElevenLabs, RealtimeEvents, RealtimeUrlOptions

async def main():
    elevenlabs = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))
    
    connection = await elevenlabs.speech_to_text.realtime.connect(
        RealtimeUrlOptions(
            model_id="scribe_v2_realtime",
            sample_rate=16000
        )
    )
    
    async for event in connection:
        if event.type == RealtimeEvents.TRANSCRIPT:
            print(f"{event.result.speaker_id}: {event.result.text}")

asyncio.run(main())
```

---

## 13. Documentation Links

- **Main Docs:** https://elevenlabs.io/docs/developers/guides/cookbooks/speech-to-text/realtime
- **Client-Side Guide:** https://elevenlabs.io/docs/developers/guides/cookbooks/speech-to-text/realtime/client-side-streaming
- **Commit Strategies:** https://elevenlabs.io/docs/developers/guides/cookbooks/speech-to-text/realtime/transcripts-and-commit-strategies
- **JavaScript SDK:** https://github.com/elevenlabs/elevenlabs-js
- **API Reference:** https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime

---

## 14. Debugging Checklist

- ✅ Is your `.env` file set with `ELEVENLABS_API_KEY`?
- ✅ Did you generate a single-use token on the backend?
- ✅ Is your audio PCM 16-bit at 16kHz sample rate?
- ✅ Are you handling **both** partial and committed transcripts?
- ✅ Is your 1-second polling loop only sending finalized transcripts to Exa?
- ✅ Are you grouping transcripts by `speaker_id`?
- ✅ Check browser console for WebSocket errors
- ✅ Test with just one speaker first, then add multi-speaker

---

## 15. Example: Full Hackathon Stack

```
┌─────────────────────────────────────────────────┐
│         WEB APP (React/Next.js)                 │
│  ┌───────────────────────────────────────────┐  │
│  │ <Microphone> → Scribe WebSocket           │  │
│  │ ↓                                          │  │
│  │ Display: Speaker_0, Speaker_1 labels      │  │
│  │ + partial/committed transcripts           │  │
│  └───────────────────────────────────────────┘  │
│              ↓ every 1 second                    │
├─────────────────────────────────────────────────┤
│         NODE.js BACKEND                         │
│  ┌───────────────────────────────────────────┐  │
│  │ POST /scribe-token → ElevenLabs token    │  │
│  │ POST /api/exa-search → Exa API call      │  │
│  └───────────────────────────────────────────┘  │
│              ↓                                   │
├─────────────────────────────────────────────────┤
│         EXA API                                 │
│  Search & fetch results                        │
└─────────────────────────────────────────────────┘
```

Good luck with your hackathon! 🚀