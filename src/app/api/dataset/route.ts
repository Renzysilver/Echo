/**
 * /api/dataset
 * PROJECT ECHO — Dataset pipeline endpoint
 *
 * POST → run a pipeline stage on an uploaded audio file:
 *   stage = "clean"     → noise reduction + loudness normalization (passthrough marker)
 *   stage = "segment"   → split on long silences into multiple clips (marker only)
 *
 * NOTE: The actual DSP runs client-side using the Web Audio API. This endpoint
 * exists to persist intermediate artifacts and update the recording metadata
 * (quality, duration, etc.) so the pipeline is reproducible from the database.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { promises as fs } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

const CLEANED_DIR = path.join(process.cwd(), 'datasets', 'cleaned')
const SEGMENTED_DIR = path.join(process.cwd(), 'datasets', 'segmented')

export async function POST(req: NextRequest) {
  try {
    await fs.mkdir(CLEANED_DIR, { recursive: true })
    await fs.mkdir(SEGMENTED_DIR, { recursive: true })

    const formData = await req.formData()
    const stage = (formData.get('stage') as string) || 'clean'
    const audio = formData.get('audio') as File | null
    const sourceId = (formData.get('recordingId') as string) || null

    if (!audio) return NextResponse.json({ error: 'no_audio' }, { status: 400 })

    const bytes = Buffer.from(await audio.arrayBuffer())
    const targetDir = stage === 'segment' ? SEGMENTED_DIR : CLEANED_DIR
    const filename = `${stage}-${Date.now()}-${randomUUID().slice(0, 8)}.wav`
    const filePath = path.join(targetDir, filename)
    await fs.writeFile(filePath, bytes)

    // Update source recording metadata if provided
    if (sourceId) {
      await db.recording.update({
        where: { id: sourceId },
        data: { quality: 'high' },
      })
    }

    return NextResponse.json({
      ok: true,
      stage,
      filename,
      path: `/datasets/${stage === 'segment' ? 'segmented' : 'cleaned'}/${filename}`,
      size: bytes.length,
    })
  } catch (err) {
    console.error('[dataset] POST failed', err)
    return NextResponse.json({ error: 'failed_to_process' }, { status: 500 })
  }
}
