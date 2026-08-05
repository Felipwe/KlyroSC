import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type PointerEvent as ReactPointerEvent
} from 'react'
import { createPortal } from 'react-dom'
import { clamp, cx } from '@renderer/utils/format'
import { Icon } from './Icon'

interface SliderProps {
  value: number
  max: number
  onChange(value: number): void
  ariaLabel: string
  className?: string
  step?: number
}

export function Slider({ value, max, onChange, ariaLabel, className, step = 0.01 }: SliderProps): JSX.Element {
  const safeMax = max > 0 ? max : 1
  const pct = clamp((value / safeMax) * 100, 0, 100)
  return (
    <input
      type="range"
      className={cx('slider', className)}
      min={0}
      max={safeMax}
      step={step}
      value={clamp(value, 0, safeMax)}
      aria-label={ariaLabel}
      style={{ '--pct': `${pct}%` } as CSSProperties}
      onChange={(event) => onChange(Number(event.currentTarget.value))}
    />
  )
}

interface SwitchProps {
  on: boolean
  onToggle(next: boolean): void
  ariaLabel: string
}

export function Switch({ on, onToggle, ariaLabel }: SwitchProps): JSX.Element {
  return (
    <button
      className={cx('switch', on && 'on')}
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      onClick={() => onToggle(!on)}
    />
  )
}

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  options: SelectOption[]
  onChange(value: string): void
  ariaLabel: string
}

