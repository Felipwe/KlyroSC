export const EQ_BAND_COUNT = 10
export const EQ_GAIN_LIMIT = 12
export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const

export interface EqCustomPreset {
  name: string
  gains: number[]
}

export interface EqState {
  enabled: boolean
  preamp: number
  gains: number[]
  custom: EqCustomPreset[]
}

export const EQ_FLAT: readonly number[] = Object.freeze(new Array<number>(EQ_BAND_COUNT).fill(0))

/** Built-in presets. Gains in dB, one per band, low → high. */
export const EQ_PRESETS: { id: string; gains: number[] }[] = [
  { id: 'flat', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 'rock', gains: [5, 3.5, -3, -4.5, -2, 2.5, 5.5, 6.5, 6.5, 6.5] },
  { id: 'pop', gains: [-1, 2.5, 4.5, 4.5, 3, -1, -1.5, -1.5, -1, -1] },
  { id: 'bass', gains: [7, 6.5, 6, 4, 1, -1.5, -3.5, -5, -5.5, -5.5] },
  { id: 'bassTreble', gains: [5, 4, 0, -4, -3, 1, 5, 6.5, 7, 7] },
  { id: 'treble', gains: [-5, -5, -4.5, -2, 1.5, 6, 8.5, 9.5, 9.5, 10] },
  { id: 'electronic', gains: [4.5, 4, 1, 0, -2, 2, 1, 1.5, 4, 5] },
  { id: 'hiphop', gains: [5, 4.5, 1.5, 3, -1, -1, 1.5, -0.5, 2, 3] },
  { id: 'dance', gains: [6, 4.5, 1.5, 0, 0, -3, -4, -4, 0, 0] },
  { id: 'jazz', gains: [2.5, 1.5, 1, 1.5, -1.5, -1.5, 0, 1, 2, 3] },
  { id: 'classical', gains: [0, 0, 0, 0, 0, 0, -4, -4, -4, -5.5] },
  { id: 'vocal', gains: [-3, -2, -1, 1.5, 4, 4, 3, 1.5, 0, -1.5] },
  { id: 'acoustic', gains: [4.5, 4.5, 3.5, 1, 2, 2, 3.5, 4, 3.5, 2] },
  { id: 'lounge', gains: [-3, -1.5, -0.5, 1.5, 4, 2.5, 0, -1.5, 2, 1] },
  { id: 'loudness', gains: [6, 4, 0, 0, -2, 0, -1, -4, 5, 1] }
]

const clampGain = (value: number): number =>
  Math.min(EQ_GAIN_LIMIT, Math.max(-EQ_GAIN_LIMIT, Math.round(value * 10) / 10))

export function sanitizeEqGains(raw: unknown): number[] {
  const source = Array.isArray(raw) ? raw : []
  const gains: number[] = []
  for (let i = 0; i < EQ_BAND_COUNT; i++) {
    const value = source[i]
    gains.push(typeof value === 'number' && Number.isFinite(value) ? clampGain(value) : 0)
  }
  return gains
}

export const gainsEqual = (a: number[], b: number[]): boolean =>
  a.length === b.length && a.every((value, i) => Math.abs(value - (b[i] ?? 0)) < 0.05)

/** Returns the built-in preset id or custom preset name matching the gains, else null. */
export function matchEqPreset(gains: number[], custom: EqCustomPreset[]): string | null {
  for (const preset of custom) {
    if (gainsEqual(gains, preset.gains)) return `custom:${preset.name}`
  }
  for (const preset of EQ_PRESETS) {
    if (gainsEqual(gains, preset.gains)) return preset.id
  }
  return null
}
