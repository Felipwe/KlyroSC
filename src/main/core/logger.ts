import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

type Level = 'debug' | 'info' | 'warn' | 'error'

const MAX_SIZE = 1024 * 1024
const KEEP = 2

class Logger {
  private file: string | null = null
  private stream: fs.WriteStream | null = null

  init(): void {
    try {
      const dir = path.join(app.getPath('userData'), 'logs')
      fs.mkdirSync(dir, { recursive: true })
      this.file = path.join(dir, 'klyrosc.log')
      this.rotateIfNeeded()
      this.stream = fs.createWriteStream(this.file, { flags: 'a' })
    } catch {
      this.file = null
    }
  }

  private rotateIfNeeded(): void {
    if (!this.file) return
    try {
      const stat = fs.statSync(this.file)
      if (stat.size < MAX_SIZE) return
      for (let i = KEEP; i >= 1; i--) {
        const from = i === 1 ? this.file : `${this.file}.${i - 1}`
        const to = `${this.file}.${i}`
        if (fs.existsSync(from)) fs.renameSync(from, to)
      }
    } catch {
      /* first run or locked file */
    }
  }

  write(level: Level, scope: string, message: string): void {
    const line = `${new Date().toISOString()} [${level.toUpperCase().padEnd(5)}] [${scope}] ${message}`
    if (level === 'error') console.error(line)
    else if (level === 'warn') console.warn(line)
    else console.log(line)
    this.stream?.write(line + '\n')
  }

  scope(name: string): ScopedLogger {
    return new ScopedLogger(this, name)
  }

  close(): void {
    this.stream?.end()
    this.stream = null
  }
}

export class ScopedLogger {
  constructor(
    private readonly logger: Logger,
    private readonly name: string
  ) {}

  debug(message: string): void {
    this.logger.write('debug', this.name, message)
  }

  info(message: string): void {
    this.logger.write('info', this.name, message)
  }

  warn(message: string): void {
    this.logger.write('warn', this.name, message)
  }

  error(message: string, cause?: unknown): void {
    const suffix = cause instanceof Error ? ` :: ${cause.message}` : cause ? ` :: ${String(cause)}` : ''
    this.logger.write('error', this.name, message + suffix)
  }
}

export const logger = new Logger()
