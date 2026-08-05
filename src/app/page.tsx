'use client'

import { useEffect, useState } from 'react'
import {
  Mic, FolderOpen, Fingerprint, FileText, Sparkles, Download,
  Settings, LayoutDashboard, AudioWaveform, Moon, Sun, Menu, X,
} from 'lucide-react'
import { useVoiceStore, type SectionId } from '@/lib/voice-store'
import { Button } from '@/components/ui/button'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { Dashboard } from '@/components/sections/Dashboard'
import { Recorder } from '@/components/sections/Recorder'
import { Datasets } from '@/components/sections/Datasets'
import { VoiceProfiles } from '@/components/sections/VoiceProfiles'
import { ScriptEditor } from '@/components/sections/ScriptEditor'
import { Generation } from '@/components/sections/Generation'
import { Exports } from '@/components/sections/Exports'
import { SettingsSection } from '@/components/sections/Settings'

interface NavItem {
  id: SectionId
  label: string
  icon: React.ComponentType<{ className?: string }>
  phase: number
}

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, phase: 0 },
  { id: 'recorder', label: 'Voice Recorder', icon: Mic, phase: 1 },
  { id: 'datasets', label: 'Dataset Manager', icon: FolderOpen, phase: 1 },
  { id: 'profiles', label: 'Voice Profiles', icon: Fingerprint, phase: 2 },
  { id: 'script', label: 'Script Editor', icon: FileText, phase: 2 },
  { id: 'generation', label: 'Generation Studio', icon: Sparkles, phase: 3 },
  { id: 'exports', label: 'Export Manager', icon: Download, phase: 3 },
  { id: 'settings', label: 'Settings', icon: Settings, phase: 4 },
]

export default function Home() {
  const { activeSection, setActiveSection, refreshProfiles, refreshProjects, refreshRecordings } = useVoiceStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // hydration flag is set after first render so theme toggle is SSR-safe
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
    refreshProfiles()
    refreshProjects()
    refreshRecordings()
  }, [refreshProfiles, refreshProjects, refreshRecordings])

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard': return <Dashboard />
      case 'recorder': return <Recorder />
      case 'datasets': return <Datasets />
      case 'profiles': return <VoiceProfiles />
      case 'script': return <ScriptEditor />
      case 'generation': return <Generation />
      case 'exports': return <Exports />
      case 'settings': return <SettingsSection />
      default: return <Dashboard />
    }
  }

  const currentNav = NAV.find(n => n.id === activeSection)

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>

          <div className="flex items-center gap-2">
            <div className="relative flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
              <AudioWaveform className="size-4" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-semibold tracking-tight leading-none">Echo</h1>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">Local Voice AI Studio</p>
            </div>
          </div>

          <div className="ml-4 hidden md:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="text-foreground/60">/</span>
            <span className="font-medium text-foreground">{currentNav?.label}</span>
            <span className="ml-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              Phase {currentNav?.phase}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => mounted && setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
            >
              {mounted && theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <div className="hidden sm:flex items-center gap-2 rounded-full border bg-emerald-500/10 px-3 py-1">
              <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Offline-Ready</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed lg:sticky top-14 z-20 h-[calc(100vh-3.5rem)] w-64 shrink-0 border-r bg-background/95 backdrop-blur transition-transform lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <nav className="flex h-full flex-col gap-1 p-3">
            <div className="mb-2 px-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Pipeline
            </div>
            {NAV.map((item) => {
              const Icon = item.icon
              const active = activeSection === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSection(item.id)
                    setSidebarOpen(false)
                  }}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                    "hover:bg-accent hover:text-accent-foreground",
                    active
                      ? "bg-gradient-to-r from-emerald-500/15 to-transparent text-emerald-700 dark:text-emerald-400 border-l-2 border-emerald-500"
                      : "text-muted-foreground border-l-2 border-transparent"
                  )}
                >
                  <Icon className={cn("size-4 shrink-0", active && "text-emerald-600 dark:text-emerald-400")} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.phase > 0 && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                      P{item.phase}
                    </span>
                  )}
                </button>
              )
            })}

            <div className="mt-auto rounded-lg border bg-muted/40 p-3">
              <div className="flex items-center gap-2">
                <div className="size-1.5 rounded-full bg-amber-500" />
                <span className="text-[10px] font-medium text-muted-foreground">Local Engine</span>
              </div>
              <p className="mt-1 text-[10px] leading-snug text-muted-foreground/80">
                Browser TTS + Web Audio analysis. No data leaves your device.
              </p>
            </div>
          </nav>
        </aside>

        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 top-14 z-10 bg-black/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-4 lg:p-8">
            {renderSection()}
          </div>
        </main>
      </div>
    </div>
  )
}
