import { useEffect, useState, type JSX } from 'react'
import { t, useLanguage } from '@renderer/i18n'
import { api } from '@renderer/services/ipc'
import { useNav } from '@renderer/stores/nav'
import { cx } from '@renderer/utils/format'
import { Icon } from '@renderer/components/Icon'

export function TitleBar(): JSX.Element {
  useLanguage()
  const nav = useNav()
  const [maximized, setMaximized] = useState(false)
  const isMac = api.platform === 'darwin'

  useEffect(() => {
    void api.window.isMaximized().then(setMaximized)
    return api.window.onMaximized(setMaximized)
  }, [])

  return (
    <header className={cx('titlebar', isMac && 'mac')}>
      <div className="titlebar-brand">
        <span>
          Klyro<em>SC</em>
        </span>
      </div>
      <nav className="titlebar-nav">
        <button
          className="icon-btn"
          disabled={!nav.canBack()}
          onClick={nav.back}
          aria-label={t('common.back')}
          title={t('common.back')}
        >
          <Icon name="chevronLeft" />
        </button>
        <button
          className="icon-btn"
          disabled={!nav.canForward()}
          onClick={nav.forward}
          aria-label={t('common.forward')}
          title={t('common.forward')}
        >
          <Icon name="chevronRight" />
        </button>
      </nav>
      <div className="titlebar-spacer" />
      {!isMac && (
        <div className="win-controls">
          <button onClick={api.window.minimize} aria-label={t('window.minimize')}>
            <Icon name="minimize" size={15} />
          </button>
          <button
            onClick={api.window.maximizeToggle}
            aria-label={maximized ? t('window.restore') : t('window.maximize')}
          >
            <Icon name={maximized ? 'restore' : 'maximize'} size={13} />
          </button>
          <button className="close" onClick={api.window.close} aria-label={t('window.close')}>
            <Icon name="close" size={15} />
          </button>
        </div>
      )}
    </header>
  )
}
