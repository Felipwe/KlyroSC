import { type JSX } from 'react'
import { t } from '@renderer/i18n'
import { Icon, type IconName } from './Icon'

export function Loading({ label }: { label?: string }): JSX.Element {
  return (
    <div className="status-block" role="status">
      <div className="spinner" />
      <p>{label ?? t('common.loading')}</p>
    </div>
  )
}

interface EmptyProps {
  icon?: IconName
  title: string
  hint?: string
  action?: JSX.Element
}

export function Empty({ icon = 'disc', title, hint, action }: EmptyProps): JSX.Element {
  return (
    <div className="status-block">
      <div className="status-icon">
        <Icon name={icon} size={28} />
      </div>
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
      {action}
    </div>
  )
}

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps): JSX.Element {
  return (
    <div className="status-block">
      <div className="status-icon">
        <Icon name="alert" size={28} />
      </div>
      <h3>{t('common.error')}</h3>
      <p>{message ?? t('status.loadFailed')}</p>
      {onRetry && (
        <button className="btn" onClick={onRetry}>
          <Icon name="refresh" size={15} />
          {t('common.retry')}
        </button>
      )}
    </div>
  )
}
