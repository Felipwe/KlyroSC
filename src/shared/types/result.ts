export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

export const ok = <T>(data: T): Result<T> => ({ ok: true, data })
export const err = <T = never>(error: string): Result<T> => ({ ok: false, error })

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (infer _U)[] ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K]
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
