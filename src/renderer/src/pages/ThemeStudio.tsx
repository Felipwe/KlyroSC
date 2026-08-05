import { type JSX } from 'react'
import { type CustomTheme } from '@shared/types/settings'
import { t, useLanguage } from '@renderer/i18n'
import { api } from '@renderer/services/ipc'
import { useSettings } from '@renderer/stores/settings'
import { useUi } from '@renderer/stores/ui'
import { toast } from '@renderer/stores/toasts'
import { Icon } from '@renderer/components/Icon'
import { ColorPicker, Slider, Switch } from '@renderer/components/controls'
import { SettingRow } from './SettingsPage'

export function ThemeStudio(): JSX.Element {
  useLanguage()
  const appearance = useSettings((state) => state.settings.appearance)
  const theme = appearance.custom

  const patch = (partial: Partial<CustomTheme>): void => {
    void useSettings.getState().update({ appearance: { custom: partial } })
  }

  const pickBackground = async (): Promise<void> => {
    const result = await api.theme.pickBackground()
    if (result.ok && result.data) toast(t('settings.theme.backgroundSet'), 'success')
    else if (!result.ok) toast(t('settings.theme.backgroundFailed', { error: result.error }), 'error')
  }

  const saveProfile = (): void =>
    useUi.getState().openModal({
      kind: 'prompt',
      title: t('settings.theme.saveTitle'),
      placeholder: t('settings.theme.savePlaceholder'),
      confirmLabel: t('common.save'),
      onConfirm: (raw) => {
        const name = raw.trim().slice(0, 40)
        if (!name) return
        const profiles = [
          ...appearance.profiles.filter((profile) => profile.name.toLowerCase() !== name.toLowerCase()),
          { name, theme: { ...theme } }
        ]
        void useSettings.getState().update({ appearance: { profiles } })
        toast(t('settings.theme.profileSaved', { name }), 'success')
      }
    })

  const applyProfile = (name: string): void => {
    const profile = appearance.profiles.find((entry) => entry.name === name)
    if (profile) patch({ ...profile.theme })
  }

  const deleteProfile = (name: string): void =>
    useUi.getState().openModal({
      kind: 'confirm',
      title: t('settings.theme.deleteTitle'),
      body: t('settings.theme.deleteConfirm', { name }),
      danger: true,
      confirmLabel: t('common.delete'),
      onConfirm: () => {
        const profiles = appearance.profiles.filter((entry) => entry.name !== name)
        void useSettings.getState().update({ appearance: { profiles } })
        toast(t('settings.theme.profileDeleted', { name }))
      }
    })

  const exportTheme = (): void =>
    useUi.getState().openModal({
      kind: 'prompt',
      title: t('settings.theme.exportTitle'),
      placeholder: t('settings.theme.savePlaceholder'),
      initialValue: t('settings.theme.exportDefaultName'),
      confirmLabel: t('settings.theme.export'),
      onConfirm: (raw) => {
        const name = raw.trim().slice(0, 40) || t('settings.theme.exportDefaultName')
        void api.theme.exportTheme({ name, theme }).then((result) => {
          if (result.ok && result.data) toast(t('settings.theme.exported'), 'success')
          else if (!result.ok) toast(t('settings.theme.exportFailed', { error: result.error }), 'error')
        })
      }
    })

  const importTheme = async (): Promise<void> => {
    const result = await api.theme.importTheme()
    if (result.ok && result.data) toast(t('settings.theme.imported', { name: result.data.name }), 'success')
    else if (!result.ok) toast(t('settings.theme.importFailed', { error: result.error }), 'error')
  }

  return (
    <div className="theme-studio">
      <SettingRow label={t('settings.theme.colors')} desc={t('settings.theme.colorsDesc')}>
        <div className="color-fields">
          <ColorPicker label={t('settings.theme.colorA')} value={theme.colorA} onChange={(colorA) => patch({ colorA })} eyedropperLabel={t('settings.theme.pickFromScreen')} />
          <ColorPicker label={t('settings.theme.colorB')} value={theme.colorB} onChange={(colorB) => patch({ colorB })} eyedropperLabel={t('settings.theme.pickFromScreen')} />
          <ColorPicker label={t('settings.theme.colorBg')} value={theme.bgColor} onChange={(bgColor) => patch({ bgColor })} eyedropperLabel={t('settings.theme.pickFromScreen')} />
        </div>
      </SettingRow>

      <SettingRow label={t('settings.theme.background')} desc={t('settings.theme.backgroundDesc')}>
        <div className="theme-bg-controls">
          {theme.background && <img className="theme-bg-thumb" src={theme.background} alt="" />}
          <button className="btn small" onClick={() => void pickBackground()}>
            <Icon name="folder" size={14} />
            {t('settings.theme.upload')}
          </button>
          {theme.background && (
            <button className="icon-btn" title={t('settings.theme.removeBackground')} aria-label={t('settings.theme.removeBackground')} onClick={() => patch({ background: null })}>
              <Icon name="trash" size={15} />
            </button>
          )}
        </div>
      </SettingRow>

      <SettingRow label={t('settings.theme.blur')} desc={t('settings.theme.blurDesc', { px: theme.blur })}>
        <div style={{ width: 190 }}>
          <Slider value={theme.blur} max={48} step={1} onChange={(blur) => patch({ blur: Math.round(blur) })} ariaLabel={t('settings.theme.blur')} />
        </div>
      </SettingRow>

      <SettingRow label={t('settings.theme.dim')} desc={t('settings.theme.dimDesc', { pct: theme.dim })}>
        <div style={{ width: 190 }}>
          <Slider value={theme.dim} max={95} step={1} onChange={(dim) => patch({ dim: Math.round(dim) })} ariaLabel={t('settings.theme.dim')} />
        </div>
      </SettingRow>

      <SettingRow label={t('settings.theme.syncIcon')} desc={t('settings.theme.syncIconDesc')}>
        <Switch on={theme.syncIcon} ariaLabel={t('settings.theme.syncIcon')} onToggle={(syncIcon) => patch({ syncIcon })} />
      </SettingRow>

      <SettingRow label={t('settings.theme.profiles')} desc={t('settings.theme.profilesDesc')}>
        <div className="theme-actions">
          <button className="btn small primary" onClick={saveProfile}>
            <Icon name="plus" size={14} />
            {t('settings.theme.saveProfile')}
          </button>
          <button className="btn small" onClick={exportTheme}>
            <Icon name="download" size={14} />
            {t('settings.theme.export')}
          </button>
          <button className="btn small" onClick={() => void importTheme()}>
            <Icon name="folder" size={14} />
            {t('settings.theme.import')}
          </button>
        </div>
      </SettingRow>

      {appearance.profiles.length > 0 && (
        <div className="theme-profiles">
          {appearance.profiles.map((profile) => (
            <div key={profile.name} className="theme-profile-row" onClick={() => applyProfile(profile.name)}>
              <span
                className="tp-swatch"
                style={{ background: `linear-gradient(135deg, ${profile.theme.colorA}, ${profile.theme.colorB})` }}
              />
              <span className="tp-name">{profile.name}</span>
              <button
                className="icon-btn tp-delete"
                title={t('settings.theme.deleteTitle')}
                aria-label={t('settings.theme.deleteTitle')}
                onClick={(event) => {
                  event.stopPropagation()
                  deleteProfile(profile.name)
                }}
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
