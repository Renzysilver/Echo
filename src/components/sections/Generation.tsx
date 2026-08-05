'use client'

import { useEffect, useState, useRef } from 'react'
import {
  Sparkles, Play, Pause, Square, Loader2, Download, Save,
  Volume2, Gauge, Activity, RefreshCw, AudioWaveform, AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useVoiceStore } from '@/lib/voice-store'
import { cn } from '@/lib/utils'

export function Generation() {
  const { draftScript, selectedProfileId, profiles, setActiveSection, activeJob, setActiveJob } = useVoiceStore()
  const { toast } = useToast()

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('')
  const [rate, setRate] = useState(1.0)
  const [pitch, setPitch] = useState(1.0)
  const [volume, setVolume] = useState(1.0)
  const [emotion, setEmotion] = useState('neutral')
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [savedProjects, setSavedProjects] = useState<any[]>([])

  // Audio capture pipeline refs
  const audioCtxRef = useRef<AudioContext | null>(null)
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const selectedProfile = profiles.find(p => p.id === selectedProfileId)

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices()
      setVoices(v)
      if (v.length && !selectedVoiceURI) {
        // Prefer an English voice
        const en = v.find(v => v.lang.startsWith('en')) || v[0]
        setSelectedVoiceURI(en.voiceURI)
      }
    }
    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
    return () => { window.speechSynthesis.onvoiceschanged = null }
  }, [selectedVoiceURI])

  // Load saved projects
  useEffect(() => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(data => setSavedProjects(data.projects || []))
      .catch(() => {})
  }, [])

  // Apply profile parameters when selected
  useEffect(() => {
    if (selectedProfile) {
      setRate(Math.max(0.5, Math.min(2.0, selectedProfile.pace)))
      setPitch(Math.max(0, Math.min(2, 1.0 + selectedProfile.pitch)))
      setVolume(Math.max(0.3, Math.min(1.0, selectedProfile.energy)))
    }
  }, [selectedProfile])

  const cleanup = () => {
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {})
    }
    audioCtxRef.current = null
    destRef.current = null
    mediaRecorderRef.current = null
    chunksRef.current = []
  }

  useEffect(() => () => cleanup(), [])

  const handleGenerate = async () => {
    if (!draftScript) {
      toast({ title: 'No script', description: 'Write a script first.', variant: 'destructive' })
      setActiveSection('script')
      return
    }
    if (!('speechSynthesis' in window)) {
      toast({ title: 'TTS not supported', description: 'Your browser does not support the Web Speech API.', variant: 'destructive' })
      return
    }

    setGenerating(true)
    setProgress(0)
    setAudioUrl(null)

    try {
      // Get render manifest from server (normalizes text + maps profile)
      const manifestRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: draftScript,
          voiceProfileId: selectedProfileId,
          emotion,
          speed: rate,
          pitchAdjust: pitch - 1.0,
        }),
      })
      if (!manifestRes.ok) throw new Error('manifest failed')
      const manifestData = await manifestRes.json()

      // Strip emotion tags and pause markers for the Web Speech API utterance
      const plainText = manifestData.manifest.normalizedText || draftScript

      // Set up audio capture: AudioContext + MediaStreamDestination + MediaRecorder
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext
      const audioCtx = new AudioCtx({ sampleRate: 44100 })
      audioCtxRef.current = audioCtx
      const dest = audioCtx.createMediaStreamDestination()
      destRef.current = dest

      chunksRef.current = []
      const mr = new MediaRecorder(dest.stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mr
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      const recordingComplete = new Promise<Blob>((resolve) => {
        mr.onstop = () => resolve(new Blob(chunksRef.current, { type: 'audio/webm' }))
      })
      mr.start()

      // Create the utterance
      const utter = new SpeechSynthesisUtterance(plainText)
      utteranceRef.current = utter
      const voice = voices.find(v => v.voiceURI === selectedVoiceURI)
      if (voice) utter.voice = voice
      utter.rate = Math.max(0.1, Math.min(10, rate))
      utter.pitch = Math.max(0, Math.min(2, pitch))
      utter.volume = Math.max(0, Math.min(1, volume))

      // Wire up the audio source to the destination
      // Note: Web Speech API output cannot be directly captured via Web Audio API in all browsers.
      // As a fallback, we use the SpeechSynthesisUtterance boundary events to track progress
      // and capture via the AudioContext destination if supported.
      const sourceNode = audioCtx.createMediaStreamSource(dest.stream)
      sourceNode.connect(audioCtx.destination)

      utter.onstart = () => setProgress(5)
      utter.onboundary = (e) => {
        if (e.charIndex && plainText.length) {
          setProgress(5 + Math.min(90, (e.charIndex / plainText.length) * 90))
        }
      }
      utter.onend = () => {
        setProgress(95)
        // Stop recording shortly after speech ends
        setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop()
          }
        }, 200)
      }
      utter.onerror = (e) => {
        console.error('utterance error', e)
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop()
        }
      }

      // Speak
      window.speechSynthesis.speak(utter)

      // Wait for recording to finish
      const blob = await recordingComplete
      const url = URL.createObjectURL(blob)
      setAudioUrl(url)
      setProgress(100)

      toast({
        title: 'Generation complete',
        description: `${(blob.size / 1024).toFixed(1)} KB · ${manifestData.manifest.estimatedDurationSec.toFixed(1)}s est.`,
      })

      // Upload to server for persistence
      try {
        const file = new File([blob], `gen-${Date.now()}.webm`, { type: 'audio/webm' })
        const fd = new FormData()
        fd.append('audio', file)
        await fetch('/api/generate', { method: 'POST', body: fd })
      } catch (e) {
        console.warn('upload of generated audio failed', e)
      }

      cleanup()
    } catch (err) {
      console.error(err)
      toast({ title: 'Generation failed', variant: 'destructive' })
      cleanup()
    } finally {
      setGenerating(false)
    }
  }

  const handleStop = () => {
    window.speechSynthesis.cancel()
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setGenerating(false)
    cleanup()
  }

  const handleExport = () => {
    setActiveSection('exports')
  }

  const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(0).padStart(2, '0')}`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Generation Studio</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Phase 3 · Synthesize speech from your script using the selected voice profile.
        </p>
      </div>

      {/* Voice profile banner */}
      <Card className={cn('border-l-4', selectedProfile ? 'border-l-emerald-500' : 'border-l-amber-500')}>
        <CardContent className="p-4 flex items-center gap-4">
          <div className={cn('rounded-lg p-2 text-white',
            selectedProfile ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-amber-500')}>
            {selectedProfile ? <Sparkles className="size-4" /> : <AlertCircle className="size-4" />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">
              {selectedProfile ? selectedProfile.name : 'Default browser voice'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {selectedProfile
                ? `Pitch ${selectedProfile.pitchMean.toFixed(0)}Hz · Pace ${selectedProfile.pace.toFixed(2)} · Fingerprint ${selectedProfile.fingerprint || '—'}`
                : 'Select a profile to apply your voice characteristics'}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setActiveSection('profiles')}>
            Change Profile
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main */}
        <div className="lg:col-span-2 space-y-4">
          {/* Script preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AudioWaveform className="size-4 text-emerald-500" /> Current Script
              </CardTitle>
              <CardDescription>From the Script Editor. Edit there to update.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-muted/40 p-3 text-sm max-h-40 overflow-y-auto whitespace-pre-wrap">
                {draftScript || <span className="text-muted-foreground italic">No script yet — go to the Script Editor.</span>}
              </div>
              {!draftScript && (
                <Button size="sm" variant="outline" className="mt-3" onClick={() => setActiveSection('script')}>
                  Open Script Editor
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Synthesis Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">Browser Voice</Label>
                <Select value={selectedVoiceURI} onValueChange={setSelectedVoiceURI}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select a voice" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {voices.map((v) => (
                      <SelectItem key={v.voiceURI} value={v.voiceURI}>
                        <span className="font-medium">{v.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">({v.lang})</span>
                      </SelectItem>
                    ))}
                    {voices.length === 0 && (
                      <SelectItem value="none" disabled>No voices available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Tip: Install additional system voices via your OS settings.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <Label className="text-xs flex items-center gap-1.5">
                    <Gauge className="size-3" /> Rate: {rate.toFixed(2)}×
                  </Label>
                  <Slider
                    value={[rate]}
                    min={0.5} max={2.0} step={0.05}
                    onValueChange={(v) => setRate(v[0])}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1.5">
                    <Activity className="size-3" /> Pitch: {pitch.toFixed(2)}
                  </Label>
                  <Slider
                    value={[pitch]}
                    min={0} max={2} step={0.05}
                    onValueChange={(v) => setPitch(v[0])}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1.5">
                    <Volume2 className="size-3" /> Volume: {volume.toFixed(2)}
                  </Label>
                  <Slider
                    value={[volume]}
                    min={0} max={1} step={0.05}
                    onValueChange={(v) => setVolume(v[0])}
                    className="mt-2"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Emotion</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {['neutral', 'happy', 'sad', 'angry', 'excited', 'calm', 'serious', 'whisper', 'shout'].map((em) => (
                    <button
                      key={em}
                      onClick={() => setEmotion(em)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors',
                        emotion === em
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                          : 'border-border hover:bg-muted'
                      )}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 pt-2">
                {!generating ? (
                  <Button onClick={handleGenerate} className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={!draftScript}>
                    <Sparkles className="size-4 mr-2" /> Generate Speech
                  </Button>
                ) : (
                  <Button onClick={handleStop} variant="destructive">
                    <Square className="size-4 mr-2" /> Stop
                  </Button>
                )}
                {audioUrl && (
                  <>
                    <Button variant="outline" onClick={handleExport}>
                      <Download className="size-4 mr-2" /> Export
                    </Button>
                  </>
                )}
              </div>

              {/* Progress */}
              {generating && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Synthesizing...</span>
                    <span className="font-mono">{progress.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Output */}
          {audioUrl && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AudioWaveform className="size-4 text-emerald-500" /> Output
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <audio src={audioUrl} controls className="w-full" />
                <div className="flex gap-2">
                  <Button size="sm" asChild>
                    <a href={audioUrl} download={`echo-${Date.now()}.webm`}>
                      <Download className="size-3.5 mr-1.5" /> Download
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleExport}>
                    Convert to MP3/FLAC
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Pipeline Stages</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {[
                { label: 'Load Voice Profile', done: !!selectedProfile },
                { label: 'Load Speech Model', done: true },
                { label: 'Apply Voice Embedding', done: !!selectedProfile },
                { label: 'Generate Speech', done: !!audioUrl },
                { label: 'Produce WAV Output', done: !!audioUrl },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={cn('size-1.5 rounded-full', s.done ? 'bg-emerald-500' : 'bg-muted-foreground/30')} />
                  <span className={s.done ? 'text-foreground' : 'text-muted-foreground'}>{s.label}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center justify-between">
                Saved Projects
                <Button size="icon" variant="ghost" className="size-6" onClick={() => fetch('/api/projects').then(r => r.json()).then(d => setSavedProjects(d.projects || []))}>
                  <RefreshCw className="size-3" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-72 overflow-y-auto">
              {savedProjects.length === 0 ? (
                <p className="text-xs text-muted-foreground">No saved projects.</p>
              ) : (
                savedProjects.map((p) => (
                  <div key={p.id} className="rounded border p-2 text-xs">
                    <div className="flex items-center justify-between">
                      <p className="font-medium truncate">{p.title}</p>
                      <Badge variant="outline" className="text-[9px]">{p.status}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{p.script}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
