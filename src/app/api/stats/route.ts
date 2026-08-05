/**
 * /api/stats
 * PROJECT ECHO — Aggregate statistics for the dashboard
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const [profiles, projects, recordings, completedProjects] = await Promise.all([
      db.voiceProfile.count(),
      db.project.count(),
      db.recording.count(),
      db.project.count({ where: { status: 'completed' } }),
    ])

    const totalDuration = await db.recording.aggregate({ _sum: { duration: true } })

    return NextResponse.json({
      profiles,
      projects,
      recordings,
      completedProjects,
      totalRecordingSec: totalDuration._sum.duration || 0,
      pipeline: [
        { stage: 'Recording', status: 'ready' },
        { stage: 'Cleaning', status: 'ready' },
        { stage: 'Segmentation', status: 'ready' },
        { stage: 'Profile Build', status: 'ready' },
        { stage: 'Script Norm', status: 'ready' },
        { stage: 'Generation', status: 'ready' },
        { stage: 'Enhancement', status: 'ready' },
        { stage: 'Export', status: 'ready' },
      ],
    })
  } catch (err) {
    console.error('[stats] GET failed', err)
    return NextResponse.json({ error: 'failed_to_compute' }, { status: 500 })
  }
}
