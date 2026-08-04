import { useEffect, useState, type JSX } from 'react'
import { type PluginConfigValue, type PluginInfo, type PluginSettingField } from '@shared/types/plugin'
import { type UpdateStatus } from '@shared/types/update'
import { type AppInfo } from '@shared/types/ipc'
import { APP_REPO_URL } from '@shared/constants'
import { t, useLanguage } from '@renderer/i18n'
import { api } from '@renderer/services/ipc'
import { toast } from '@renderer/stores/toasts'
import { useUi } from '@renderer/stores/ui'
import { useSettings } from '@renderer/stores/settings'
import { useAuth } from '@renderer/stores/auth'
import { useNav } from '@renderer/stores/nav'
import { Icon } from '@renderer/components/Icon'
import { Select, Switch } from '@renderer/components/controls'
import { Empty, Loading } from '@renderer/components/Status'
import { LogoMark } from '@renderer/components/Logo'
import { Artwork } from '@renderer/components/Artwork'
import { SettingRow } from './SettingsPage'

export function AccountPanel(): JSX.Element {
  useLanguage()
  const auth = useAuth()
  const user = auth.state.user

  if (auth.state.loggedIn && user) {
    return (
      <>
        <div className="about-hero">
          <Artwork src={user.avatar} round fallbackIcon="user" iconSize={26} className="account-avatar" />
          <div>
            <h2>{user.name}</h2>
            {user.handle && <p className="pc-meta">@{user.handle}</p>}
            <p className="pc-meta">{t('auth.syncNote')}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => useNav.getState().push({ name: 'artist', id: user.id })}>
            <Icon name="user" size={15} />
            {t('auth.viewProfile')}
          </button>
          {user.url && (
            <button className="btn" onClick={() => api.app.openExternal(user.url)}>
              <Icon name="external" size={15} />
              SoundCloud
            </button>
          )}
          <button className="btn danger" onClick={() => void auth.logout()}>
            <Icon name="close" size={15} />
            {t('auth.logout')}
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <p className="settings-section-desc">{t('auth.promptBody')}</p>
      <div className="update-card">
        <div className="uc-row">
          <span className="badge">{t('auth.notLoggedIn')}</span>
        </div>
        <div className="uc-row">
          <button className="btn primary" disabled={auth.busy} onClick={() => void auth.login()}>
            {auth.busy ? (
              <div className="spinner small" style={{ borderTopColor: '#fff' }} />
            ) : (
              <Icon name="user" size={15} />
            )}
            {auth.busy ? t('auth.loggingIn') : t('auth.login')}
          </button>
        </div>
        <p className="pc-meta">{t('auth.promptHint')}</p>
      </div>
    </>
  )
}

export function PluginsPanel(): JSX.Element {
  useLanguage()
  const [plugins, setPlugins] = useState<PluginInfo[] | null>(null)

  useEffect(() => {
    void api.plugins.list().then(setPlugins)
  }, [])

  const install = async (): Promise<void> => {
    const result = await api.plugins.install()
    if (result.ok && result.data) {
      setPlugins(result.data)
      toast(t('settings.plugins.installed'), 'success')
    } else if (!result.ok) {
      toast(t('settings.plugins.installFailed', { error: result.error }), 'error')
    }
  }

  if (!plugins) return <Loading />

  return (
    <>
      <p className="settings-section-desc">{t('settings.plugins.desc')}</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => void install()}>
          <Icon name="folder" size={15} />
          {t('settings.plugins.install')}
        </button>
        <button className="btn" onClick={() => api.app.openPath('plugins')}>
          <Icon name="external" size={15} />
          {t('settings.plugins.openFolder')}
        </button>
        <button className="btn" onClick={() => void api.plugins.reload().then(setPlugins)}>
          <Icon name="refresh" size={15} />
          {t('settings.plugins.reload')}
        </button>
      </div>
      {plugins.length === 0 ? (
        <Empty icon="plug" title={t('settings.plugins.empty')} />
      ) : (
        plugins.map((plugin) => <PluginCard key={plugin.manifest.id} plugin={plugin} onChange={setPlugins} />)
      )}
    </>
  )
}

