import { useState, type JSX } from 'react'
import { cx } from '@renderer/utils/format'
import { Icon, type IconName } from './Icon'

interface ArtworkProps {
  src: string | null
  alt?: string
  round?: boolean
  className?: string
  fallbackIcon?: IconName
  iconSize?: number
}

export function Artwork({
  src,
  alt = '',
  round = false,
  className,
  fallbackIcon = 'music',
  iconSize = 20
}: ArtworkProps): JSX.Element {
  const [failed, setFailed] = useState(false)
  const showImage = src && !failed
  return (
    <div className={cx('artwork', round && 'round', className)}>
      {showImage ? (
        <img src={src} alt={alt} loading="lazy" draggable={false} onError={() => setFailed(true)} />
      ) : (
        <div className="artwork-fallback">
          <Icon name={fallbackIcon} size={iconSize} />
        </div>
      )}
    </div>
  )
}
