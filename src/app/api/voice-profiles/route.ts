/**
 * /api/voice-profiles
 * PROJECT ECHO — Voice profile management endpoint
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const profiles = await db.voiceProfile.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { recordings: true, projects: true } } },
    })
    return NextResponse.json({
      profiles: profiles.map(p => ({
        id: p.id,
        name: p.name,
        accent: p.accent,
        language: p.language,
        pitch: p.pitch,
        pace: p.pace,
        energy: p.energy,
        pauseStyle: p.pauseStyle,
        pronunciation: p.pronunciation,
        fingerprint: p.fingerprint,
        pitchMean: p.pitchMean,
        pitchStd: p.pitchStd,
        speakingRate: p.speakingRate,
        description: p.description,
        recordingCount: p._count.recordings,
        projectCount: p._count.projects,
        createdAt: p.createdAt,
      })),
    })
  } catch (err) {
    console.error('[voice-profiles] GET failed', err)
    return NextResponse.json({ error: 'failed_to_list' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.name) {
      return NextResponse.json({ error: 'name_required' }, { status: 400 })
    }

    const profile = await db.voiceProfile.create({
      data: {
        name: body.name,
        accent: body.accent || 'unknown',
        language: body.language || 'en',
        pitch: body.pitch ?? 0,
        pace: body.pace ?? 1.0,
        energy: body.energy ?? 0.5,
        pauseStyle: body.pauseStyle || 'natural',
        pronunciation: body.pronunciation || 'standard',
        embeddingPath: body.embeddingPath || null,
        fingerprint: body.fingerprint || null,
        pitchMean: body.pitchMean ?? 120,
        pitchStd: body.pitchStd ?? 20,
        speakingRate: body.speakingRate ?? 2.5,
        description: body.description || null,
      },
    })

    if (Array.isArray(body.recordingIds) && body.recordingIds.length) {
      await db.recording.updateMany({
        where: { id: { in: body.recordingIds } },
        data: { voiceProfileId: profile.id },
      })
    }

    return NextResponse.json({ profile })
  } catch (err) {
    console.error('[voice-profiles] POST failed', err)
    return NextResponse.json({ error: 'failed_to_create' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 })
    await db.voiceProfile.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[voice-profiles] DELETE failed', err)
    return NextResponse.json({ error: 'failed_to_delete' }, { status: 500 })
  }
}
