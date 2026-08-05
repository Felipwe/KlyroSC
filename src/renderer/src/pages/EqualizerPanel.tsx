import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react'
import {
  EQ_FLAT,
  EQ_FREQUENCIES,
  EQ_GAIN_LIMIT,
  EQ_PRESETS,
  matchEqPreset,
  sanitizeEqGains,
  type EqCustomPreset
} from '@shared/utils/eq'
import { t, useLanguage } from '@renderer/i18n'
import { api } from '@renderer/services/ipc'
import { useSettings } from '@renderer/stores/settings'
import { useUi } from '@renderer/stores/ui'
import { toast } from '@renderer/stores/toasts'
import { applyEqLive } from '@renderer/player/store'
import { clamp, cx } from '@renderer/utils/format'
import { Icon } from '@renderer/components/Icon'
import { Select, Switch } from '@renderer/components/controls'
import { SettingRow } from './SettingsPage'

const CUSTOM_VALUE = '__custom'
const CUSTOM_PREFIX = 'custom:'

const freqLabel = (freq: number): string => (freq >= 1000 ? `${freq / 1000}K` : String(freq))

const formatDb = (value: number): string =>
  `${value > 0 ? '+' : ''}${(Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, '')}`

function VerticalSlider({
  value,
  onChange,
  label,
  ariaLabel,
  accent
}: {
  value: number
  onChange(next: number): void
  label: string
  ariaLabel: string
  accent?: boolean
}): JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null)

  const valueFromPointer = useCallback((clientY: number): number => {
    const track = trackRef.current
    if (!track) return 0
    const rect = track.getBoundingClientRect()
    const ratio = clamp(1 - (clientY - rect.top) / rect.height, 0, 1)
    let next = ratio * EQ_GAIN_LIMIT * 2 - EQ_GAIN_LIMIT
    next = Math.round(next * 2) / 2
    if (Math.abs(next) < 0.5) next = 0
    return next
  }, [])

  const pct = ((value + EQ_GAIN_LIMIT) / (EQ_GAIN_LIMIT * 2)) * 100

  return (
    <div className={cx('eq-band', accent && 'preamp')}>
      <span className="eq-band-value">{formatDb(value)}</span>
      <div
        ref={trackRef}
        className="eq-track"
        role="slider"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-valuemin={-EQ_GAIN_LIMIT}
        aria-valuemax={EQ_GAIN_LIMIT}
        aria-valuenow={value}
        aria-valuetext={`${formatDb(value)} dB`}
        onPointerDown={(event) => {
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
          onChange(valueFromPointer(event.clientY))
        }}
        onPointerMove={(event) => {
          if (event.buttons > 0 && event.currentTarget.hasPointerCapture(event.pointerId))
            onChange(valueFromPointer(event.clientY))
        }}
        onDoubleClick={() => onChange(0)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            onChange(clamp(value + 0.5, -EQ_GAIN_LIMIT, EQ_GAIN_LIMIT))
          } else if (event.key === 'ArrowDown') {
            event.preventDefault()
            onChange(clamp(value - 0.5, -EQ_GAIN_LIMIT, EQ_GAIN_LIMIT))
          } else if (event.key === '0' || event.key === 'Delete') {
            onChange(0)
          }
        }}
      >
        <div className="eq-rail" />
        <div
          className="eq-fill"
          style={
            value >= 0
              ? { bottom: '50%', height: `${pct - 50}%` }
              : { top: '50%', height: `${50 - pct}%` }
          }
        />
        <div className="eq-thumb" style={{ bottom: `calc(${pct}% - 7px)` }} />
      </div>
      <span className="eq-band-freq">{label}</span>
    </div>
  )
}

