import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type JSX } from 'react'
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
