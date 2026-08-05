'use client'

import { useEffect, useState } from 'react'
import {
  Fingerprint, Plus, Trash2, Loader2, Mic, AudioWaveform,
  Activity, Pause, Gauge, Volume2, Languages, Save, X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useVoiceStore } from '@/lib/voice-store'
import { cn } from '@/lib/utils'

interface VoiceProfile {
  id: string
  name: string
  accent: string
  language: string
  pitch: number
  pace: number
  energy: number
  pauseStyle: string
  pronunciation: string
  fingerprint?: string | null
  pitchMean: number
  pitchStd: number
  speakingRate: number
  description?: string | null
  recordingCount: number
  projectCount: number
  createdAt: string
}

interface PendingAnalysis {
  pitchMean: number
  pitchStd: number
  pitchRange: [number, number]
  speakingRate: number
  energyMean: number
  pauseRatio: number
  dynamicRangeDb: number
  avgPauseMs: number
  breathCount: number
  fingerprint: string
  quality: string
  durationSec: number
}

export function VoiceProfiles() {
  const [profiles, setProfiles] = useState<VoiceProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [pending, setPending] = useState<PendingAnalysis | null>(null)
  const [name, setName] = useState('')
  const [language, setLanguage] = useState('en')
  const [accent, setAccent] = useState('unknown')
  const [description, setDescription] = useState('')

  const { toast } = useToast()
  const { refreshProfiles, setActiveSection, setSelectedProfile } = useVoiceStore()

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/voice-profiles')
      const data = await res.json()
      setProfiles(data.profiles || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleAnalyzeForProfile = async () => {
    try {
      const recordings = await fetch('/api/recordings').then(r => r.json())
      const recs = recordings.recordings || []
      if (!recs.length) {
        toast({ title: 'No recordings', description: 'Record audio first.', variant: 'destructive' })
        return
      }
      toast({ title: 'Loading recordings for analysis...', description: `${recs.length} recording(s) found` })

      // Fetch each recording and analyze
      const analyses: any[] = []
      for (const rec of recs) {
        try {
          const audioRes = await fetch(`/datasets/raw/${rec.filename}`)
          if (!audioRes.ok) continue
          const arrayBuffer = await audioRes.arrayBuffer()
          const { decodeAudio, analyzeAudioBuffer } = await import('@/lib/audio-analysis')
          const audioBuffer = await decodeAudio(arrayBuffer)
          analyses.push(analyzeAudioBuffer(audioBuffer))
        } catch (e) {
          console.warn('skip', rec.filename, e)
        }
      }

      if (!analyses.length) {
        toast({ title: 'Could not analyze any recording', variant: 'destructive' })
        return
      }

      // Average the analyses
      const avg: PendingAnalysis = {
        pitchMean: avgOf(analyses.map(a => a.pitchMean)),
        pitchStd: avgOf(analyses.map(a => a.pitchStd)),
        pitchRange: [
          Math.min(...analyses.map(a => a.pitchRange[0])),
          Math.max(...analyses.map(a => a.pitchRange[1])),
        ],
        speakingRate: avgOf(analyses.map(a => a.speakingRate)),
        energyMean: avgOf(analyses.map(a => a.energyMean)),
        pauseRatio: avgOf(analyses.map(a => a.pauseRatio)),
        dynamicRangeDb: avgOf(analyses.map(a => a.dynamicRangeDb)),
        avgPauseMs: avgOf(analyses.map(a => a.avgPauseMs)),
        breathCount: Math.round(avgOf(analyses.map(a => a.breathCount))),
        fingerprint: analyses[0].fingerprint,
        quality: analyses.every(a => a.quality === 'high') ? 'high' : 'medium',
        durationSec: analyses.reduce((s, a) => s + a.durationSec, 0),
      }

      setPending(avg)
      setName(`Voice ${new Date().toLocaleDateString()}`)
      setCreating(true)
      toast({
        title: 'Voice profile extracted',
        description: `Pitch ${avg.pitchMean.toFixed(0)}Hz · Fingerprint ${avg.fingerprint}`,
      })
    } catch (err) {
      console.error(err)
      toast({ title: 'Analysis failed', variant: 'destructive' })
    }
  }

  const handleSave = async () => {
    if (!pending || !name) {
      toast({ title: 'Name required', variant: 'destructive' })
      return
    }
    try {
      const res = await fetch('/api/voice-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          accent,
          language,
          pitch: (pending.pitchMean - 120) / 80, // normalize to -0.5..1.0
          pace: pending.speakingRate / 2.5,
          energy: Math.min(1, pending.energyMean * 8),
          pauseStyle: pending.avgPauseMs > 300 ? 'long' : pending.avgPauseMs > 150 ? 'natural' : 'short',
          pronunciation: 'standard',
          fingerprint: pending.fingerprint,
          pitchMean: pending.pitchMean,
          pitchStd: pending.pitchStd,
          speakingRate: pending.speakingRate,
          description,
        }),
      })
      if (!res.ok) throw new Error('save failed')
      toast({ title: 'Voice profile saved', description: name })
      setCreating(false)
      setPending(null)
      setName('')
      setDescription('')
      await load()
      await refreshProfiles()
    } catch (err) {
      console.error(err)
      toast({ title: 'Save failed', variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/voice-profiles?id=${id}`, { method: 'DELETE' })
      toast({ title: 'Profile deleted' })
      await load()
      await refreshProfiles()
    } catch (err) {
      console.error(err)
      toast({ title: 'Delete failed', variant: 'destructive' })
    }
  }

  const selectProfile = (id: string) => {
    setSelectedProfile(id)
    setActiveSection('script')
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString()

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Voice Profiles</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Phase 2 · Acoustic fingerprints extracted from your recordings.
          </p>
        </div>
        <Button onClick={handleAnalyzeForProfile} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="size-4 mr-2" /> Build New Profile
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="size-5 animate-spin mr-2" /> Loading profiles...
        </div>
      ) : profiles.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Fingerprint className="size-10 mx-auto text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">No voice profiles yet.</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Record audio, then click <strong>Build New Profile</strong> to extract a fingerprint.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => setActiveSection('recorder')}>
              <Mic className="size-3.5 mr-2" /> Record Audio
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map((p) => (
            <Card key={p.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 p-1.5 text-white">
                      <Fingerprint className="size-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      <p className="text-[10px] text-muted-foreground">{fmtDate(p.createdAt)}</p>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="size-7" onClick={() => handleDelete(p.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {p.fingerprint && (
                    <Badge variant="secondary" className="font-mono text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0">
                      {p.fingerprint}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px]">
                    <Languages className="size-3 mr-1" /> {p.language}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {p.accent}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Stat icon={Activity} label="Pitch" value={`${p.pitchMean.toFixed(0)} Hz`} />
                  <Stat icon={Gauge} label="Rate" value={`${p.speakingRate.toFixed(1)} syl/s`} />
                  <Stat icon={Pause} label="Pause" value={p.pauseStyle} />
                  <Stat icon={Volume2} label="Energy" value={`${(p.energy * 100).toFixed(0)}%`} />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => selectProfile(p.id)}>
                    <AudioWaveform className="size-3.5 mr-1" /> Use
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setActiveSection('script')}>
                    <Mic className="size-3.5" />
                  </Button>
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground pt-1">
                  <span>{p.recordingCount} recording(s)</span>
                  <span>{p.projectCount} project(s)</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Save Voice Profile</DialogTitle>
            <DialogDescription>
              Review the extracted acoustic features and save with a name.
            </DialogDescription>
          </DialogHeader>

          {pending && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/40 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Fingerprint className="size-4 text-emerald-500" />
                  <span className="font-mono text-sm font-semibold">{pending.fingerprint}</span>
                  <Badge variant="secondary" className="ml-auto bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0">
                    {pending.quality}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <Metric label="Pitch Mean" value={`${pending.pitchMean.toFixed(1)} Hz`} />
                  <Metric label="Pitch Std" value={`±${pending.pitchStd.toFixed(1)} Hz`} />
                  <Metric label="Pitch Range" value={`${pending.pitchRange[0].toFixed(0)}–${pending.pitchRange[1].toFixed(0)} Hz`} />
                  <Metric label="Speaking Rate" value={`${pending.speakingRate.toFixed(2)} syl/s`} />
                  <Metric label="Pause Ratio" value={`${(pending.pauseRatio * 100).toFixed(0)}%`} />
                  <Metric label="Avg Pause" value={`${pending.avgPauseMs.toFixed(0)} ms`} />
                  <Metric label="Dynamic Range" value={`${pending.dynamicRangeDb.toFixed(1)} dB`} />
                  <Metric label="Breath Count" value={`${pending.breathCount}`} />
                  <Metric label="Total Duration" value={`${pending.durationSec.toFixed(1)} s`} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="name" className="text-xs">Profile Name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Voice" />
                </div>
                <div>
                  <Label htmlFor="language" className="text-xs">Language</Label>
                  <Input id="language" value={language} onChange={(e) => setLanguage(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="accent" className="text-xs">Accent</Label>
                  <Input id="accent" value={accent} onChange={(e) => setAccent(e.target.value)} placeholder="en-US, neutral..." />
                </div>
                <div>
                  <Label htmlFor="description" className="text-xs">Description (optional)</Label>
                  <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              <X className="size-4 mr-2" /> Cancel
            </Button>
            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Save className="size-4 mr-2" /> Save Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded bg-muted/40 px-2 py-1.5">
      <Icon className="size-3 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="font-mono text-xs font-semibold truncate">{value}</div>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-background/60 p-2">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-xs font-semibold">{value}</div>
    </div>
  )
}

function avgOf(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
}
