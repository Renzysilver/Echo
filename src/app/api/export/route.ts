/**
 * /api/export
 * PROJECT ECHO — Audio format conversion endpoint
 *
 * Accepts an uploaded WAV file and converts it to the requested format.
 * Supported targets: wav, mp3, ogg, flac (via ffmpeg if available, or
 * passthrough for WAV).
 *
 * If ffmpeg is not installed on the host, the endpoint falls back to
 * WAV-only output and returns a warning in the response so the UI can
 * inform the user.
 */

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
export const runtime = 'nodejs'

const OUTPUT_DIR = path.join(process.cwd(), 'outputs')

type TargetFormat = 'wav' | 'mp3' | 'ogg' | 'flac'

async function ffmpegAvailable(): Promise<boolean> {
  try {
    await execFileAsync('ffmpeg', ['-version'])
    return true
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true })
    const formData = await req.formData()
    const audio = formData.get('audio') as File | null
    const format = ((formData.get('format') as string) || 'wav') as TargetFormat
    const bitrate = (formData.get('bitrate') as string) || '192k'

    if (!audio) return NextResponse.json({ error: 'no_audio' }, { status: 400 })
    if (!['wav', 'mp3', 'ogg', 'flac'].includes(format)) {
      return NextResponse.json({ error: 'unsupported_format' }, { status: 400 })
    }

    const inputPath = path.join(OUTPUT_DIR, `in-${randomUUID()}.wav`)
    const outName = `export-${Date.now()}-${randomUUID().slice(0, 8)}.${format}`
    const outputPath = path.join(OUTPUT_DIR, outName)

    const bytes = Buffer.from(await audio.arrayBuffer())
    await fs.writeFile(inputPath, bytes)

    // WAV passthrough (just rename)
    if (format === 'wav') {
      await fs.copyFile(inputPath, outputPath)
      await fs.unlink(inputPath)
      const stat = await fs.stat(outputPath)
      return NextResponse.json({
        ok: true,
        filename: outName,
        path: `/api/outputs/${outName}`,
        size: stat.size,
        format,
      })
    }

    const hasFfmpeg = await ffmpegAvailable()
    if (!hasFfmpeg) {
      // Fall back to WAV and warn
      const fallbackName = outName.replace(/\.(mp3|ogg|flac)$/, '.wav')
      const fallbackPath = path.join(OUTPUT_DIR, fallbackName)
      await fs.copyFile(inputPath, fallbackPath)
      await fs.unlink(inputPath)
      const fallbackStat = await fs.stat(fallbackPath)
      return NextResponse.json({
        ok: false,
        warning: 'ffmpeg_not_installed',
        message: 'ffmpeg is not available on the host. Exported as WAV instead. Install ffmpeg to enable MP3/OGG/FLAC conversion.',
        filename: fallbackName,
        path: `/api/outputs/${fallbackName}`,
        size: fallbackStat.size,
        format: 'wav',
      })
    }

    const args = ['-y', '-i', inputPath]
    if (format === 'mp3') {
      args.push('-codec:a', 'libmp3lame', '-b:a', bitrate)
    } else if (format === 'ogg') {
      args.push('-codec:a', 'libvorbis', '-b:a', bitrate)
    } else if (format === 'flac') {
      args.push('-codec:a', 'flac')
    }
    args.push(outputPath)

    await execFileAsync('ffmpeg', args, { timeout: 30000 })
    await fs.unlink(inputPath)
    const stat = await fs.stat(outputPath)

    return NextResponse.json({
      ok: true,
      filename: outName,
      path: `/api/outputs/${outName}`,
      size: stat.size,
      format,
    })
  } catch (err) {
    console.error('[export] POST failed', err)
    return NextResponse.json({ error: 'failed_to_export' }, { status: 500 })
  }
}