function EqCurve({ gains }: { gains: number[] }): JSX.Element {
  const path = useMemo(() => {
    const points = gains.map((gain, i) => {
      const x = ((i + 0.5) / gains.length) * 100
      const y = 50 - (clamp(gain, -EQ_GAIN_LIMIT, EQ_GAIN_LIMIT) / EQ_GAIN_LIMIT) * 42
      return { x, y }
    })
    if (points.length === 0) return { line: '', area: '' }
    const first = points[0] as { x: number; y: number }
    const last = points[points.length - 1] as { x: number; y: number }
    let d = `M 0 ${first.y.toFixed(2)} L ${first.x.toFixed(2)} ${first.y.toFixed(2)}`
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1] as { x: number; y: number }
      const point = points[i] as { x: number; y: number }
      const midX = (prev.x + point.x) / 2
      d += ` C ${midX.toFixed(2)} ${prev.y.toFixed(2)}, ${midX.toFixed(2)} ${point.y.toFixed(2)}, ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    }
    d += ` L 100 ${last.y.toFixed(2)}`
    return { line: d, area: `${d} L 100 100 L 0 100 Z` }
  }, [gains])

  return (
    <svg className="eq-curve" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="eq-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-a)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--accent-b)" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="eq-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--accent-a)" />
          <stop offset="100%" stopColor="var(--accent-b)" />
        </linearGradient>
      </defs>
      <path d={path.area} fill="url(#eq-area)" stroke="none" />
      <path d={path.line} fill="none" stroke="url(#eq-line)" strokeWidth="1.1" vectorEffect="non-scaling-stroke" />
      <line x1="0" y1="50" x2="100" y2="50" className="eq-zero" />
    </svg>
  )
}

export function EqualizerPanel(): JSX.Element {
  useLanguage()
  const eq = useSettings((state) => state.settings.eq)
  const [gains, setGains] = useState<number[]>(() => [...eq.gains])
  const [preamp, setPreamp] = useState(eq.preamp)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // adopt external changes (import, reset) unless a local edit is pending persistence
  useEffect(() => {
    if (persistTimer.current) return
    setGains([...eq.gains])
    setPreamp(eq.preamp)
  }, [eq])

  useEffect(
    () => () => {
      if (persistTimer.current) clearTimeout(persistTimer.current)
    },
    []
  )

  const persist = (nextGains: number[], nextPreamp: number): void => {
    if (persistTimer.current) clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(() => {
      persistTimer.current = null
      void useSettings.getState().update({ eq: { gains: nextGains, preamp: nextPreamp } })
    }, 350)
  }

  const applyLive = (nextGains: number[], nextPreamp: number): void => {
    applyEqLive({ enabled: eq.enabled, preamp: nextPreamp, gains: nextGains, custom: eq.custom })
  }

  const changeBand = (index: number, value: number): void => {
    setGains((current) => {
      const next = [...current]
      next[index] = value
      applyLive(next, preamp)
      persist(next, preamp)
      return next
    })
  }

  const changePreamp = (value: number): void => {
    setPreamp(value)
    applyLive(gains, value)
    persist(gains, value)
  }

  const setAllGains = (next: number[]): void => {
    setGains(next)
    applyLive(next, preamp)
    persist(next, preamp)
  }

  const matched = matchEqPreset(gains, eq.custom)
  const isCustomSelection = matched?.startsWith(CUSTOM_PREFIX) ?? false

  const presetOptions = [
    ...(matched === null ? [{ value: CUSTOM_VALUE, label: t('settings.eq.customNow') }] : []),
    ...EQ_PRESETS.map((preset) => ({
      value: preset.id,
      label: t(`settings.eq.presets.${preset.id}`)
    })),
    ...eq.custom.map((preset) => ({
      value: `${CUSTOM_PREFIX}${preset.name}`,
      label: `★ ${preset.name}`
    }))
  ]

  const applyPreset = (value: string): void => {
    if (value === CUSTOM_VALUE) return
    const source = value.startsWith(CUSTOM_PREFIX)
      ? eq.custom.find((preset) => preset.name === value.slice(CUSTOM_PREFIX.length))?.gains
      : EQ_PRESETS.find((preset) => preset.id === value)?.gains
    if (source) setAllGains(sanitizeEqGains(source))
  }

  const savePreset = (): void =>
    useUi.getState().openModal({
      kind: 'prompt',
      title: t('settings.eq.saveTitle'),
      placeholder: t('settings.eq.savePlaceholder'),
      confirmLabel: t('common.save'),
      onConfirm: (raw) => {
        const name = raw.trim().slice(0, 40)
        if (!name) return
        const next: EqCustomPreset[] = [
          ...eq.custom.filter((preset) => preset.name.toLowerCase() !== name.toLowerCase()),
          { name, gains: [...gains] }
        ]
        void useSettings.getState().update({ eq: { custom: next, gains, preamp } })
        toast(t('settings.eq.saved', { name }), 'success')
      }
    })

  const deletePreset = (): void => {
    if (!matched?.startsWith(CUSTOM_PREFIX)) return
    const name = matched.slice(CUSTOM_PREFIX.length)
    useUi.getState().openModal({
      kind: 'confirm',
      title: t('settings.eq.deleteTitle'),
      body: t('settings.eq.deleteConfirm', { name }),
      danger: true,
      confirmLabel: t('common.delete'),
      onConfirm: () => {
        const next = eq.custom.filter((preset) => preset.name !== name)
        void useSettings.getState().update({ eq: { custom: next } })
        toast(t('settings.eq.deleted', { name }))
      }
    })
  }

  const exportPreset = async (): Promise<void> => {
    const name = matched?.startsWith(CUSTOM_PREFIX)
      ? matched.slice(CUSTOM_PREFIX.length)
      : matched
        ? t(`settings.eq.presets.${matched}`)
        : t('settings.eq.customNow')
    const result = await api.eq.exportPreset({ name, preamp, gains })
    if (result.ok && result.data) toast(t('settings.eq.exported'), 'success')
    else if (!result.ok) toast(t('settings.eq.exportFailed', { error: result.error }), 'error')
  }

  const importPreset = async (): Promise<void> => {
    const result = await api.eq.importPreset()
    if (result.ok && result.data) toast(t('settings.eq.imported', { name: result.data.name }), 'success')
    else if (!result.ok) toast(t('settings.eq.importFailed', { error: result.error }), 'error')
  }

  return (
    <>
      <SettingRow label={t('settings.eq.enable')} desc={t('settings.eq.enableDesc')}>
        <Switch
          on={eq.enabled}
          ariaLabel={t('settings.eq.enable')}
          onToggle={(on) => {
            applyEqLive({ enabled: on, preamp, gains, custom: eq.custom })
            void useSettings.getState().update({ eq: { enabled: on } })
          }}
        />
      </SettingRow>

      <SettingRow label={t('settings.eq.preset')} desc={t('settings.eq.presetDesc')}>
        <div className="eq-preset-row">
          {isCustomSelection && (
            <button
              className="icon-btn"
              title={t('settings.eq.deleteTitle')}
              aria-label={t('settings.eq.deleteTitle')}
              onClick={deletePreset}
            >
              <Icon name="trash" size={15} />
            </button>
          )}
          <Select
            value={matched ?? CUSTOM_VALUE}
            ariaLabel={t('settings.eq.preset')}
            options={presetOptions}
            onChange={applyPreset}
          />
        </div>
      </SettingRow>

      <div className={cx('eq-board card', !eq.enabled && 'disabled')}>
        <div className="eq-scale">
          <span>+{EQ_GAIN_LIMIT}</span>
          <span>0</span>
          <span>-{EQ_GAIN_LIMIT}</span>
        </div>
        <VerticalSlider
          value={preamp}
          onChange={changePreamp}
          label={t('settings.eq.preampShort')}
          ariaLabel={t('settings.eq.preamp')}
          accent
        />
        <div className="eq-divider" />
        <div className="eq-bands">
          <EqCurve gains={gains} />
          {gains.map((gain, index) => (
            <VerticalSlider
              key={EQ_FREQUENCIES[index] ?? index}
              value={gain}
              onChange={(value) => changeBand(index, value)}
              label={freqLabel(EQ_FREQUENCIES[index] ?? 0)}
              ariaLabel={`${EQ_FREQUENCIES[index] ?? 0} Hz`}
            />
          ))}
        </div>
      </div>

      <div className="eq-actions">
        <button className="btn primary" onClick={savePreset}>
          <Icon name="plus" size={15} />
          {t('settings.eq.saveAs')}
        </button>
        <button className="btn" onClick={() => setAllGains([...EQ_FLAT])}>
          <Icon name="refresh" size={15} />
          {t('settings.eq.reset')}
        </button>
        <button className="btn" onClick={() => void exportPreset()}>
          <Icon name="download" size={15} />
          {t('settings.eq.export')}
        </button>
        <button className="btn" onClick={() => void importPreset()}>
          <Icon name="folder" size={15} />
          {t('settings.eq.import')}
        </button>
      </div>
      <p className="settings-section-desc">{t('settings.eq.hint')}</p>
    </>
  )
}
