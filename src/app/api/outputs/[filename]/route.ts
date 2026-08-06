/**
 * /api/outputs/[filename]
 * PROJECT ECHO — Streaming export file endpoint
 *
 * Serves generated audio files stored on disk under `outputs/`. Same
 * rationale as /api/audio/[filename]: the `outputs/` directory is at the
 * project root, not inside `public/`, so we stream the bytes manually with
 * the correct Content-Type and Range support.
 */

import { NextRequest, NextResponse } from 'next/server'
import { promises as fs, createReadStream } from 'fs'
import path from 'path'
import { Readable } from 'stream'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const OUTPUTS_ROOT = path.join(process.cwd(), 'outputs')

const MIME_BY_EXT: Record<string, string> = {
  '.wav':  'audio/wav',
  '.mp3':  'audio/mpeg',
  '.ogg':  'audio/ogg',
  '.flac': 'audio/flac',
  '.m4a':  'audio/mp4',
}

function mimeFor(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  return MIME_BY_EXT[ext] || 'application/octet-stream'
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return NextResponse.json({ error: 'invalid_filename' }, { status: 400 })
  }

  const filePath = path.join(OUTPUTS_ROOT, filename)

  try {
    const stat = await fs.stat(filePath)
    if (!stat.isFile()) {
      return NextResponse.json({ error: 'not_a_file' }, { status: 404 })
    }

    const contentType = mimeFor(filename)
    const range = req.headers.get('range')

    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range)
      if (match) {
        const start = match[1] ? parseInt(match[1], 10) : 0
        const end = match[2] ? parseInt(match[2], 10) : stat.size - 1
        if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= stat.size) {
          return new NextResponse('Invalid range', {
            status: 416,
            headers: { 'Content-Range': `bytes */${stat.size}` },
          })
        }
        const chunkSize = end - start + 1
        const stream = createReadStream(filePath, { start, end })
        const readable = Readable.toWeb(stream) as ReadableStream<Uint8Array>
        return new NextResponse(readable, {
          status: 206,
          headers: {
            'Content-Type': contentType,
            'Content-Length': String(chunkSize),
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-store',
          },
        })
      }
    }

    const stream = createReadStream(filePath)
    const readable = Readable.toWeb(stream) as ReadableStream<Uint8Array>
    return new NextResponse(readable, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(stat.size),
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '\\"')}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      return NextResponse.json({ error: 'not_found', filename }, { status: 404 })
    }
    console.error('[outputs] GET failed', err)
    return NextResponse.json({ error: 'failed_to_read' }, { status: 500 })
  }
}
