import fs from 'node:fs'
import path from 'node:path'
import { logger } from './logger'

const log = logger.scope('store')

export class JsonStore<T> {
  private data: T
  private timer: NodeJS.Timeout | null = null

  constructor(
    private readonly file: string,
    private readonly parse: (raw: unknown) => T,
    private readonly debounceMs = 400
  ) {
    this.data = this.readFromDisk()
  }

  private readFromDisk(): T {
    try {
      const raw = fs.readFileSync(this.file, 'utf8')
      return this.parse(JSON.parse(raw))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        log.warn(`could not read ${path.basename(this.file)}, using defaults`)
      return this.parse(undefined)
    }
  }

  get(): T {
    return this.data
  }

  set(data: T): void {
    this.data = data
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.flush(), this.debounceMs)
  }

  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true })
      const tmp = `${this.file}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8')
      fs.renameSync(tmp, this.file)
    } catch (error) {
      log.error(`failed writing ${path.basename(this.file)}`, error)
    }
  }
}