export function Select({ value, options, onChange, ariaLabel }: SelectProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [placed, setPlaced] = useState<CSSProperties | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // the menu renders in a body portal with fixed positioning, so it can never be
  // clipped by scroll containers or cut off at the window edges — it flips and clamps
  useLayoutEffect(() => {
    if (!open) {
      setPlaced(null)
      return
    }
    const btn = btnRef.current
    const menu = menuRef.current
    if (!btn || !menu) return
    const rect = btn.getBoundingClientRect()
    // apply the final min-width BEFORE measuring: the CSS min-width:100% rule would
    // otherwise resolve against the body in the portal and inflate offsetWidth
    menu.style.minWidth = `${rect.width}px`
    const margin = 8
    const width = Math.max(menu.offsetWidth, rect.width)
    const height = menu.offsetHeight
    const left = clamp(rect.right - width, margin, Math.max(margin, window.innerWidth - width - margin))
    const fitsBelow = rect.bottom + 6 + height <= window.innerHeight - margin
    const fitsAbove = rect.top - 6 - height >= margin
    const up = !fitsBelow && fitsAbove
    const top = clamp(
      up ? rect.top - 6 - height : rect.bottom + 6,
      margin,
      Math.max(margin, window.innerHeight - height - margin)
    )
    setPlaced({
      left,
      top,
      minWidth: rect.width,
      transformOrigin: up ? 'bottom right' : 'top right'
    })
  }, [open, options.length])

  useEffect(() => {
    if (!open) return
    const closeMenu = (): void => setOpen(false)
    const onScroll = (event: Event): void => {
      if (menuRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    const onDown = (event: MouseEvent): void => {
      const target = event.target as Node
      if (!btnRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  const current = options.find((option) => option.value === value)

  return (
    <div className={cx('kselect', open && 'open')}>
      <button
        ref={btnRef}
        type="button"
        className="kselect-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((state) => !state)}
      >
        <span className="kselect-value">{current?.label ?? value}</span>
        <Icon name="chevronDown" size={14} className="kselect-caret" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="kselect-menu kselect-pop"
            role="listbox"
            style={placed ?? { visibility: 'hidden', left: 0, top: 0 }}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={cx('kselect-item', option.value === value && 'active')}
                onClick={() => {
                  setOpen(false)
                  if (option.value !== value) onChange(option.value)
                }}
              >
                <span>{option.label}</span>
                {option.value === value && <Icon name="check" size={14} />}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ColorPicker: custom glass popover replacing the native Chromium color input
// ---------------------------------------------------------------------------

interface Hsv {
  h: number
  s: number
  v: number
}

const HEX_RE = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i

export function normalizeHex(raw: string): string | null {
  const match = HEX_RE.exec(raw.trim())
  if (!match) return null
  let hex = (match[1] ?? '').toLowerCase()
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
  return `#${hex}`
}

function hexToHsv(hex: string): Hsv {
  const clean = normalizeHex(hex) ?? '#000000'
  const r = parseInt(clean.slice(1, 3), 16) / 255
  const g = parseInt(clean.slice(3, 5), 16) / 255
  const b = parseInt(clean.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: max === 0 ? 0 : d / max, v: max }
}

function hsvToHex({ h, s, v }: Hsv): string {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let rgb: [number, number, number]
  if (h < 60) rgb = [c, x, 0]
  else if (h < 120) rgb = [x, c, 0]
  else if (h < 180) rgb = [0, c, x]
  else if (h < 240) rgb = [0, x, c]
  else if (h < 300) rgb = [x, 0, c]
  else rgb = [c, 0, x]
  const to2 = (n: number): string =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${to2(rgb[0])}${to2(rgb[1])}${to2(rgb[2])}`
}

const PRESETS = [
  '#e23b4e',
  '#ff7847',
  '#f5c344',
  '#3ddc84',
  '#2fc6c8',
  '#3f8cff',
  '#7c5cff',
  '#ff5ea8',
  '#f2f4f8',
  '#0b0c12'
]

interface EyeDropperResult {
  sRGBHex: string
}

interface EyeDropperCtor {
  new (): { open(): Promise<EyeDropperResult> }
}

interface ColorPickerProps {
  label: string
  value: string
  onChange(next: string): void
  /** aria-label for the screen-color eyedropper button */
  eyedropperLabel?: string
}

export function ColorPicker({ label, value, onChange, eyedropperLabel }: ColorPickerProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [placed, setPlaced] = useState<CSSProperties | null>(null)
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value))
  const [hexDraft, setHexDraft] = useState(() => normalizeHex(value) ?? '#000000')
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const svRef = useRef<HTMLDivElement>(null)
  const hueRef = useRef<HTMLDivElement>(null)
  // hex we last emitted: external value echoes of our own edits must not reset hue/sat
  const emittedRef = useRef<string | null>(null)

  useEffect(() => {
    const normalized = normalizeHex(value)
    if (!normalized || normalized === emittedRef.current) return
    setHsv(hexToHsv(normalized))
    setHexDraft(normalized)
  }, [value])

  const commit = (next: Hsv): void => {
    setHsv(next)
    const hex = hsvToHex(next)
    setHexDraft(hex)
    emittedRef.current = hex
    onChange(hex)
  }

  const commitHex = (hex: string): void => {
    setHsv(hexToHsv(hex))
    setHexDraft(hex)
    emittedRef.current = hex
    onChange(hex)
  }

  useLayoutEffect(() => {
    if (!open) {
      setPlaced(null)
      return
    }
    const btn = btnRef.current
    const pop = popRef.current
    if (!btn || !pop) return
    const rect = btn.getBoundingClientRect()
    const margin = 8
    const width = pop.offsetWidth
    const height = pop.offsetHeight
    const left = clamp(rect.right - width, margin, Math.max(margin, window.innerWidth - width - margin))
    const fitsBelow = rect.bottom + 6 + height <= window.innerHeight - margin
    const fitsAbove = rect.top - 6 - height >= margin
    const up = !fitsBelow && fitsAbove
    const top = clamp(
      up ? rect.top - 6 - height : rect.bottom + 6,
      margin,
      Math.max(margin, window.innerHeight - height - margin)
    )
    setPlaced({ left, top, transformOrigin: up ? 'bottom right' : 'top right' })
  }, [open])

  useEffect(() => {
    if (!open) return
    const closePop = (): void => setOpen(false)
    const onScroll = (event: Event): void => {
      if (popRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    const onDown = (event: MouseEvent): void => {
      const target = event.target as Node
      if (!btnRef.current?.contains(target) && !popRef.current?.contains(target)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', closePop)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', closePop)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  const dragSv = (event: ReactPointerEvent): void => {
    const area = svRef.current
    if (!area) return
    area.setPointerCapture(event.pointerId)
    const { h } = hsv // hue is fixed while dragging the sat/val pad
    const update = (clientX: number, clientY: number): void => {
      const rect = area.getBoundingClientRect()
      const s = clamp((clientX - rect.left) / rect.width, 0, 1)
      const v = 1 - clamp((clientY - rect.top) / rect.height, 0, 1)
      commit({ h, s, v })
    }
    update(event.clientX, event.clientY)
    const move = (e: PointerEvent): void => update(e.clientX, e.clientY)
    const upHandler = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', upHandler)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', upHandler)
  }

  const dragHue = (event: ReactPointerEvent): void => {
    const bar = hueRef.current
    if (!bar) return
    bar.setPointerCapture(event.pointerId)
    const { s, v } = hsv // sat/val fixed while dragging the hue bar
    const update = (clientX: number): void => {
      const rect = bar.getBoundingClientRect()
      const h = clamp((clientX - rect.left) / rect.width, 0, 1) * 360
      commit({ h, s, v })
    }
    update(event.clientX)
    const move = (e: PointerEvent): void => update(e.clientX)
    const upHandler = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', upHandler)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', upHandler)
  }

  const pickFromScreen = async (): Promise<void> => {
    const ctor = (window as { EyeDropper?: EyeDropperCtor }).EyeDropper
    if (!ctor) return
    try {
      const result = await new ctor().open()
      const hex = normalizeHex(result.sRGBHex)
      if (hex) commitHex(hex)
    } catch {
      // user cancelled the eyedropper
    }
  }

  const hex = hsvToHex(hsv)
  const hueColor = hsvToHex({ h: hsv.h, s: 1, v: 1 })

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={cx('color-field', open && 'open')}
        title={label}
        onClick={() => setOpen((state) => !state)}
      >
        <span className="cf-swatch" style={{ background: hex }} />
        <span className="cf-label">{label}</span>
      </button>
      {open &&
        createPortal(
          <div
            ref={popRef}
            className="cpick kselect-pop"
            role="dialog"
            aria-label={label}
            style={placed ?? { visibility: 'hidden', left: 0, top: 0 }}
          >
            <div
              ref={svRef}
              className="cpick-sv"
              style={{ backgroundColor: hueColor }}
              onPointerDown={dragSv}
            >
              <span
                className="cpick-thumb"
                style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex }}
              />
            </div>
            <div className="cpick-hue-row">
              <span className="cpick-preview" style={{ background: hex }} />
              <div ref={hueRef} className="cpick-hue" onPointerDown={dragHue}>
                <span
                  className="cpick-thumb"
                  style={{ left: `${(hsv.h / 360) * 100}%`, top: '50%', background: hueColor }}
                />
              </div>
            </div>
            <div className="cpick-hex-row">
              <input
                className="cpick-hex"
                value={hexDraft}
                spellCheck={false}
                onChange={(event) => {
                  const raw = event.currentTarget.value
                  setHexDraft(raw)
                  const parsed = normalizeHex(raw)
                  if (parsed) commitHex(parsed)
                }}
                onBlur={() => setHexDraft(hex)}
                aria-label={label}
              />
              {'EyeDropper' in window && (
                <button
                  type="button"
                  className="icon-btn cpick-drop"
                  title={eyedropperLabel}
                  aria-label={eyedropperLabel ?? 'Pick color from screen'}
                  onClick={() => void pickFromScreen()}
                >
                  <Icon name="eyedropper" size={14} />
                </button>
              )}
            </div>
            <div className="cpick-presets">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={cx('cpick-preset', preset === hex && 'active')}
                  style={{ background: preset }}
                  title={preset}
                  onClick={() => commitHex(preset)}
                />
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
