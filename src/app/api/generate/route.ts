/**
 * /api/generate
 * PROJECT ECHO — Speech generation endpoint
 *
 * Accepts a script + voice profile parameters, renders the script using the
 * browser-facing Web Speech API parameter mapping, and produces an SSML-like
 * render manifest. The actual audio rendering happens client-side (the browser
 * voices the script and we capture the result via MediaRecorder).
 *
 * On the server we persist the project status and any output audio that the
 * client uploads after capture.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { promises as fs } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { normalizeScript, toSSML } from '@/lib/text-normalizer'

export const runtime = 'nodejs'

const OUTPUT_DIR = path.join(process.cwd(), 'outputs')

export async function POST(req: NextRequest) {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true })
    const contentType = req.headers.get('content-type') || ''

    // Multipart upload: client finished rendering and is uploading the audio
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const audio = formData.get('audio') as File | null
      const projectId = (formData.get('projectId') as string) || null
      if (!audio) return NextResponse.json({ error: 'no_audio' }, { status: 400 })

      const filename = `out-${Date.now()}-${randomUUID().slice(0, 8)}.wav`
      const filePath = path.join(OUTPUT_DIR, filename)
      const bytes = Buffer.from(await audio.arrayBuffer())
      await fs.writeFile(filePath, bytes)

      if (projectId) {
        await db.project.update({
          where: { id: projectId },
          data: { status: 'completed', outputFile: filename },
        })
      }

      return NextResponse.json({
        ok: true,
        filename,
        path: `/api/outputs/${filename}`,
        size: bytes.length,
      })
    }

    // JSON request: kick off a generation job (returns the render manifest)
    const body = await req.json()
    const { script, voiceProfileId, emotion, speed, pitchAdjust, projectId } = body

    if (!script) return NextResponse.json({ error: 'script_required' }, { status: 400 })

    let profile = null
    if (voiceProfileId) {
      profile = await db.voiceProfile.findUnique({ where: { id: voiceProfileId } })
    }

    const normalized = normalizeScript(script)
    const ssml = toSSML(normalized)

    // Map profile → speech params
    const params = {
      rate: (profile?.pace ?? 1.0) * (speed ?? 1.0),
      pitch: Math.max(0, Math.min(2, 1.0 + (profile?.pitch ?? 0) + (pitchAdjust ?? 0))),
      volume: Math.max(0.3, Math.min(1.0, profile?.energy ?? 0.7)),
    }

    if (projectId) {
      await db.project.update({
        where: { id: projectId },
        data: { status: 'processing' },
      })
    }

    return NextResponse.json({
      ok: true,
      manifest: {
        ssml,
        normalizedText: normalized.plainText,
        tokens: normalized.tokens,
        pauseMap: normalized.pauseMap,
        estimatedDurationSec: normalized.estimatedDurationSec,
        wordCount: normalized.wordCount,
      },
      speechParams: params,
      voiceProfile: profile
        ? { id: profile.id, name: profile.name, accent: profile.accent }
        : null,
      emotion: emotion || 'neutral',
    })
  } catch (err) {
    console.error('[generate] POST failed', err)
    return NextResponse.json({ error: 'failed_to_generate' }, { status: 500 })
  }
}
