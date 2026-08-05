# Echo

A free, modular, offline-first voice AI application. Capture your voice from recordings, extract its acoustic fingerprint, and synthesize natural speech from any script — all running locally on your own machine.

Built with Next.js 16, TypeScript, Prisma, the Web Audio API, and the Web Speech API.

---

## Features

- **Voice Recorder** — Capture reference audio in-browser with a live waveform visualizer
- **Dataset Manager** — Upload, clean, segment, and inspect recordings
- **Voice Profile Builder** — Extract pitch statistics, speaking rate, energy profile, pause patterns, and a stable voice fingerprint
- **Script Editor** — Compose scripts with automatic number/date/currency/abbreviation expansion and `[emotion]` prosody tags
- **Generation Studio** — Synthesize speech using the browser's Web Speech API, mapped to your voice profile parameters
- **Export Manager** — Convert output to WAV / MP3 / FLAC / OGG
- **Settings** — Configure TTS engine, sample rate, language, and integration paths for neural engines

---

## Getting Started

### Prerequisites

- Node.js 20+ or Bun
- A modern browser (Chrome, Edge, Firefox, or Safari) with microphone access
- Optional: ffmpeg installed on your system for MP3/FLAC/OGG export

### Installation

```bash
# Clone the repository
git clone https://github.com/Renzysilver/Echo.git
cd Echo

# Install dependencies
bun install

# Set up the database
cp .env.example .env
bun run db:push

# Start the dev server
bun run dev
```

Open `http://localhost:3000` in your browser.

---

## Usage

### 1. Record your voice

Open the **Voice Recorder** tab and grant microphone permission. Record at least 30 seconds of clear, natural speech in a quiet room. Click **Analyze** to see your pitch and fingerprint, then **Upload** to save it to the dataset.

### 2. Build a voice profile

Open the **Voice Profiles** tab and click **Build New Profile**. Echo will analyze all your recordings, average the acoustic features, and produce a voice fingerprint. Save it with a name.

### 3. Write a script

Open the **Script Editor** tab. Type or paste your script. Numbers, dates, times, currencies, and abbreviations are expanded automatically. Use `[emotion]` tags (e.g. `[excited]`, `[serious]`, `[whisper]`) to mark prosody. Insert pauses with the **Insert Pause** button.

### 4. Generate speech

Open the **Generation Studio** tab. Select a browser voice, adjust the rate/pitch/volume sliders (pre-loaded from your voice profile), and click **Generate Speech**. The synthesized audio is captured and made available for download.

### 5. Export

Open the **Export Manager** tab. Select a source file, choose your output format (WAV, MP3, FLAC, or OGG), and click **Export**. Files are saved to `outputs/`.

---

## Architecture

```
src/
├── app/
│   ├── page.tsx                       # Single-page app shell + section router
│   ├── layout.tsx
│   └── api/
│       ├── recordings/route.ts        # Recording CRUD + multipart upload
│       ├── voice-profiles/route.ts    # Profile CRUD
│       ├── projects/route.ts          # Project CRUD
│       ├── generate/route.ts          # Render manifest + audio capture upload
│       ├── dataset/route.ts           # Cleaning / segmentation stage markers
│       ├── export/route.ts            # ffmpeg-backed format conversion
│       └── stats/route.ts             # Dashboard aggregates
├── components/
│   ├── sections/                      # 8 UI sections (Dashboard, Recorder, ...)
│   ├── theme-provider.tsx
│   └── ui/                            # shadcn/ui components
├── lib/
│   ├── audio-analysis.ts              # Pitch detection, energy, pause, fingerprint
│   ├── text-normalizer.ts             # Number / date / currency / abbreviation expansion
│   ├── voice-store.ts                 # Zustand store (active section, draft script, ...)
│   ├── db.ts                          # Prisma client
│   └── utils.ts
└── prisma/
    └── schema.prisma                  # VoiceProfile · Project · Recording · Setting
```

### Database schema

