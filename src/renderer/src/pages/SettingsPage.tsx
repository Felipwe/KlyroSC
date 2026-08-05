import { useState, type CSSProperties, type JSX, type ReactNode } from 'react'
import { t, useLanguage } from '@renderer/i18n'
import { useSettings } from '@renderer/stores/settings'
import { usePlayer } from '@renderer/player/store'
import { cx } from '@renderer/utils/format'
import { Icon, type IconName } from '@renderer/components/Icon'
import { Select, Switch } from '@renderer/components/controls'
import { toast } from '@renderer/stores/toasts'
import { type AccentId } from '@shared/types/settings'
import yagamiBg from '../assets/yagami-bg.png'
import { PluginsPanel, UpdatesPanel, DataPanel, AboutPanel, ShortcutsPanel, AccountPanel } from './settings-panels'
import { EqualizerPanel } from './EqualizerPanel'
import { ThemeStudio } from './ThemeStudio'

const SECTIONS: { id: string; icon: IconName }[] = [
  { id: 'account', icon: 'user' },
  { id: 'appearance', icon: 'sparkle' },
  { id: 'language', icon: 'globe' },
  { id: 'playback', icon: 'playCircle' },
  { id: 'equalizer', icon: 'sliders' },
  { id: 'discord', icon: 'activity' },
  { id: 'plugins', icon: 'plug' },
  { id: 'updates', icon: 'refresh' },
  { id: 'performance', icon: 'gauge' },
  { id: 'startup', icon: 'power' },
  { id: 'data', icon: 'folder' },
  { id: 'shortcuts', icon: 'keyboard' },
  { id: 'about', icon: 'info' }
]

export function SettingRow({
  label,
  desc,
  children
}: {
  label: string
  desc?: string
  children: ReactNode
}): JSX.Element {
  return (
    <div className="setting-row">
      <div className="sr-text">
        <div className="sr-label">{label}</div>
        {desc && <div className="sr-desc">{desc}</div>}
      </div>
      <div className="sr-control">{children}</div>
    </div>
  )
}

const ACCENTS: { id: AccentId; colors: [string, string] }[] = [
  { id: 'art', colors: ['#8b5cf6', '#22d3ee'] },
  { id: 'yagami', colors: ['#b31423', '#e5484d'] },
  { id: 'custom', colors: ['#8b5cf6', '#22d3ee'] }
]

function ThemePicker(): JSX.Element {
  const { settings, update } = useSettings()
  const artwork = usePlayer((state) => state.current?.artwork ?? null)

  const canvasStyle = (id: AccentId): CSSProperties => {
    if (id === 'art') {
      return artwork
        ? { backgroundImage: `url("${artwork}")` }
        : { background: 'linear-gradient(135deg, #241543, #0b2436 70%, #0a1a2c)' }
    }
    if (id === 'yagami') return { backgroundImage: `url(${yagamiBg})`, backgroundPosition: 'center 30%' }
    const custom = settings.appearance.custom
    return custom.background
      ? { backgroundImage: `url("${custom.background}")` }
      : { background: custom.bgColor }
  }

  const gradient = (id: AccentId): string => {
    // the art card mirrors the live extracted accent while it is the active theme
    if (id === 'art' && settings.appearance.accent === 'art') return 'var(--accent-gradient)'
    const colors =
      id === 'custom'
        ? [settings.appearance.custom.colorA, settings.appearance.custom.colorB]
        : (ACCENTS.find((accent) => accent.id === id)?.colors ?? ACCENTS[0]!.colors)
    return `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`
  }

  return (
    <div className="theme-cards">
      {ACCENTS.map(({ id }) => {
        const active = settings.appearance.accent === id
        return (
          <button
            key={id}
            className={cx('theme-card', active && 'active')}
            onClick={() => void update({ appearance: { accent: id } })}
          >
            <span className={cx('tc-canvas', id === 'art' && 'blurred')} style={canvasStyle(id)}>
              <span className="tc-veil" />
              <span className="tc-side" />
              <span className="tc-line long" style={{ background: gradient(id) }} />
              <span className="tc-line" />
              <span className="tc-player">
                <i style={{ background: gradient(id) }} />
              </span>
            </span>
            <span className="tc-label">
              {t(`settings.appearance.accents.${id}`)}
              {active && <Icon name="check" size={13} />}
            </span>
            <span className="tc-hint">{t(`settings.appearance.accentHints.${id}`)}</span>
          </button>
        )
      })}
    </div>
  )
}

