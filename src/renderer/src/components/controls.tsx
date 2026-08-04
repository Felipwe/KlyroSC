import { useEffect, useRef, useState, type CSSProperties, type JSX } from 'react'
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
  const [up, setUp] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent): void => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = (): void => {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setUp(rect.bottom + Math.min(options.length, 6) * 38 + 20 > window.innerHeight)
    }
    setOpen((state) => !state)
  }

  const current = options.find((option) => option.value === value)

  return (
    <div className={cx('kselect', open && 'open')} ref={ref}>
      <button
        type="button"
        className="kselect-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={toggle}
      >
        <span className="kselect-value">{current?.label ?? value}</span>
        <Icon name="chevronDown" size={14} className="kselect-caret" />
      </button>
      {open && (
        <div className={cx('kselect-menu glass', up && 'up')} role="listbox">
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
        </div>
      )}
    </div>
  )
}