| Model         | Purpose                                                              |
| ------------- | ------------------------------------------------------------------- |
| VoiceProfile  | Acoustic fingerprint, pitch stats, speaking rate, language, accent  |
| Project       | Script + voice profile + status + output filename                   |
| Recording     | Audio file metadata + transcript + quality score                    |
| Setting       | Key-value store for runtime configuration                           |

---

## Local-First Design

| Layer             | Choice                                  | Why                                                  |
| ----------------- | --------------------------------------- | ---------------------------------------------------- |
| TTS engine        | Web Speech API (browser-native)         | Free, offline, no install, voice-style mapping       |
| Audio analysis    | Web Audio API + autocorrelation         | Runs in-browser, no Python required                  |
| Audio capture     | MediaRecorder + AudioContext            | Records synthesis output for export                  |
| Storage           | SQLite via Prisma                       | Single-file DB, zero-config                          |
| Format conversion | ffmpeg (optional)                       | Enables MP3/FLAC/OGG; WAV works without ffmpeg       |

### Voice profile mapping

The browser's Web Speech API exposes only three parameters: `rate`, `pitch`, and `volume`. Echo projects the rich voice profile down to those three knobs while preserving as much of the speaker's character as possible:

| Acoustic feature       | → Speech API param |
| ---------------------- | ------------------ |
| Pitch mean (Hz)        | `pitch` (0..2)     |
| Speaking rate (syl/s)  | `rate` (0.5..2.0)  |
| Energy mean (RMS)      | `volume` (0.3..1.0)|

---

## Upgrading to Neural Voice Cloning

The default engine produces a voice-style approximation. For true zero-shot cloning of your exact timbre, install one of the following local engines and select it in **Settings → TTS Engine**:

### Coqui XTTS v2 (recommended for cloning)

```bash
pip install TTS torch
python -c "from TTS.utils.manage import ModelManager; ModelManager().download_model('xtts_v2')"
```

- ~2 GB model download
- Zero-shot multilingual cloning from a 6-second reference clip
- ~30s per sentence on CPU; GPU strongly recommended

### Piper TTS (recommended for speed)

```bash
# Download from https://github.com/rhasspy/piper/releases
# Voices from https://github.com/rhasspy/piper-voices
```

- ONNX-based, ~50ms latency on CPU
- Limited to pre-trained voices; cloning requires fine-tuning

### OpenVoice v2 (tone color transfer)

```bash
git clone https://github.com/myshell-ai/OpenVoice
cd OpenVoice && pip install -r requirements.txt
```

- Excellent tone matching
- Requires a reference clip per generation
- ~5s per sentence on CPU

Integration hooks for these engines live in `src/app/api/generate/route.ts`. To wire one in, replace the Web Speech API parameter mapping with a server-side Python subprocess call to your chosen engine, and stream the resulting audio back to the client.

---

## Pipeline

```
Record Voice → Clean Audio → Split Audio → Create Dataset
            ↓
Build Voice Profile → Save Voice Embedding
            ↓
Input Script → Normalize Text → Generate Speech
            ↓
Enhance Audio → Export Final Audio
```

Each stage is implemented as an isolated module:

- **Recording**: `src/components/sections/Recorder.tsx` (MediaRecorder API)
- **Cleaning / Segmentation**: `src/app/api/dataset/route.ts` (marker storage; DSP runs client-side via Web Audio API)
- **Profile Build**: `src/lib/audio-analysis.ts` (autocorrelation pitch detection + RMS energy + pause analysis)
- **Text Normalization**: `src/lib/text-normalizer.ts` (number/date/currency/abbreviation expansion)
- **Generation**: `src/components/sections/Generation.tsx` (Web Speech API + MediaRecorder capture)
- **Enhancement / Export**: `src/app/api/export/route.ts` (ffmpeg postprocessing)

---

## Development

```bash
bun install
bun run db:push     # Apply Prisma schema to SQLite
bun run dev         # Start dev server on port 3000
bun run lint        # ESLint check
```

---

## License

MIT — free for personal and commercial use.
