'use client'

import { useEffect, useState, useRef } from 'react'
import {
  Download, FileAudio, Loader2, Music, HardDrive, CheckCircle2,
  AlertCircle, AudioWaveform, RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

type Format = 'wav' | 'mp3' | 'ogg' | 'flac'

interface ExportItem {
  id: string
  filename: string
  path: string
  size: number
  format: Format
  createdAt: number
  warning?: string
}

export function Exports() {
  const [format, setFormat] = useState<Format>('wav')
  const [bitrate, setBitrate] = useState('192k')
  const [exporting, setExporting] = useState(false)
  const [exports, setExports] = useState<ExportItem[]>([])
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const { toast } = useToast()

  // Load saved exports from server
  useEffect(() => {
    loadExports()
  }, [])

  const loadExports = async () => {
    try {
      // The /outputs/ directory is served statically; we list via fetch
      // For simplicity, just refresh state from server-side (server keeps last exports)
      // Here we use what's in localStorage as a client-side cache
      const cached = localStorage.getItem('echo-exports')
      if (cached) setExports(JSON.parse(cached))
    } catch {}
  }

  const saveExportsCache = (items: ExportItem[]) => {
    localStorage.setItem('echo-exports', JSON.stringify(items))
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setGeneratedBlob(file)
    toast({ title: 'File loaded', description: file.name })
  }

  const handleExport = async () => {
    if (!generatedBlob) {
      toast({ title: 'No audio to export', description: 'Generate speech first or upload a file.', variant: 'destructive' })
      return
    }
    setExporting(true)
    try {
      const fd = new FormData()
      fd.append('audio', generatedBlob, 'input.wav')
      fd.append('format', format)
      fd.append('bitrate', bitrate)

      const res = await fetch('/api/export', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('export failed')
      const data = await res.json()

      const item: ExportItem = {
        id: `${Date.now()}`,
        filename: data.filename,
        path: data.path,
        size: data.size,
        format: data.format || format,
        createdAt: Date.now(),
        warning: data.warning,
      }
      const updated = [item, ...exports].slice(0, 30)
      setExports(updated)
      saveExportsCache(updated)

      toast({
        title: data.ok ? 'Export complete' : 'Exported with warning',
        description: data.warning ? data.message : `${data.filename} · ${(data.size / 1024).toFixed(1)} KB`,
        variant: data.ok ? 'default' : 'destructive',
      })
    } catch (err) {
      console.error(err)
      toast({ title: 'Export failed', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  const fmtSize = (b: number) => {
    if (b < 1024) return `${b} B`
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
    return `${(b / 1024 / 1024).toFixed(2)} MB`
  }

  const fmtDate = (ts: number) => new Date(ts).toLocaleString()

  const formats: { id: Format; label: string; desc: string; icon: any; color: string }[] = [
    { id: 'wav', label: 'WAV', desc: 'Lossless · PCM · Largest', icon: AudioWaveform, color: 'text-emerald-500' },
    { id: 'mp3', label: 'MP3', desc: 'Lossy · Universal · Small', icon: Music, color: 'text-amber-500' },
    { id: 'flac', label: 'FLAC', desc: 'Lossless · Compressed', icon: FileAudio, color: 'text-violet-500' },
    { id: 'ogg', label: 'OGG', desc: 'Open · Lossy · Efficient', icon: HardDrive, color: 'text-rose-500' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Export Manager</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Phase 3 · Convert your generated audio to the format you need.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Format picker */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Output Format</CardTitle>
              <CardDescription>
                WAV is always available. MP3, FLAC and OGG require ffmpeg on the host machine.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup value={format} onValueChange={(v) => setFormat(v as Format)}>
                <div className="grid gap-2 sm:grid-cols-2">
                  {formats.map((f) => {
                    const Icon = f.icon
                    return (
                      <Label
                        key={f.id}
                        htmlFor={f.id}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all',
                          format === f.id ? 'border-emerald-500/50 bg-emerald-500/5' : 'hover:border-muted-foreground/30'
                        )}
                      >
                        <RadioGroupItem value={f.id} id={f.id} className="mt-1" />
                        <Icon className={cn('size-4 mt-0.5', f.color)} />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{f.label}</p>
                          <p className="text-[11px] text-muted-foreground">{f.desc}</p>
                        </div>
                      </Label>
                    )
                  })}
                </div>
              </RadioGroup>

              {(format === 'mp3' || format === 'ogg') && (
                <div>
                  <Label className="text-xs">Bitrate</Label>
                  <RadioGroup value={bitrate} onValueChange={setBitrate} className="flex gap-4 mt-1">
                    {['128k', '192k', '256k', '320k'].map((b) => (
                      <Label key={b} htmlFor={b} className="flex items-center gap-1.5 cursor-pointer">
                        <RadioGroupItem value={b} id={b} />
                        <span className="text-xs">{b}</span>
                      </Label>
                    ))}
                  </RadioGroup>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                  <FileAudio className="size-4 mr-2" /> Select Source File
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Button onClick={handleExport} disabled={!generatedBlob || exporting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {exporting ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Download className="size-4 mr-2" />}
                  Export as {format.toUpperCase()}
                </Button>
              </div>

              {generatedBlob && (
                <div className="rounded-lg border bg-muted/40 p-3 text-xs">
                  <p className="font-medium">{generatedBlob.name || 'Selected audio'}</p>
                  <p className="text-muted-foreground">{fmtSize(generatedBlob.size)} · {generatedBlob.type}</p>
                  <audio
                    src={URL.createObjectURL(generatedBlob)}
                    controls
                    className="mt-2 w-full h-8"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Enhancement preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audio Enhancement Pipeline</CardTitle>
              <CardDescription>
                Applied during export (when ffmpeg is available).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  'Breath Adjustment',
                  'Silence Refinement',
                  'Noise Cleanup',
                  'Loudness Normalization',
                  'Dynamic Compression',
                  'Limiter',
                  'Final Quality Check',
                  'Format Encoding',
                ].map((stage, i) => (
                  <div key={stage} className="flex items-center gap-2 rounded border p-2 text-[10px]">
                    <div className="size-1.5 rounded-full bg-emerald-500" />
                    <span>{stage}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              Export History
              <Button size="icon" variant="ghost" className="size-6" onClick={loadExports}>
                <RefreshCw className="size-3" />
              </Button>
            </CardTitle>
            <CardDescription>Most recent first.</CardDescription>
          </CardHeader>
          <CardContent>
            {exports.length === 0 ? (
              <div className="text-center py-8">
                <FileAudio className="size-8 mx-auto text-muted-foreground/50" />
                <p className="mt-2 text-xs text-muted-foreground">No exports yet.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {exports.map((ex) => (
                  <div key={ex.id} className="rounded-lg border p-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[9px] uppercase">{ex.format}</Badge>
                      <p className="font-medium truncate flex-1">{ex.filename}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {fmtSize(ex.size)} · {fmtDate(ex.createdAt)}
                    </p>
                    {ex.warning && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 flex items-start gap-1">
                        <AlertCircle className="size-3 shrink-0 mt-0.5" />
                        <span>{ex.warning === 'ffmpeg_not_installed' ? 'ffmpeg not installed — exported as WAV' : ex.warning}</span>
                      </p>
                    )}
                    <div className="flex gap-1.5 mt-2">
                      <Button size="sm" variant="outline" className="h-6 text-[10px]" asChild>
                        <a href={ex.path} download={ex.filename}>
                          <Download className="size-3 mr-1" /> Download
                        </a>
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 text-[10px]" asChild>
                        <a href={ex.path} target="_blank" rel="noreferrer">
                          <CheckCircle2 className="size-3 mr-1" /> Open
                        </a>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
