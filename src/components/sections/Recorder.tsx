'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Mic, Square, Play, Pause, Trash2, Upload, Loader2, AudioWaveform } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import { useVoiceStore } from '@/lib/voice-store'
import { analyzeAudioBuffer, decodeAudio } from '@/lib/audio-analysis'
import { cn } from '@/lib/utils'

interface Recording {
  id: string
  url: string
  blob: Blob
  duration: number
  size: number
  transcript?: string
}

export function Recorder() {
  const [recording, setRecording] = useState(false)
  const [paused, setPaused] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [transcript, setTranscript] = useState('')
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const { toast } = useToast()
  const { refreshRecordings, setActiveSection } = useVoiceStore()

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer()
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') audioCtxRef.current.close()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const render = () => {
      analyser.getByteTimeDomainData(dataArray)
      const width = canvas.width
      const height = canvas.height
      ctx.fillStyle = 'rgba(0,0,0,0)'
      ctx.clearRect(0, 0, width, height)

      // Compute RMS level for the level meter
      let sum = 0
      for (let i = 0; i < bufferLength; i++) {
        const v = (dataArray[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / bufferLength)
      setAudioLevel(Math.min(1, rms * 3))

      // Draw waveform
      ctx.lineWidth = 2
      ctx.strokeStyle = '#10b981'
      ctx.beginPath()
      const slice = width / bufferLength
      let x = 0
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0
        const y = (v * height) / 2
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
        x += slice
      }
      ctx.lineTo(width, height / 2)
      ctx.stroke()

      rafRef.current = requestAnimationFrame(render)
    }
    render()
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 44100,
        },
      })
      streamRef.current = stream

      // Set up analyser for live waveform
      const AudioCtx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext
      const audioCtx = new AudioCtx()
      audioCtxRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)
      analyserRef.current = analyser

      // Resize canvas to its display size
      const canvas = canvasRef.current
      if (canvas) {
        const dpr = window.devicePixelRatio || 1
        const rect = canvas.getBoundingClientRect()
        canvas.width = rect.width * dpr
        canvas.height = rect.height * dpr
      }

      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      chunksRef.current = []

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        const duration = seconds
        const id = `rec-${Date.now()}`
        setRecordings(prev => [{
          id,
          url,
          blob,
          duration,
          size: blob.size,
          transcript: transcript || undefined,
        }, ...prev])
        toast({ title: 'Recording saved', description: `${duration.toFixed(1)}s · ${(blob.size / 1024).toFixed(1)} KB` })
      }

      mr.start()
      setRecording(true)
      setPaused(false)
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
      drawWaveform()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Microphone access denied',
        description: 'Please grant microphone permission in your browser settings.',
        variant: 'destructive',
      })
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close()
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    stopTimer()
    setRecording(false)
    setPaused(false)
    setAudioLevel(0)
  }

  const togglePause = () => {
    if (!mediaRecorderRef.current) return
    if (paused) {
      mediaRecorderRef.current.resume()
      setPaused(false)
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } else {
      mediaRecorderRef.current.pause()
      setPaused(true)
      stopTimer()
    }
  }

  const uploadRecording = async (rec: Recording) => {
    setUploading(true)
    try {
      // Convert webm → wav (server can decode either, but we keep .webm name)
      const file = new File([rec.blob], `${rec.id}.webm`, { type: 'audio/webm' })
      const formData = new FormData()
      formData.append('audio', file)
      formData.append('transcript', rec.transcript || '')

      const res = await fetch('/api/recordings', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error('upload failed')
      const data = await res.json()
      toast({
        title: 'Uploaded to dataset',
        description: `Saved as ${data.recording.filename}`,
      })
      await refreshRecordings()
    } catch (err) {
      console.error(err)
      toast({ title: 'Upload failed', variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const analyzeRecording = async (rec: Recording) => {
    setAnalyzing(rec.id)
    try {
      const arrayBuffer = await rec.blob.arrayBuffer()
      const audioBuffer = await decodeAudio(arrayBuffer)
      const analysis = analyzeAudioBuffer(audioBuffer)
      toast({
        title: 'Voice analysis complete',
        description: `Pitch: ${analysis.pitchMean.toFixed(0)}Hz · Rate: ${analysis.speakingRate.toFixed(1)} syll/s · Quality: ${analysis.quality}`,
      })
      // Store analysis result on the recording for later profile building
      setRecordings(prev => prev.map(r =>
        r.id === rec.id ? { ...r, transcript: JSON.stringify({ analysis, transcript: r.transcript || '' }) } : r
      ))
    } catch (err) {
      console.error(err)
      toast({ title: 'Analysis failed', variant: 'destructive' })
    } finally {
      setAnalyzing(null)
    }
  }

  const deleteRecording = (id: string) => {
    setRecordings(prev => {
      const target = prev.find(r => r.id === id)
      if (target) URL.revokeObjectURL(target.url)
      return prev.filter(r => r.id !== id)
    })
  }

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Voice Recorder</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Phase 1 · Capture clean reference audio for voice profile building.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recorder card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="size-4 text-emerald-500" /> Live Capture
            </CardTitle>
            <CardDescription>
              Record at least 30 seconds of clear, natural speech for the best profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Timer + level */}
            <div className="flex items-center gap-4">
              <div className="font-mono text-4xl font-semibold tabular-nums">
                {fmtTime(seconds)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">LEVEL</span>
                  <Progress value={audioLevel * 100} className="h-1.5 flex-1" />
                </div>
              </div>
              {recording && (
                <Badge variant="outline" className={cn('border-rose-500/40 text-rose-600 dark:text-rose-400',
                  !paused && 'animate-pulse')}>
                  <div className={cn('size-1.5 rounded-full', paused ? 'bg-amber-500' : 'bg-rose-500')} />
                  <span className="ml-1.5">{paused ? 'PAUSED' : 'REC'}</span>
                </Badge>
              )}
            </div>

            {/* Waveform canvas */}
            <div className="relative h-32 rounded-lg border bg-muted/30 overflow-hidden">
              <canvas ref={canvasRef} className="size-full" />
              {!recording && (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                  <AudioWaveform className="size-5 mr-2" /> Press Record to begin
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex flex-wrap gap-2">
              {!recording ? (
                <Button onClick={startRecording} className="bg-rose-600 hover:bg-rose-700 text-white">
                  <Mic className="size-4 mr-2" /> Record
                </Button>
              ) : (
                <>
                  <Button onClick={togglePause} variant="outline">
                    {paused ? <Play className="size-4 mr-2" /> : <Pause className="size-4 mr-2" />}
                    {paused ? 'Resume' : 'Pause'}
                  </Button>
                  <Button onClick={stopRecording} variant="destructive">
                    <Square className="size-4 mr-2" /> Stop
                  </Button>
                </>
              )}
            </div>

            {/* Transcript input */}
            <div className="space-y-1.5">
              <Label htmlFor="transcript" className="text-xs">
                Transcript (optional, improves alignment)
              </Label>
              <Input
                id="transcript"
                placeholder="Type what you said during the recording..."
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Tips card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recording Tips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="font-medium text-foreground mb-1">Quiet room</p>
              <p>Background noise corrupts the pitch detector. Aim for &lt;30 dB ambient.</p>
            </div>
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="font-medium text-foreground mb-1">Consistent distance</p>
              <p>Keep 15–20 cm from the microphone. Moving changes the energy profile.</p>
            </div>
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="font-medium text-foreground mb-1">Natural cadence</p>
              <p>Read a paragraph aloud at your normal pace. Avoid theatrical delivery.</p>
            </div>
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="font-medium text-foreground mb-1">30+ seconds</p>
              <p>Longer samples produce a more stable voice fingerprint.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Local recordings */}
      {recordings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session Recordings</CardTitle>
            <CardDescription>
              These are stored in your browser tab. Upload to persist them in the dataset.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recordings.map((rec) => (
              <div key={rec.id} className="flex items-center gap-3 rounded-lg border p-3">
                <audio src={rec.url} controls className="h-8 w-48" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{rec.id}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {rec.duration.toFixed(1)}s · {(rec.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => analyzeRecording(rec)} disabled={analyzing === rec.id}>
                  {analyzing === rec.id ? <Loader2 className="size-3.5 animate-spin" /> : <AudioWaveform className="size-3.5" />}
                  <span className="ml-1.5">Analyze</span>
                </Button>
                <Button size="sm" onClick={() => uploadRecording(rec)} disabled={uploading}>
                  <Upload className="size-3.5 mr-1.5" /> Upload
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deleteRecording(rec.id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setActiveSection('datasets')}
            >
              Go to Dataset Manager →
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