function PluginCard({
  plugin,
  onChange
}: {
  plugin: PluginInfo
  onChange(plugins: PluginInfo[]): void
}): JSX.Element {
  const manifest = plugin.manifest
  return (
    <div className="plugin-card">
      <div className="pc-head">
        <div className="pc-id">
          <div className="pc-icon">
            <Icon name="plug" size={19} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="pc-name">
              {manifest.name}
              <span className="badge">{plugin.builtin ? t('settings.plugins.builtin') : t('settings.plugins.external')}</span>
              {!plugin.compatible && <span className="badge warn">{t('settings.plugins.incompatible')}</span>}
            </div>
            <div className="pc-meta">
              {t('settings.plugins.version', { version: manifest.version })}{' '}
              {t('settings.plugins.byAuthor', { author: manifest.author })}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!plugin.builtin && (
            <button
              className="icon-btn"
              title={t('settings.plugins.uninstall')}
              aria-label={t('settings.plugins.uninstall')}
              onClick={() =>
                useUi.getState().openModal({
                  kind: 'confirm',
                  title: t('settings.plugins.uninstall'),
                  body: t('settings.plugins.uninstallConfirm', { name: manifest.name }),
                  danger: true,
                  confirmLabel: t('settings.plugins.uninstall'),
                  onConfirm: () => {
                    void api.plugins.uninstall(manifest.id).then((result) => {
                      if (result.ok) {
                        onChange(result.data)
                        toast(t('settings.plugins.uninstalled'))
                      }
                    })
                  }
                })
              }
            >
              <Icon name="trash" size={15} />
            </button>
          )}
          <Switch
            on={plugin.enabled}
            ariaLabel={manifest.name}
            onToggle={(on) => {
              if (!plugin.compatible && on) return
              void api.plugins.setEnabled(manifest.id, on).then(onChange)
            }}
          />
        </div>
      </div>
      <div className="pc-desc">{manifest.description}</div>
      <div className="pc-perms">
        {manifest.permissions.length === 0 ? (
          <span className="badge">{t('settings.plugins.noPermissions')}</span>
        ) : (
          manifest.permissions.map((permission) => (
            <span key={permission} className="badge accent">
              {t(`settings.plugins.permissionNames.${permission}`)}
            </span>
          ))
        )}
      </div>
      {plugin.incompatibleReason && <div className="pc-error">{plugin.incompatibleReason}</div>}
      {plugin.error && (
        <div className="pc-error">
          {t('settings.plugins.errorLabel')}: {plugin.error}
        </div>
      )}
      {plugin.enabled && manifest.settings.length > 0 && (
        <div className="plugin-settings">
          {manifest.settings.map((field) => (
            <PluginField key={field.key} plugin={plugin} field={field} onChange={onChange} />
          ))}
        </div>
      )}
    </div>
  )
}

function PluginField({
  plugin,
  field,
  onChange
}: {
  plugin: PluginInfo
  field: PluginSettingField
  onChange(plugins: PluginInfo[]): void
}): JSX.Element {
  const value = plugin.config[field.key] ?? field.default
  const save = (next: PluginConfigValue): void => {
    void api.plugins.configure(plugin.manifest.id, { [field.key]: next }).then(onChange)
  }
  return (
    <div className="plugin-setting">
      <div>
        <div className="ps-label">{field.label}</div>
        {field.description && <div className="ps-desc">{field.description}</div>}
      </div>
      {field.type === 'boolean' && (
        <Switch on={value === true} ariaLabel={field.label} onToggle={(on) => save(on)} />
      )}
      {field.type === 'number' && (
        <input
          className="text-input"
          style={{ width: 110 }}
          type="number"
          min={field.min}
          max={field.max}
          defaultValue={Number(value)}
          onBlur={(event) => save(Number(event.currentTarget.value))}
        />
      )}
      {field.type === 'string' && (
        <input
          className="text-input"
          style={{ width: 240 }}
          type={field.secret ? 'password' : 'text'}
          defaultValue={String(value)}
          onBlur={(event) => save(event.currentTarget.value)}
        />
      )}
      {field.type === 'select' && (
        <Select
          value={String(value)}
          ariaLabel={field.label}
          options={(field.options ?? []).map((option) => ({ value: option.value, label: option.label }))}
          onChange={(next) => save(next)}
        />
      )}
    </div>
  )
}

