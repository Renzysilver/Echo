'use client'

import { useEffect, useState } from 'react'
import {
  Mic, FolderOpen, Fingerprint, FileText, Sparkles, Download,
  TrendingUp, Clock, CheckCircle2, Cpu, HardDrive, Zap,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useVoiceStore } from '@/lib/voice-store'
import { cn } from '@/lib/utils'

interface Stats {
  profiles: number
  projects: number
  recordings: number
  completedProjects: number
  totalRecordingSec: number
  pipeline: { stage: string; status: string }[]
}

export function Dashboard() {
  const { setActiveSection, profiles, projects, recordings } = useVoiceStore()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(data => { setStats(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const cards = [
    {
      label: 'Voice Profiles',
      value: stats?.profiles ?? profiles.length,
      icon: Fingerprint,
      color: 'from-emerald-500 to-teal-600',
      onClick: () => setActiveSection('profiles'),
    },
    {
      label: 'Recordings',
      value: stats?.recordings ?? recordings.length,
      icon: Mic,
      color: 'from-amber-500 to-orange-600',
      onClick: () => setActiveSection('recorder'),
    },
    {
      label: 'Projects',
      value: stats?.projects ?? projects.length,
      icon: FileText,
      color: 'from-violet-500 to-purple-600',
      onClick: () => setActiveSection('script'),
    },
    {
      label: 'Completed',
      value: stats?.completedProjects ?? 0,
      icon: CheckCircle2,
      color: 'from-rose-500 to-pink-600',
      onClick: () => setActiveSection('generation'),
    },
  ]

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent p-6 lg:p-8">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs font-medium">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Offline-First · Local-Only · Free Forever
          </div>
          <h1 className="mt-4 text-3xl lg:text-4xl font-bold tracking-tight">
            Your voice, your model, your machine.
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Echo captures your voice from recordings, extracts its acoustic fingerprint, and synthesizes natural speech from any script — entirely on your local hardware. No cloud, no subscription, no telemetry.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button onClick={() => setActiveSection('recorder')} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Mic className="size-4 mr-2" /> Start Recording
            </Button>
            <Button variant="outline" onClick={() => setActiveSection('script')}>
              <FileText className="size-4 mr-2" /> Write a Script
            </Button>
            <Button variant="ghost" onClick={() => setActiveSection('settings')}>
              Configure Engine
            </Button>
          </div>
        </div>
        <div className="absolute -right-10 -top-10 opacity-10 pointer-events-none">
          <Sparkles className="size-48" />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Card
              key={card.label}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={card.onClick}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                    <p className="mt-2 text-3xl font-bold tracking-tight">
                      {loading ? '—' : card.value}
                    </p>
                  </div>
                  <div className={cn('rounded-lg bg-gradient-to-br p-2 text-white shadow-sm', card.color)}>
                    <Icon className="size-4" />
                  </div>
                </div>
                <p className="mt-3 text-[10px] text-muted-foreground">Click to open →</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Pipeline + system */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="size-4 text-emerald-500" />
              Pipeline Status
            </CardTitle>
            <CardDescription>
              The eight-stage journey from raw microphone input to a polished audio export.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(stats?.pipeline ?? []).map((stage, idx) => (
              <div key={stage.stage} className="flex items-center gap-3">
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  {idx + 1}
                </div>
                <span className="flex-1 text-sm">{stage.stage}</span>
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0">
                  Ready
                </Badge>
              </div>
            ))}
            {!stats?.pipeline?.length && !loading && (
              <p className="text-sm text-muted-foreground">Pipeline will appear here once the server is reachable.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cpu className="size-4 text-emerald-500" />
              System
            </CardTitle>
            <CardDescription>Target hardware profile.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <Cpu className="size-3.5" /> CPU
              </span>
              <span className="font-medium">Intel i5 (4 cores)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <HardDrive className="size-3.5" /> RAM
              </span>
              <span className="font-medium">8 GB</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <Clock className="size-3.5" /> Total Audio
              </span>
              <span className="font-medium">
                {stats ? `${Math.round(stats.totalRecordingSec)}s` : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <TrendingUp className="size-3.5" /> Engine
              </span>
              <span className="font-medium">Web Speech API</span>
            </div>
            <div className="mt-4 rounded-lg border bg-muted/40 p-3">
              <p className="text-[11px] leading-snug text-muted-foreground">
                Browser-native TTS plus Web Audio analysis. Add Coqui TTS / XTTS for neural cloning — see Settings.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick start */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Start</CardTitle>
          <CardDescription>Five steps from silence to synthesized speech.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            {[
              { n: 1, title: 'Record', desc: 'Capture 30+ seconds of clean speech', icon: Mic, target: 'recorder' as const },
              { n: 2, title: 'Clean', desc: 'Remove noise and silences', icon: FolderOpen, target: 'datasets' as const },
              { n: 3, title: 'Profile', desc: 'Extract your voice fingerprint', icon: Fingerprint, target: 'profiles' as const },
              { n: 4, title: 'Write', desc: 'Compose your script with pause tags', icon: FileText, target: 'script' as const },
              { n: 5, title: 'Generate', desc: 'Synthesize and export', icon: Download, target: 'exports' as const },
            ].map((step) => {
              const Icon = step.icon
              return (
                <button
                  key={step.n}
                  onClick={() => setActiveSection(step.target)}
                  className="group text-left rounded-lg border p-3 transition-all hover:border-emerald-500/40 hover:bg-emerald-500/5"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-md bg-emerald-500/10 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      {step.n}
                    </div>
                    <Icon className="size-3.5 text-muted-foreground group-hover:text-emerald-500" />
                  </div>
                  <p className="mt-2 text-sm font-semibold">{step.title}</p>
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{step.desc}</p>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
