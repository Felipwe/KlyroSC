import iconUrl from '../assets/icon.png'

const hueOf = (hex: string): number => {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d === 0) return 0
  let h: number
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return (h * 60 + 360) % 360
}

// brand icon hue (KlyroSC red); tinting rotates from here to the target accent
const BASE_HUE = 353

let baseImage: Promise<HTMLImageElement> | null = null

const loadBase = (): Promise<HTMLImageElement> => {
  baseImage ??= new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('icon asset failed to load'))
    img.src = iconUrl
  })
  return baseImage
}

/** Renders the app icon, optionally hue-shifted toward the given accent color. */
export async function buildAppIcon(accentHex: string | null): Promise<string | null> {
  try {
    const img = await loadBase()
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    if (accentHex) {
      const delta = Math.round(hueOf(accentHex) - BASE_HUE)
      ctx.filter = `hue-rotate(${delta}deg)`
    }
    ctx.drawImage(img, 0, 0, 256, 256)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}
