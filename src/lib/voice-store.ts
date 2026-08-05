/**
 * Voice Store — client-side state for Echo
 *
 * Holds the currently active section, draft script, selected voice profile,
 * and the in-progress generation job. Persisted to localStorage so the
 * user can resume work after a page reload.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type SectionId =
  | 'dashboard'
  | 'recorder'
  | 'datasets'
  | 'profiles'
  | 'script'
  | 'generation'
  | 'exports'
  | 'settings'

export interface VoiceProfileSummary {
  id: string
  name: string
  accent: string
  language: string
  pitch: number
  pace: number
  energy: number
  fingerprint?: string
}

export interface ProjectSummary {
  id: string
  title: string
  status: string
  voiceProfileId?: string
  voiceProfileName?: string
  createdAt: string
}

export interface RecordingSummary {
  id: string
  filename: string
  duration: number
  quality: string
  createdAt: string
}

export interface GenerationJob {
  id: string
  projectId: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number // 0..100
  message: string
  startedAt: string
  outputUrl?: string
}

interface VoiceStoreState {
  // Navigation
  activeSection: SectionId
  setActiveSection: (s: SectionId) => void

  // Cached server data
  profiles: VoiceProfileSummary[]
  projects: ProjectSummary[]
  recordings: RecordingSummary[]
  refreshProfiles: () => Promise<void>
  refreshProjects: () => Promise<void>
  refreshRecordings: () => Promise<void>

  // Selected profile (used by Script + Generation sections)
  selectedProfileId?: string
  setSelectedProfile: (id?: string) => void

  // Draft script
  draftScript: string
  setDraftScript: (s: string) => void

  // Active generation job
  activeJob?: GenerationJob
  setActiveJob: (j?: GenerationJob) => void
}

export const useVoiceStore = create<VoiceStoreState>()(
  persist(
    (set, get) => ({
      activeSection: 'dashboard',
      setActiveSection: (s) => set({ activeSection: s }),

      profiles: [],
      projects: [],
      recordings: [],

      refreshProfiles: async () => {
        try {
          const res = await fetch('/api/voice-profiles')
          if (!res.ok) return
          const data = await res.json()
          set({ profiles: data.profiles || [] })
        } catch {
          /* swallow — server may be starting */
        }
      },

      refreshProjects: async () => {
        try {
          const res = await fetch('/api/projects')
          if (!res.ok) return
          const data = await res.json()
          set({ projects: data.projects || [] })
        } catch {
          /* swallow */
        }
      },

      refreshRecordings: async () => {
        try {
          const res = await fetch('/api/recordings')
          if (!res.ok) return
          const data = await res.json()
          set({ recordings: data.recordings || [] })
        } catch {
          /* swallow */
        }
      },

      selectedProfileId: undefined,
      setSelectedProfile: (id) => set({ selectedProfileId: id }),

      draftScript: '',
      setDraftScript: (s) => set({ draftScript: s }),

      activeJob: undefined,
      setActiveJob: (j) => set({ activeJob: j }),
    }),
    {
      name: 'echo-state',
      partialize: (state) => ({
        activeSection: state.activeSection,
        selectedProfileId: state.selectedProfileId,
        draftScript: state.draftScript,
      }),
    }
  )
)