export function SettingsPage({ initialSection }: { initialSection?: string }): JSX.Element {
  useLanguage()
  const [section, setSection] = useState(
    SECTIONS.some((item) => item.id === initialSection) ? (initialSection as string) : 'appearance'
  )
  const { settings, update } = useSettings()

  return (
    <div className="page">
      <h1 className="page-title">{t('settings.title')}</h1>
      <p className="page-sub" />
      <div className="settings-layout">
        <nav className="settings-nav">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              className={cx(section === item.id && 'active')}
              onClick={() => setSection(item.id)}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                <Icon name={item.icon} size={15} />
                {t(`settings.sections.${item.id}`)}
              </span>
            </button>
          ))}
        </nav>

        <div className="settings-body" key={section}>
          <h2 className="settings-section-title">{t(`settings.sections.${section}`)}</h2>

          {section === 'account' && <AccountPanel />}

          {section === 'equalizer' && <EqualizerPanel />}

          {section === 'appearance' && (
            <>
              <div className="sr-text" style={{ marginBottom: 12 }}>
                <div className="sr-label">{t('settings.appearance.accent')}</div>
                <div className="sr-desc">{t('settings.appearance.accentDesc')}</div>
              </div>
              <ThemePicker />
              {settings.appearance.accent === 'custom' && <ThemeStudio />}
              {settings.appearance.accent === 'custom' && <ThemeStudio />}
              <SettingRow label={t('settings.appearance.glass')} desc={t('settings.appearance.glassDesc')}>
                <Select
                  value={settings.appearance.glass}
                  ariaLabel={t('settings.appearance.glass')}
                  options={[
                    { value: 'low', label: t('settings.appearance.glassLow') },
                    { value: 'medium', label: t('settings.appearance.glassMedium') },
                    { value: 'high', label: t('settings.appearance.glassHigh') }
                  ]}
                  onChange={(value) =>
                    void update({ appearance: { glass: value as 'low' | 'medium' | 'high' } })
                  }
                />
              </SettingRow>
              <SettingRow label={t('settings.appearance.motion')} desc={t('settings.appearance.motionDesc')}>
                <Select
                  value={settings.appearance.motion}
                  ariaLabel={t('settings.appearance.motion')}
                  options={[
                    { value: 'full', label: t('settings.appearance.motionFull') },
                    { value: 'reduced', label: t('settings.appearance.motionReduced') }
                  ]}
                  onChange={(value) =>
                    void update({ appearance: { motion: value as 'full' | 'reduced' } })
                  }
                />
              </SettingRow>
              <SettingRow label={t('settings.appearance.fontScale')} desc={t('settings.appearance.fontScaleDesc')}>
                <Select
                  value={String(settings.appearance.fontScale)}
                  ariaLabel={t('settings.appearance.fontScale')}
                  options={[90, 95, 100, 105, 110].map((scale) => ({
                    value: String(scale),
                    label: `${scale}%`
                  }))}
                  onChange={(value) => void update({ appearance: { fontScale: Number(value) } })}
                />
              </SettingRow>
            </>
          )}

          {section === 'language' && (
            <SettingRow label={t('settings.language.language')} desc={t('settings.language.languageDesc')}>
              <Select
                value={settings.language}
                ariaLabel={t('settings.language.language')}
                options={[
                  { value: 'auto', label: t('settings.language.auto') },
                  { value: 'en', label: t('settings.language.en') },
                  { value: 'pt', label: t('settings.language.pt') }
                ]}
                onChange={(value) => void update({ language: value as 'auto' | 'en' | 'pt' })}
              />
            </SettingRow>
          )}

          {section === 'playback' && (
            <>
              <SettingRow label={t('settings.playback.autoplay')} desc={t('settings.playback.autoplayDesc')}>
                <Switch
                  on={settings.playback.autoplayRelated}
                  ariaLabel={t('settings.playback.autoplay')}
                  onToggle={(on) => void update({ playback: { autoplayRelated: on } })}
                />
              </SettingRow>
              <SettingRow label={t('settings.playback.resume')} desc={t('settings.playback.resumeDesc')}>
                <Switch
                  on={settings.playback.resumeOnLaunch}
                  ariaLabel={t('settings.playback.resume')}
                  onToggle={(on) => void update({ playback: { resumeOnLaunch: on } })}
                />
              </SettingRow>
              <SettingRow label={t('settings.playback.quality')} desc={t('settings.playback.qualityDesc')}>
                <Select
                  value={settings.playback.quality}
                  ariaLabel={t('settings.playback.quality')}
                  options={[
                    { value: 'auto', label: t('settings.playback.qualityAuto') },
                    { value: 'progressive', label: t('settings.playback.qualityProgressive') },
                    { value: 'hls', label: t('settings.playback.qualityHls') }
                  ]}
                  onChange={(value) =>
                    void update({ playback: { quality: value as 'auto' | 'progressive' | 'hls' } })
                  }
                />
              </SettingRow>
              <SettingRow
                label={t('settings.playback.fade')}
                desc={t('settings.playback.fadeDesc', { ms: settings.playback.fadeMs })}
              >
                <Select
                  value={String(settings.playback.fadeMs)}
                  ariaLabel={t('settings.playback.fade')}
                  options={[0, 120, 220, 400, 700].map((ms) => ({ value: String(ms), label: `${ms} ms` }))}
                  onChange={(value) => void update({ playback: { fadeMs: Number(value) } })}
                />
              </SettingRow>
            </>
          )}

          {section === 'discord' && (
            <>
              <SettingRow label={t('settings.discord.enable')} desc={t('settings.discord.enableDesc')}>
                <Switch
                  on={settings.discord.enabled}
                  ariaLabel={t('settings.discord.enable')}
                  onToggle={(on) => void update({ discord: { enabled: on } })}
                />
              </SettingRow>
              <SettingRow label={t('settings.discord.buttons')} desc={t('settings.discord.buttonsDesc')}>
                <Switch
                  on={settings.discord.showButtons}
                  ariaLabel={t('settings.discord.buttons')}
                  onToggle={(on) => void update({ discord: { showButtons: on } })}
                />
              </SettingRow>
              <SettingRow label={t('settings.discord.clientId')} desc={t('settings.discord.clientIdDesc')}>
                <input
                  className="text-input"
                  style={{ width: 240 }}
                  defaultValue={settings.discord.clientId}
                  placeholder={t('settings.discord.clientIdPlaceholder')}
                  onBlur={(event) => void update({ discord: { clientId: event.currentTarget.value.trim() } })}
                />
              </SettingRow>
            </>
          )}

          {section === 'plugins' && <PluginsPanel />}
          {section === 'updates' && <UpdatesPanel />}

          {section === 'performance' && (
            <>
              <SettingRow label={t('settings.performance.hwAccel')} desc={t('settings.performance.hwAccelDesc')}>
                <Switch
                  on={settings.performance.hardwareAcceleration}
                  ariaLabel={t('settings.performance.hwAccel')}
                  onToggle={(on) => {
                    void update({ performance: { hardwareAcceleration: on } })
                    toast(t('toast.restartRequired'))
                  }}
                />
              </SettingRow>
              <SettingRow label={t('settings.performance.throttle')} desc={t('settings.performance.throttleDesc')}>
                <Switch
                  on={settings.performance.backgroundThrottling}
                  ariaLabel={t('settings.performance.throttle')}
                  onToggle={(on) => {
                    void update({ performance: { backgroundThrottling: on } })
                    toast(t('toast.restartRequired'))
                  }}
                />
              </SettingRow>
              <p className="settings-section-desc">{t('settings.performance.restartNote')}</p>
            </>
          )}

          {section === 'startup' && (
            <>
              <SettingRow label={t('settings.startup.login')} desc={t('settings.startup.loginDesc')}>
                <Switch
                  on={settings.startup.launchAtLogin}
                  ariaLabel={t('settings.startup.login')}
                  onToggle={(on) => void update({ startup: { launchAtLogin: on } })}
                />
              </SettingRow>
              <SettingRow label={t('settings.startup.minimized')} desc={t('settings.startup.minimizedDesc')}>
                <Switch
                  on={settings.startup.startMinimized}
                  ariaLabel={t('settings.startup.minimized')}
                  onToggle={(on) => void update({ startup: { startMinimized: on } })}
                />
              </SettingRow>
              <SettingRow label={t('settings.startup.closeToTray')} desc={t('settings.startup.closeToTrayDesc')}>
                <Switch
                  on={settings.system.closeToTray}
                  ariaLabel={t('settings.startup.closeToTray')}
                  onToggle={(on) => void update({ system: { closeToTray: on } })}
                />
              </SettingRow>
              <SettingRow label={t('settings.startup.mediaKeys')} desc={t('settings.startup.mediaKeysDesc')}>
                <Switch
                  on={settings.system.globalMediaKeys}
                  ariaLabel={t('settings.startup.mediaKeys')}
                  onToggle={(on) => void update({ system: { globalMediaKeys: on } })}
                />
              </SettingRow>
            </>
          )}

          {section === 'data' && <DataPanel />}
          {section === 'shortcuts' && <ShortcutsPanel />}
          {section === 'about' && <AboutPanel />}
        </div>
      </div>
    </div>
  )
}
