import { useEffect, type JSX } from 'react'
import { t, useLanguage } from '@renderer/i18n'
import { useAuth } from '@renderer/stores/auth'
import { useNav } from '@renderer/stores/nav'
import { LogoMark } from './Logo'
import { Icon } from './Icon'

export function LoginPrompt(): JSX.Element | null {
  useLanguage()
  const auth = useAuth()

  useEffect(() => {
    const unsubscribe = useNav.subscribe((state, previous) => {
      if (state.route !== previous.route) useAuth.getState().dismissPrompt()
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') useAuth.getState().dismissPrompt()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!auth.loaded || auth.state.loggedIn || auth.promptDismissed) return null

  return (
    <div className="scrim" style={{ zIndex: 70 }}>
      <div className="modal glass login-card" role="dialog" aria-modal="true">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <LogoMark size={46} />
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>{t('auth.promptTitle')}</h2>
            <span className="pc-meta">KlyroSC × SoundCloud</span>
          </div>
        </div>
        <p>{t('auth.promptBody')}</p>
        <p style={{ fontSize: '0.76rem', color: 'var(--text-faint)' }}>{t('auth.promptHint')}</p>
        <div className="modal-actions" style={{ justifyContent: 'stretch', flexDirection: 'column', gap: 8 }}>
          <button
            className="btn primary"
            style={{ width: '100%', padding: '12px 18px' }}
            disabled={auth.busy}
            onClick={() => void auth.login()}
          >
            {auth.busy ? (
              <>
                <div className="spinner small" style={{ borderTopColor: '#fff' }} />
                {t('auth.loggingIn')}
              </>
            ) : (
              <>
                <Icon name="user" size={16} />
                {t('auth.login')}
              </>
            )}
          </button>
          <button className="btn" style={{ width: '100%' }} onClick={auth.dismissPrompt}>
            {t('auth.skip')}
          </button>
        </div>
      </div>
    </div>
  )
}
