/**
 * /api/recordings
 * PROJECT ECHO — Recording management endpoint
 *
 * GET    → list all recordings
 * POST   → create a recording (accepts multipart audio upload or JSON metadata)
 * DELETE → remove a recording by id (also deletes the on-disk file)
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { promises as fs } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

const STORAGE_DIR = path.join(process.cwd(), 'datasets', 'raw')

async function ensureStorage() {
  await fs.mkdir(STORAGE_DIR, { recursive: true })
}

export async function GET() {
  try {
    const recordings = await db.recording.findMany({
      orderBy: { createdAt: 'desc' },
      include: { voiceProfile: true },
    })
    return NextResponse.json({
      recordings: recordings.map(r => ({
        id: r.id,
        filename: r.filename,
        transcript: r.transcript,
        duration: r.duration,
        quality: r.quality,
        sampleRate: r.sampleRate,
        channels: r.channels,
        size: r.size,
        createdAt: r.createdAt,
        voiceProfile: r.voiceProfile ? { id: r.voiceProfile.id, name: r.voiceProfile.name } : null,
      })),
    })
  } catch (err) {
    console.error('[recordings] GET failed', err)
    return NextResponse.json({ error: 'failed_to_list' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureStorage()
    const contentType = req.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('audio') as File | null
      const transcript = (formData.get('transcript') as string) || null
      if (!file) {
        return NextResponse.json({ error: 'no_audio_provided' }, { status: 400 })
      }

      const ext = path.extname(file.name) || '.wav'
      const filename = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`
      const filePath = path.join(STORAGE_DIR, filename)
      const bytes = Buffer.from(await file.arrayBuffer())
      await fs.writeFile(filePath, bytes)

      // Estimate duration from WAV header if possible
      let duration = 0
      let sampleRate = 44100
      let channels = 1
      if (ext === '.wav' && bytes.length > 44) {
        sampleRate = bytes.readUInt32LE(24)
        channels = bytes.readUInt16LE(22)
        const dataLength = bytes.readUInt32LE(40)
        duration = dataLength / (sampleRate * channels * 2)
      }

      const recording = await db.recording.create({
        data: {
          filename,
          transcript,
          duration,
          sampleRate,
          channels,
          size: bytes.length,
          storagePath: filePath,
          quality: duration > 10 ? 'high' : duration > 5 ? 'medium' : 'low',
        },
      })

      return NextResponse.json({ recording })
    }

    // JSON metadata-only creation (e.g. when audio is recorded client-side
    // and uploaded separately)
    const body = await req.json()
    const recording = await db.recording.create({
      data: {
        filename: body.filename || `rec-${Date.now()}.wav`,
        transcript: body.transcript || null,
        duration: body.duration || 0,
        quality: body.quality || 'unknown',
        sampleRate: body.sampleRate || 44100,
        channels: body.channels || 1,
        size: body.size || 0,
        storagePath: body.storagePath || '',
      },
    })
    return NextResponse.json({ recording })
  } catch (err) {
    console.error('[recordings] POST failed', err)
    return NextResponse.json({ error: 'failed_to_create' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 })

    const recording = await db.recording.findUnique({ where: { id } })
    if (!recording) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    // Best-effort delete of the file on disk
    try {
      await fs.unlink(recording.storagePath)
    } catch { /* file may already be gone */ }

    await db.recording.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[recordings] DELETE failed', err)
    return NextResponse.json({ error: 'failed_to_delete' }, { status: 500 })
  }
}
