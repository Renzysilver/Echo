'use client'

import { useMemo, useState } from 'react'
import {
  FileText, Sparkles, Clock, Hash, Save, Play, Pause,
  Tag, Type, Calendar, DollarSign, CaseSensitive, Volume2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { useVoiceStore } from '@/lib/voice-store'
import { normalizeScript, type NormalizedToken } from '@/lib/text-normalizer'
import { cn } from '@/lib/utils'

const EMOTIONS = ['neutral', 'happy', 'sad', 'angry', 'excited', 'calm', 'serious', 'whisper', 'shout']
const SAMPLE_SCRIPTS = [
  {
    title: 'Podcast Intro',
    text: `Welcome back to The Local Lab, episode 42. Today is 2026-01-15, and I'm your host. In this episode, we explore how local AI models are reshaping creative workflows. [excited] Let's dive in!`,
  },
  {
    title: 'Audiobook Excerpt',
    text: `Chapter one. The lighthouse stood alone against the storm. [serious] Its beam swept the dark waters — searching, always searching — for a ship that would never return.`,
  },
  {
    title: 'Technical Tutorial',
    text: `Step 1: Install dependencies using the command pip install torch torchvision. Step 2: Download the model from coqui.ai. Step 3: Run inference with python generate.py. The whole process takes about 5 minutes.`,
  },
]

export function ScriptEditor() {
  const { draftScript, setDraftScript, selectedProfileId, profiles, setActiveSection } = useVoiceStore()
  const [title, setTitle] = useState('')
  const [showTokens, setShowTokens] = useState(false)
  const { toast } = useToast()

  const selectedProfile = profiles.find(p => p.id === selectedProfileId)

  const normalized = useMemo(() => normalizeScript(draftScript), [draftScript])

  const handleSave = async () => {
    if (!title || !draftScript) {
      toast({ title: 'Title and script required', variant: 'destructive' })
      return
    }
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          script: draftScript,
          voiceProfileId: selectedProfileId,
          status: 'draft',
        }),
      })
      if (!res.ok) throw new Error('save failed')
      toast({ title: 'Project saved', description: title })
      setActiveSection('generation')
    } catch (err) {
      console.error(err)
      toast({ title: 'Save failed', variant: 'destructive' })
    }
  }

  const insertEmotion = (emotion: string) => {
    setDraftScript(draftScript + ` [${emotion}]`)
  }

  const insertPause = () => {
    setDraftScript(draftScript + ' — ')
  }

  const fmtDuration = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Script Editor</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Phase 2 · Compose your script with automatic text normalization and prosody tags.
        </p>
      </div>

      {/* Voice profile context */}
      <Card className={cn('border-l-4', selectedProfile ? 'border-l-emerald-500' : 'border-l-muted')}>
        <CardContent className="p-4 flex items-center gap-4">
          <div className={cn('rounded-lg p-2 text-white',
            selectedProfile ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-muted')}>
            <Sparkles className="size-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">
              {selectedProfile ? selectedProfile.name : 'No voice profile selected'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {selectedProfile
                ? `Pitch ${selectedProfile.pitch} · Pace ${selectedProfile.pace} · Energy ${selectedProfile.energy}`
                : 'Select one in the Voice Profiles section'}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setActiveSection('profiles')}>
            Change
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Editor */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4 text-emerald-500" /> Script
              </CardTitle>
              <CardDescription>
                Numbers, dates, times, currencies and abbreviations are expanded automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="title" className="text-xs">Project Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="My Podcast Episode 1"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label htmlFor="script" className="text-xs">Script</Label>
                  <button
                    onClick={() => setShowTokens(!showTokens)}
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    {showTokens ? 'Hide' : 'Show'} token view
                  </button>
                </div>
                <Textarea
                  id="script"
                  value={draftScript}
                  onChange={(e) => setDraftScript(e.target.value)}
                  placeholder="Type or paste your script here. Use [emotion] tags for prosody."
                  className="min-h-[280px] font-mono text-sm"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={insertPause}>
                  <Pause className="size-3.5 mr-1.5" /> Insert Pause
                </Button>
                <Button size="sm" variant="outline" onClick={() => insertEmotion('excited')}>
                  <Tag className="size-3.5 mr-1.5" /> [excited]
                </Button>
                <Button size="sm" variant="outline" onClick={() => insertEmotion('serious')}>
                  <Tag className="size-3.5 mr-1.5" /> [serious]
                </Button>
                <Button size="sm" variant="outline" onClick={() => insertEmotion('whisper')}>
                  <Tag className="size-3.5 mr-1.5" /> [whisper]
                </Button>
                <Button size="sm" variant="outline" onClick={() => insertEmotion('calm')}>
                  <Tag className="size-3.5 mr-1.5" /> [calm]
                </Button>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSave} disabled={!draftScript || !title} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Save className="size-4 mr-2" /> Save & Generate
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Token view */}
          {showTokens && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Type className="size-4 text-emerald-500" /> Token Stream
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1 text-xs max-h-64 overflow-y-auto">
                  {normalized.tokens.map((tok, i) => (
                    <TokenChip key={i} token={tok} />
                  ))}
                  {!normalized.tokens.length && (
                    <p className="text-muted-foreground text-xs">Start typing to see tokens.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Script Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row icon={Hash} label="Words" value={String(normalized.wordCount)} />
              <Row icon={Clock} label="Est. duration" value={fmtDuration(normalized.estimatedDurationSec)} />
              <Row icon={Pause} label="Pauses" value={String(normalized.pauseMap.length)} />
              <Row icon={Type} label="Characters" value={String(draftScript.length)} />
              <Row icon={Volume2} label="Emotion tags" value={String(normalized.tokens.filter(t => t.type === 'emotion').length)} />
            </CardContent>
          </Card>

          {/* Sample scripts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Sample Scripts</CardTitle>
              <CardDescription>Click to load.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {SAMPLE_SCRIPTS.map((s) => (
                <button
                  key={s.title}
                  onClick={() => { setDraftScript(s.text); setTitle(s.title) }}
                  className="w-full text-left rounded-lg border p-2 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-colors"
                >
                  <p className="text-xs font-medium">{s.title}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{s.text}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Normalization preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Normalization Preview</CardTitle>
              <CardDescription>How the engine will read it.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs leading-relaxed text-muted-foreground bg-muted/40 rounded p-3 min-h-[80px]">
                {normalized.plainText || <span className="italic">Nothing yet.</span>}
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                <Badge variant="outline" className="text-[9px]"><Type className="size-2.5 mr-1" /> Numbers expanded</Badge>
                <Badge variant="outline" className="text-[9px]"><Calendar className="size-2.5 mr-1" /> Dates parsed</Badge>
                <Badge variant="outline" className="text-[9px]"><DollarSign className="size-2.5 mr-1" /> Currency mapped</Badge>
                <Badge variant="outline" className="text-[9px]"><CaseSensitive className="size-2.5 mr-1" /> Abbreviations</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function TokenChip({ token }: { token: NormalizedToken }) {
  const colors: Record<string, string> = {
    word: 'bg-muted text-foreground',
    number: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    date: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    time: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    currency: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    pause: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    emotion: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400',
    punctuation: 'bg-muted text-muted-foreground',
    whitespace: 'bg-transparent',
  }
  return (
    <span className={cn(
      'rounded px-1.5 py-0.5 text-[10px] font-mono',
      colors[token.type] || 'bg-muted'
    )}>
      {token.type === 'pause' ? `⏸${token.pauseMs}ms` :
       token.type === 'emotion' ? `[${token.emotion}]` :
       token.type === 'whitespace' ? '·' :
       token.text}
    </span>
  )
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground flex items-center gap-2">
        <Icon className="size-3.5" /> {label}
      </span>
      <span className="font-mono font-semibold">{value}</span>
    </div>
  )
}
