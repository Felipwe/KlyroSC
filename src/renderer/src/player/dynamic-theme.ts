import { usePlayer } from './store'
import { useSettings } from '@renderer/stores/settings'

const ART_PROPS = [
  '--art-bg',
  '--accent-a',
  '--accent-b',
  '--accent-gradient',
  '--accent-soft',
  '--accent-text',
  '--glow'
]

const FALLBACK: [string, string] = ['#8b5cf6', '#22d3ee']

let initialized = false
let appliedArtwork: string | null = null

const hslToHex = (h: number, s: number, l: number): string => {
  const f = (n: number): string => {
    const k = (n + h / 30) % 12
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/** Average hue/saturation of the vibrant pixels; falls back for grey or tainted covers. */
async function paletteFrom(url: string): Promise<[string, string]> {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = url
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return FALLBACK
  ctx.drawImage(img, 0, 0, 32, 32)
  const { data } = ctx.getImageData(0, 0, 32, 32)
  let x = 0
  let y = 0
  let satSum = 0
  let count = 0
  for (let i = 0; i < data.length; i += 4) {
    const r = (data[i] ?? 0) / 255
    const g = (data[i + 1] ?? 0) / 255
    const b = (data[i + 2] ?? 0) / 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const l = (max + min) / 2
    const d = max - min
    if (d < 0.09 || l < 0.14 || l > 0.9) continue
    const s = d / (1 - Math.abs(2 * l - 1))
    let h: number
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h = (h * 60 + 360) % 360
    const rad = (h * Math.PI) / 180
    const weight = s
    x += Math.cos(rad) * weight
    y += Math.sin(rad) * weight
    satSum += s
    count++
  }
  if (count < 40) return FALLBACK
  const hue = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
  const sat = Math.min(0.78, Math.max(0.5, satSum / count))
  return [hslToHex(hue, sat, 0.56), hslToHex((hue + 26) % 360, Math.min(0.8, sat + 0.08), 0.66)]
}

function clearArtTheme(): void {
  const root = document.documentElement
  for (const prop of ART_PROPS) root.style.removeProperty(prop)
  appliedArtwork = null
}

async function applyArtTheme(): Promise<void> {
  const settings = useSettings.getState().settings
  if (settings.appearance.accent !== 'art') return
  const track = usePlayer.getState().current
  const artwork = track?.artwork ?? null
  if (artwork === appliedArtwork) return
  appliedArtwork = artwork

  const root = document.documentElement
  let colors = FALLBACK
  if (artwork) {
    let extracted = false
    try {
      // decode + palette BEFORE swapping so the background never flashes empty
      colors = await paletteFrom(artwork)
      extracted = true
    } catch {
      colors = FALLBACK
    }
    if (appliedArtwork !== artwork || useSettings.getState().settings.appearance.accent !== 'art') return
    // a failed extraction stays uncached so the next event retries
    if (!extracted) appliedArtwork = null
    root.style.setProperty('--art-bg', `url("${artwork}")`)
  } else {
    root.style.removeProperty('--art-bg')
  }

  const [a, b] = colors
  const rgb = {
    r: parseInt(a.slice(1, 3), 16),
    g: parseInt(a.slice(3, 5), 16),
    b: parseInt(a.slice(5, 7), 16)
  }
  root.style.setProperty('--accent-a', a)
  root.style.setProperty('--accent-b', b)
  root.style.setProperty('--accent-gradient', `linear-gradient(135deg, ${a}, ${b})`)
  root.style.setProperty('--accent-soft', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.17)`)
  root.style.setProperty('--accent-text', `color-mix(in srgb, ${a} 46%, #ffffff)`)
  root.style.setProperty('--glow', `0 0 44px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22)`)
}

export function initDynamicTheme(): void {
  if (initialized) return
  initialized = true

  usePlayer.subscribe((state, previous) => {
    if (state.current?.artwork !== previous.current?.artwork) void applyArtTheme()
  })

  useSettings.subscribe((state, previous) => {
    if (state.settings.appearance.accent === previous.settings.appearance.accent) return
    if (state.settings.appearance.accent === 'art') {
      appliedArtwork = null
      void applyArtTheme()
    } else if (state.settings.appearance.accent === 'custom') {
      // custom now owns the accent vars; only drop the artwork background
      document.documentElement.style.removeProperty('--art-bg')
      appliedArtwork = null
    } else {
      clearArtTheme()
    }
  })

  void applyArtTheme()
}
