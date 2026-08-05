/**
 * Audio Analysis Module (browser-side)
 * Echo — Voice Profile Builder
 *
 * Provides utilities for analyzing raw audio captured via the Web Audio API.
 * Extracts the acoustic features that compose a voice profile:
 *   - Pitch statistics (mean, std deviation) via autocorrelation
 *   - Speaking rate (words per second, derived from energy onsets)
 *   - Energy profile (RMS envelope, dynamic range)
 *   - Pause pattern (silence-to-speech ratio, average pause length)
 *   - Voice fingerprint (hash of stable features)
 *
 * All analysis runs entirely client-side using OfflineAudioContext.
 */

export interface PitchFrame {
  time: number
  frequency: number
  confidence: number
}

export interface EnergyFrame {
  time: number
  rms: number
}

export interface VoiceAnalysis {
  durationSec: number
  sampleRate: number
  pitchMean: number   // Hz
  pitchStd: number    // Hz
  pitchRange: [number, number]
  speakingRate: number // syllables/sec
  energyMean: number
  energyStd: number
  dynamicRangeDb: number
  pauseRatio: number   // 0..1, fraction of time silent
  avgPauseMs: number
  breathCount: number
  fingerprint: string
  quality: 'low' | 'medium' | 'high'
}

/**
 * Decode an ArrayBuffer (WAV/MP3/OGG) into an AudioBuffer.
 */
export async function decodeAudio(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext
  const ctx = new AudioCtx()
  try {
    return await ctx.decodeAudioData(arrayBuffer.slice(0))
  } finally {
    if (ctx.state !== 'closed') await ctx.close()
  }
}

/**
 * Autocorrelation-based pitch detector (McLeod Pitch Method, simplified).
 * Returns the dominant frequency in Hz for a given frame, plus a confidence score.
 */
export function detectPitch(frame: Float32Array, sampleRate: number): { frequency: number; confidence: number } {
  const SIZE = frame.length
  let rms = 0
  for (let i = 0; i < SIZE; i++) rms += frame[i] * frame[i]
  rms = Math.sqrt(rms / SIZE)
  if (rms < 0.01) return { frequency: 0, confidence: 0 } // silence

  // Limit to plausible vocal range: 65 Hz (male low) → 500 Hz (female high)
  const minPeriod = Math.floor(sampleRate / 500)
  const maxPeriod = Math.floor(sampleRate / 65)

  const correlation = new Float32Array(maxPeriod)
  for (let lag = minPeriod; lag < maxPeriod; lag++) {
    let sum = 0
    for (let i = 0; i < SIZE - lag; i++) {
      sum += frame[i] * frame[i + lag]
    }
    correlation[lag] = sum
  }

  // Find the first peak after the first zero crossing
  let maxVal = 0
  let maxLag = 0
  for (let lag = minPeriod; lag < maxPeriod; lag++) {
    if (correlation[lag] > maxVal) {
      maxVal = correlation[lag]
      maxLag = lag
    }
  }

  if (maxLag === 0) return { frequency: 0, confidence: 0 }
  const confidence = Math.min(1, maxVal / (rms * rms * SIZE))
  return { frequency: sampleRate / maxLag, confidence }
}

/**
 * Compute the RMS energy of a frame.
 */
function rms(frame: Float32Array): number {
  let sum = 0
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i]
  return Math.sqrt(sum / frame.length)
}

/**
 * Extract a frame of audio from a channel.
 */
function getFrame(channel: Float32Array, start: number, length: number): Float32Array {
  const frame = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    frame[i] = channel[start + i] || 0
  }
  return frame
}

/**
 * Main analysis entry point. Accepts a decoded AudioBuffer and returns
 * a structured voice analysis object ready for storage as a voice profile.
 *
 * Frame size: 2048 samples (~46ms at 44.1kHz)
 * Hop size: 1024 samples (~23ms)
 */
