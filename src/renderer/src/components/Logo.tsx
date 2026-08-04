import { type JSX } from 'react'
import iconUrl from '@renderer/assets/icon.png'

export function LogoMark({ size = 22 }: { size?: number }): JSX.Element {
  return (
    <img
      src={iconUrl}
      width={size}
      height={size}
      className="logo-mark"
      alt=""
      draggable={false}
      style={{ objectFit: 'contain' }}
    />
  )
}
