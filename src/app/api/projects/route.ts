/**
 * /api/projects
 * PROJECT ECHO — Project management endpoint
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const projects = await db.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: { voiceProfile: true },
    })
    return NextResponse.json({
      projects: projects.map(p => ({
        id: p.id,
        title: p.title,
        script: p.script,
        status: p.status,
        outputFile: p.outputFile,
        emotion: p.emotion,
        speed: p.speed,
        pitchAdjust: p.pitchAdjust,
        voiceProfileId: p.voiceProfileId,
        voiceProfileName: p.voiceProfile?.name,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    })
  } catch (err) {
    console.error('[projects] GET failed', err)
    return NextResponse.json({ error: 'failed_to_list' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.title || !body.script) {
      return NextResponse.json({ error: 'title_and_script_required' }, { status: 400 })
    }
    const project = await db.project.create({
      data: {
        title: body.title,
        script: body.script,
        status: body.status || 'draft',
        voiceProfileId: body.voiceProfileId || null,
        emotion: body.emotion || 'neutral',
        speed: body.speed ?? 1.0,
        pitchAdjust: body.pitchAdjust ?? 0,
        outputFile: body.outputFile || null,
      },
    })
    return NextResponse.json({ project })
  } catch (err) {
    console.error('[projects] POST failed', err)
    return NextResponse.json({ error: 'failed_to_create' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const id = body.id || req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 })

    const updated = await db.project.update({
      where: { id },
      data: {
        title: body.title,
        script: body.script,
        status: body.status,
        voiceProfileId: body.voiceProfileId,
        emotion: body.emotion,
        speed: body.speed,
        pitchAdjust: body.pitchAdjust,
        outputFile: body.outputFile,
      },
    })
    return NextResponse.json({ project: updated })
  } catch (err) {
    console.error('[projects] PUT failed', err)
    return NextResponse.json({ error: 'failed_to_update' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 })
    await db.project.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[projects] DELETE failed', err)
    return NextResponse.json({ error: 'failed_to_delete' }, { status: 500 })
  }
}
