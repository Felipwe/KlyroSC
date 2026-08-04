import { type JSX } from 'react'
import { cx } from '@renderer/utils/format'
import { LogoMark } from './Logo'

const BAR_HEIGHTS = [12, 20, 26, 17, 10]

export function BootSplash({ leaving }: { leaving: boolean }): JSX.Element {
  return (
    <div className={cx('boot-splash', leaving && 'leaving')} aria-hidden="true">
      <div className="bs-stack">
        <div className="bs-logo">
          <span className="bs-ring" />
          <span className="bs-ring r2" />
          <LogoMark size={96} />
        </div>
        <div className="bs-wordmark">
          Klyro<em>SC</em>
        </div>
        <div className="bs-eq">
          {BAR_HEIGHTS.map((height, index) => (
            <span key={index} style={{ height, animationDelay: `${index * 0.12}s` }} />
          ))}
        </div>
        <div className="bs-bar">
          <i />
        </div>
      </div>
    </div>
  )
}