export function analyzeAudioBuffer(buffer: AudioBuffer): VoiceAnalysis {
  const sampleRate = buffer.sampleRate
  const durationSec = buffer.duration
  const channel = buffer.getChannelData(0)
  const frameSize = 2048
  const hopSize = 1024

  const pitchFrames: PitchFrame[] = []
  const energyFrames: EnergyFrame[] = []
  const silenceThreshold = 0.015 // RMS below this = silence

  for (let start = 0; start + frameSize < channel.length; start += hopSize) {
    const frame = getFrame(channel, start, frameSize)
    const time = start / sampleRate
    const energy = rms(frame)
    energyFrames.push({ time, rms: energy })

    if (energy > silenceThreshold) {
      const { frequency, confidence } = detectPitch(frame, sampleRate)
      if (frequency > 0 && confidence > 0.5) {
        pitchFrames.push({ time, frequency, confidence })
      }
    }
  }

  // Pitch statistics
  const pitches = pitchFrames.map(p => p.frequency).filter(f => f > 0)
  const pitchMean = pitches.length ? pitches.reduce((a, b) => a + b, 0) / pitches.length : 120
  const variance = pitches.length ? pitches.reduce((s, p) => s + (p - pitchMean) ** 2, 0) / pitches.length : 400
  const pitchStd = Math.sqrt(variance)
  const pitchRange: [number, number] = pitches.length
    ? [Math.min(...pitches), Math.max(...pitches)]
    : [80, 200]

  // Energy statistics
  const energies = energyFrames.map(e => e.rms)
  const energyMean = energies.reduce((a, b) => a + b, 0) / energies.length
  const energyVar = energies.reduce((s, e) => s + (e - energyMean) ** 2, 0) / energies.length
  const energyStd = Math.sqrt(energyVar)
  const energyMax = Math.max(...energies)
  const energyMin = Math.min(...energies.filter(e => e > 0))
  const dynamicRangeDb = energyMax > 0 && energyMin > 0 ? 20 * Math.log10(energyMax / energyMin) : 0

  // Pause analysis: a "silent" frame is below threshold
  const silenceCount = energies.filter(e => e < silenceThreshold).length
  const pauseRatio = silenceCount / energies.length

  // Average pause length: count consecutive silent frames
  let inPause = false
  let pauseLen = 0
  let pauseLengths: number[] = []
  for (const e of energies) {
    if (e < silenceThreshold) {
      inPause = true
      pauseLen++
    } else if (inPause) {
      if (pauseLen > 3) pauseLengths.push(pauseLen) // ignore brief dips
      inPause = false
      pauseLen = 0
    }
  }
  const avgPauseFrames = pauseLengths.length ? pauseLengths.reduce((a, b) => a + b, 0) / pauseLengths.length : 0
  const avgPauseMs = (avgPauseFrames * hopSize / sampleRate) * 1000

  // Breath detection: long pauses (>400ms) followed by speech are likely breaths
  const breathCount = pauseLengths.filter(p => (p * hopSize / sampleRate) * 1000 > 400).length

  // Speaking rate: approximate syllables per second by counting energy onsets
  let onsets = 0
  let prevEnergy = 0
  for (const e of energies) {
    if (e > silenceThreshold * 2 && prevEnergy < silenceThreshold) onsets++
    prevEnergy = e
  }
  const speakingRate = durationSec > 0 ? onsets / durationSec : 0

  // Voice fingerprint: stable feature hash
  const fingerprint = hashFingerprint({
    pitchMean, pitchStd, pitchRange, speakingRate, pauseRatio, dynamicRangeDb,
  })

  // Quality assessment
  const snr = energyMean / (energyStd + 1e-6)
  let quality: 'low' | 'medium' | 'high' = 'low'
  if (durationSec > 10 && snr > 4 && pitchFrames.length > 50) quality = 'high'
  else if (durationSec > 5 && snr > 2) quality = 'medium'

  return {
    durationSec,
    sampleRate,
    pitchMean,
    pitchStd,
    pitchRange,
    speakingRate,
    energyMean,
    energyStd,
    dynamicRangeDb,
    pauseRatio,
    avgPauseMs,
    breathCount,
    fingerprint,
    quality,
  }
}

/**
 * Generate a stable voice fingerprint from key acoustic features.
 * Two recordings of the same speaker should produce the same hash (within tolerance).
 */
function hashFingerprint(features: Record<string, number>): string {
  // Quantize each feature to a stable string, then hash
  const quantized = [
    Math.round(features.pitchMean / 5) * 5,           // ±5 Hz bins
    Math.round(features.pitchStd / 5) * 5,
    Math.round(features.speakingRate * 10) / 10,       // 0.1 bins
    Math.round(features.pauseRatio * 20) / 20,
    Math.round(features.dynamicRangeDb / 2) * 2,
  ].join('|')

  // Simple FNV-1a hash
  let hash = 2166136261
  for (let i = 0; i < quantized.length; i++) {
    hash ^= quantized.charCodeAt(i)
    hash = (hash * 16777619) >>> 0
  }
  return 'VP-' + hash.toString(16).toUpperCase().padStart(8, '0')
}

/**
 * Map an acoustic analysis result to the Web Speech API parameters.
 * The browser TTS only exposes `rate`, `pitch`, and `volume` — we project
 * the rich voice profile down to those three knobs while preserving as much
 * of the speaker's character as possible.
 */
export function mapToSpeechParams(analysis: VoiceAnalysis): {
  rate: number
  pitch: number
  volume: number
} {
  // Pitch: Web Speech API uses 0..2, where 1 = neutral.
  // Map 80Hz → 0.4, 220Hz → 1.6
  const pitch = Math.max(0, Math.min(2, (analysis.pitchMean - 80) / 140 + 0.4))

  // Rate: Web Speech API uses 0.1..10, 1 = normal.
  // Average English speaking rate ≈ 2.5 syllables/sec.
  const rate = Math.max(0.5, Math.min(2.0, analysis.speakingRate / 2.5))

  // Volume: 0..1, derived from energy but clamped.
  const volume = Math.max(0.3, Math.min(1.0, analysis.energyMean * 8))

  return { rate: Math.round(rate * 100) / 100, pitch: Math.round(pitch * 100) / 100, volume }
}
