import fs from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { type ReadableStream as WebReadableStream } from 'node:stream/web'
import { ensureDir, paths } from '../core/paths'
import { logger } from '../core/logger'
import { type SoundCloudApi } from './soundcloud/api'

const log = logger.scope('downloads')

const FORBIDDEN = new Set('<>:"/\\|?*')

function sanitizeFileName(name: string): string {
  let out = ''
  for (const ch of name) {
    if (ch.charCodeAt(0) < 32 || FORBIDDEN.has(ch)) continue
    out += ch
  }
  out = out.replace(/\s+/g, ' ').trim().slice(0, 140)
  return out || 'track'
}

export async function downloadTrack(
  sc: SoundCloudApi,
  trackId: number,
  title: string
): Promise<string> {
  const source = await sc.stream(trackId, 'progressive')
  if (source.protocol !== 'progressive') throw new Error('track has no downloadable stream')

  const res = await fetch(source.url, { signal: AbortSignal.timeout(120000) })
  if (!res.ok || !res.body) throw new Error(`download failed with status ${res.status}`)

  const dir = ensureDir(paths.downloadsDir())
  const file = path.join(dir, `${sanitizeFileName(title)}.mp3`)
  await pipeline(Readable.fromWeb(res.body as unknown as WebReadableStream), fs.createWriteStream(file))
  log.info(`downloaded ${path.basename(file)}`)
  return file
}
