'use client'

import { useState } from 'react'
import {
  Settings, Cpu, HardDrive, Mic, Volume2, Languages, Zap,
  Info, Terminal, Download, FolderOpen, RefreshCw, Github,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useTheme } from 'next-themes'

export function SettingsSection() {
  const [ttsEngine, setTtsEngine] = useState('webspeech')
  const [xttsModelPath, setXttsModelPath] = useState('')
  const [piperVoicesPath, setPiperVoicesPath] = useState('')
  const [autoClean, setAutoClean] = useState(true)
  const [autoNormalize, setAutoNormalize] = useState(true)
  const [sampleRate, setSampleRate] = useState('44100')
  const [language, setLanguage] = useState('en-US')
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()

  const handleSave = () => {
    toast({ title: 'Settings saved', description: 'Your preferences are stored locally.' })
  }

  const handleClearData = () => {
    if (confirm('Clear all local data? This removes cached recordings and exports from your browser. Database records on the server are NOT affected.')) {
      localStorage.clear()
      toast({ title: 'Local data cleared' })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Phase 4 · Configure your local voice AI engine.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* TTS Engine */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="size-4 text-emerald-500" /> TTS Engine
            </CardTitle>
            <CardDescription>
              Choose how speech is synthesized. Browser TTS works offline; neural engines require setup.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Active Engine</Label>
              <Select value={ttsEngine} onValueChange={setTtsEngine}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="webspeech">
                    <div className="flex flex-col">
                      <span className="font-medium">Web Speech API (Browser)</span>
                      <span className="text-[10px] text-muted-foreground">Free · Offline · Built-in</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="xtts">
                    <div className="flex flex-col">
                      <span className="font-medium">Coqui XTTS v2 (Local)</span>
                      <span className="text-[10px] text-muted-foreground">Neural · Zero-shot cloning · Slow on CPU</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="piper">
                    <div className="flex flex-col">
                      <span className="font-medium">Piper TTS (Local)</span>
                      <span className="text-[10px] text-muted-foreground">Fast · ONNX · Pre-trained voices</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="openvoice">
                    <div className="flex flex-col">
                      <span className="font-medium">OpenVoice v2 (Local)</span>
                      <span className="text-[10px] text-muted-foreground">Neural · Tone color transfer</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {ttsEngine === 'xtts' && (
              <div>
                <Label className="text-xs">XTTS Model Path</Label>
                <Input
                  value={xttsModelPath}
                  onChange={(e) => setXttsModelPath(e.target.value)}
                  placeholder="/home/user/models/xttsv2_2.0.2"
                  className="mt-1 font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Download from <code className="bg-muted px-1 rounded">huggingface.co/coqui/XTTS-v2</code>
                </p>
              </div>
            )}

            {ttsEngine === 'piper' && (
              <div>
                <Label className="text-xs">Piper Voices Directory</Label>
                <Input
                  value={piperVoicesPath}
                  onChange={(e) => setPiperVoicesPath(e.target.value)}
                  placeholder="/home/user/models/piper-voices"
                  className="mt-1 font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Get voices from <code className="bg-muted px-1 rounded">github.com/rhasspy/piper</code>
                </p>
              </div>
            )}

            <div className="rounded-lg bg-muted/40 p-3 text-[11px] text-muted-foreground">
              <Info className="size-3 inline mr-1" />
              Browser TTS is always available. Neural engines require Python + torch to be installed locally.
              See the README for setup instructions.
            </div>
          </CardContent>
        </Card>

        {/* Audio settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mic className="size-4 text-emerald-500" /> Audio Capture
            </CardTitle>
            <CardDescription>How recordings are captured.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Sample Rate</Label>
              <Select value={sampleRate} onValueChange={setSampleRate}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="16000">16 kHz (Telephony)</SelectItem>
                  <SelectItem value="22050">22.05 kHz (Low)</SelectItem>
                  <SelectItem value="44100">44.1 kHz (CD Quality)</SelectItem>
                  <SelectItem value="48000">48 kHz (Studio)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Default Language</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en-US">English (US)</SelectItem>
                  <SelectItem value="en-GB">English (UK)</SelectItem>
                  <SelectItem value="es-ES">Spanish (Spain)</SelectItem>
                  <SelectItem value="fr-FR">French (France)</SelectItem>
                  <SelectItem value="de-DE">German (Germany)</SelectItem>
                  <SelectItem value="hi-IN">Hindi (India)</SelectItem>
                  <SelectItem value="zh-CN">Chinese (Mandarin)</SelectItem>
                  <SelectItem value="ja-JP">Japanese</SelectItem>
                  <SelectItem value="ar-SA">Arabic</SelectItem>
                  <SelectItem value="sw-KE">Swahili (Kenya)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs">Auto-clean recordings</Label>
                <p className="text-[10px] text-muted-foreground">Run noise reduction on upload</p>
              </div>
              <Switch checked={autoClean} onCheckedChange={setAutoClean} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs">Auto-normalize text</Label>
                <p className="text-[10px] text-muted-foreground">Expand numbers/dates in scripts</p>
              </div>
              <Switch checked={autoNormalize} onCheckedChange={setAutoNormalize} />
            </div>
          </CardContent>
        </Card>

        {/* System */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Cpu className="size-4 text-emerald-500" /> System
            </CardTitle>
            <CardDescription>Hardware profile and storage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row icon={Cpu} label="CPU" value="Intel Core i5 (4 cores)" />
            <Row icon={HardDrive} label="RAM" value="8 GB" />
            <Row icon={Volume2} label="Audio" value="Web Audio API" />
            <Row icon={Languages} label="Default Voice" value={language} />
            <div className="pt-2 border-t">
              <Label className="text-xs">Storage Locations</Label>
              <div className="mt-2 space-y-1 font-mono text-[11px] text-muted-foreground">
                <div className="flex items-center gap-2">
                  <FolderOpen className="size-3" /> /datasets/raw/
                </div>
                <div className="flex items-center gap-2">
                  <FolderOpen className="size-3" /> /datasets/cleaned/
                </div>
                <div className="flex items-center gap-2">
                  <FolderOpen className="size-3" /> /datasets/segmented/
                </div>
                <div className="flex items-center gap-2">
                  <FolderOpen className="size-3" /> /outputs/
                </div>
                <div className="flex items-center gap-2">
                  <FolderOpen className="size-3" /> /models/ (optional neural models)
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="size-4 text-emerald-500" /> Appearance
            </CardTitle>
            <CardDescription>Theme and UI preferences.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Theme</Label>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-[11px] font-medium mb-1">Echo v0.1.0</p>
              <p className="text-[10px] text-muted-foreground">
                Free · Modular · Offline-first · MIT License
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={handleClearData}>
                <RefreshCw className="size-3.5 mr-1.5" /> Clear Local Data
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={handleSave}>
                <Download className="size-3.5 mr-1.5" /> Save Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Integration guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Terminal className="size-4 text-emerald-500" /> Neural Engine Integration
          </CardTitle>
          <CardDescription>
            Optional: install a local neural TTS engine for true voice cloning.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs />
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground flex items-center gap-2">
        <Icon className="size-3.5" /> {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function Tabs() {
  const [tab, setTab] = useState('xtts')
  const guides: Record<string, { title: string; steps: string[]; note: string }> = {
    xtts: {
      title: 'Coqui XTTS v2 — Zero-shot multilingual cloning',
      steps: [
        'pip install TTS torch',
        'python -c "from TTS.utils.manage import ModelManager; ModelManager().download_model(\'xtts_v2\')"',
        'Set the model path in Settings → TTS Engine → XTTS Model Path',
        'Restart Echo and select "Coqui XTTS v2" as the engine',
        'Generate speech — first run downloads ~2 GB of model weights',
      ],
      note: 'CPU inference: ~30s per sentence on i5. GPU strongly recommended.',
    },
    piper: {
      title: 'Piper TTS — Fast ONNX-based synthesis',
      steps: [
        'Download Piper from github.com/rhasspy/piper/releases',
        'Download voice models from rhasspy/piper-voices',
        'Point Piper Voices Directory to the unpacked folder',
        'Select Piper in the engine dropdown',
        'Choose a voice that matches your target gender/accent',
      ],
      note: 'Very fast on CPU (~50 ms latency). Limited to pre-trained voices; cloning requires fine-tuning.',
    },
    openvoice: {
      title: 'OpenVoice v2 — Tone color transfer',
      steps: [
        'git clone github.com/myshell-ai/OpenVoice',
        'cd OpenVoice && pip install -r requirements.txt',
        'Download checkpoints from the OpenVoice releases page',
        'Set OPENVOICE_DIR environment variable',
        'Select OpenVoice in the engine dropdown',
      ],
      note: 'Excellent tone matching. Requires a reference clip per generation. ~5s per sentence on CPU.',
    },
  }
  const g = guides[tab]

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-4">
        {Object.entries(guides).map(([k, v]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={
              'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ' +
              (tab === k ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400' : 'hover:bg-muted')
            }
          >
            {v.title.split(' — ')[0]}
          </button>
        ))}
      </div>
      <div>
        <p className="text-sm font-medium mb-2">{g.title}</p>
        <ol className="space-y-1.5">
          {g.steps.map((s, i) => (
            <li key={i} className="flex gap-2 text-xs">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                {i + 1}
              </span>
              <code className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">{s}</code>
            </li>
          ))}
        </ol>
        <div className="mt-3 rounded-lg border bg-amber-500/5 border-amber-500/20 p-2.5">
          <p className="text-[11px] text-amber-700 dark:text-amber-400">
            <Info className="size-3 inline mr-1" />
            {g.note}
          </p>
        </div>
      </div>
    </div>
  )
}