export function UpdatesPanel(): JSX.Element {
  useLanguage()
  const { settings, update } = useSettings()
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    void api.updates.status().then(setStatus)
    void api.app.info().then(setInfo)
    return api.updates.onStatus(setStatus)
  }, [])

  const phase = status?.phase ?? 'idle'

  return (
    <>
      <SettingRow label={t('settings.updates.autoCheck')} desc={t('settings.updates.autoCheckDesc')}>
        <Switch
          on={settings.updates.autoCheck}
          ariaLabel={t('settings.updates.autoCheck')}
          onToggle={(on) => void update({ updates: { autoCheck: on } })}
        />
      </SettingRow>
      <SettingRow label={t('settings.updates.autoDownload')} desc={t('settings.updates.autoDownloadDesc')}>
        <Switch
          on={settings.updates.autoDownload}
          ariaLabel={t('settings.updates.autoDownload')}
          onToggle={(on) => void update({ updates: { autoDownload: on } })}
        />
      </SettingRow>

      <div className="update-card">
        <div className="uc-row">
          <span className="badge">{t('settings.updates.current', { version: status?.current ?? info?.version ?? '' })}</span>
          {status?.latest && phase !== 'not-available' && (
            <span className="badge accent">{t('settings.updates.latest', { version: status.latest })}</span>
          )}
          {phase === 'not-available' && <span className="badge accent">{t('settings.updates.upToDate')}</span>}
          {phase === 'error' && <span className="badge warn">{status?.error}</span>}
        </div>

        {phase === 'downloading' && (
          <>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${status?.percent ?? 0}%` }} />
            </div>
            <span className="pc-meta">{t('settings.updates.downloading', { percent: status?.percent ?? 0 })}</span>
          </>
        )}

        <div className="uc-row">
          <button
            className="btn"
            disabled={phase === 'checking' || phase === 'downloading'}
            onClick={() => void api.updates.check().then(setStatus)}
          >
            {phase === 'checking' ? <div className="spinner small" /> : <Icon name="refresh" size={15} />}
            {phase === 'checking' ? t('settings.updates.checking') : t('settings.updates.check')}
          </button>
          {phase === 'available' && (
            <button className="btn primary" onClick={() => void api.updates.download().then(setStatus)}>
              <Icon name="download" size={15} />
              {t('settings.updates.download')}
            </button>
          )}
          {phase === 'downloaded' && (
            <button className="btn primary" onClick={() => api.updates.install()}>
              <Icon name="zap" size={15} />
              {t('settings.updates.install')}
            </button>
          )}
        </div>

        {status?.notes && (
          <>
            <div className="sr-label">{t('settings.updates.notes')}</div>
            <div className="update-notes">{status.notes}</div>
          </>
        )}
      </div>
      <p className="settings-section-desc">{t('settings.updates.devMode')}</p>
    </>
  )
}

export function DataPanel(): JSX.Element {
  useLanguage()
  const { reset } = useSettings()
  return (
    <>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => api.app.openPath('userData')}>
          <Icon name="folder" size={15} />
          {t('settings.data.openData')}
        </button>
        <button className="btn" onClick={() => api.app.openPath('logs')}>
          <Icon name="folder" size={15} />
          {t('settings.data.openLogs')}
        </button>
        <button className="btn" onClick={() => api.app.openPath('downloads')}>
          <Icon name="folder" size={15} />
          {t('settings.data.openDownloads')}
        </button>
      </div>
      <SettingRow label={t('settings.data.export')} desc={t('settings.data.exportDesc')}>
        <button
          className="btn"
          onClick={() =>
            void api.library.exportData().then((result) => {
              if (result.ok && result.data) toast(t('toast.exportDone'), 'success')
            })
          }
        >
          <Icon name="download" size={15} />
          {t('settings.data.export')}
        </button>
      </SettingRow>
      <SettingRow label={t('settings.data.import')} desc={t('settings.data.importDesc')}>
        <button
          className="btn"
          onClick={() =>
            void api.library.importData().then((result) => {
              if (result.ok && result.data) {
                toast(t('toast.importDone'), 'success')
                window.location.reload()
              }
            })
          }
        >
          <Icon name="folder" size={15} />
          {t('settings.data.import')}
        </button>
      </SettingRow>
      <SettingRow label={t('settings.data.reset')} desc="">
        <button
          className="btn danger"
          onClick={() =>
            useUi.getState().openModal({
              kind: 'confirm',
              title: t('settings.data.reset'),
              body: t('settings.data.resetConfirm'),
              danger: true,
              confirmLabel: t('settings.data.reset'),
              onConfirm: () => {
                void reset().then(() => toast(t('toast.settingsReset'), 'success'))
              }
            })
          }
        >
          <Icon name="trash" size={15} />
          {t('settings.data.reset')}
        </button>
      </SettingRow>
    </>
  )
}

const SHORTCUTS: { key: string; keys: string[] }[] = [
  { key: 'playPause', keys: ['Space'] },
  { key: 'nextPrev', keys: ['Ctrl', '→ / ←'] },
  { key: 'seek', keys: ['→ / ←'] },
  { key: 'volume', keys: ['Ctrl', '↑ / ↓'] },
  { key: 'mute', keys: ['M'] },
  { key: 'shuffle', keys: ['S'] },
  { key: 'repeat', keys: ['R'] },
  { key: 'favorite', keys: ['F'] },
  { key: 'queue', keys: ['Q'] },
  { key: 'lyrics', keys: ['L'] },
  { key: 'search', keys: ['Ctrl', 'F'] },
  { key: 'settings', keys: ['Ctrl', ','] },
  { key: 'navigation', keys: ['Alt', '→ / ←'] }
]

export function ShortcutsPanel(): JSX.Element {
  useLanguage()
  return (
    <>
      <p className="settings-section-desc">{t('settings.shortcuts.desc')}</p>
      {SHORTCUTS.map((shortcut) => (
        <div key={shortcut.key} className="shortcut-row">
          <span>{t(`settings.shortcuts.${shortcut.key}`)}</span>
          <span className="kbd-group">
            {shortcut.keys.map((key, index) => (
              <kbd key={index}>{key}</kbd>
            ))}
          </span>
        </div>
      ))}
    </>
  )
}

export function AboutPanel(): JSX.Element {
  useLanguage()
  const [info, setInfo] = useState<AppInfo | null>(null)
  useEffect(() => {
    void api.app.info().then(setInfo)
  }, [])
  return (
    <>
      <div className="about-hero">
        <LogoMark size={58} />
        <div>
          <h2>
            Klyro<em>SC</em>
          </h2>
          <p className="pc-meta">{t('settings.about.desc')}</p>
          {info && (
            <p className="pc-meta">
              {t('settings.about.version')} {info.version} · Electron {info.electron} · Chromium {info.chrome} ·{' '}
              {info.platform}/{info.arch}
            </p>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => api.app.openExternal(APP_REPO_URL)}>
          <Icon name="external" size={15} />
          {t('settings.about.repo')}
        </button>
        <button className="btn" onClick={() => api.app.openExternal(`${APP_REPO_URL}/blob/main/LICENSE`)}>
          <Icon name="info" size={15} />
          {t('settings.about.license')}
        </button>
        <button className="btn" onClick={() => void api.updates.check()}>
          <Icon name="refresh" size={15} />
          {t('settings.about.checkUpdates')}
        </button>
      </div>
    </>
  )
}
