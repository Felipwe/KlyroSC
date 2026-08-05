import { type JSX } from 'react'

const stroke = (d: string): JSX.Element => <path d={d} />
const fill = (d: string): JSX.Element => <path d={d} fill="currentColor" stroke="none" />

export const ICONS = {
  play: fill('M8 5.14v13.72c0 .8.87 1.3 1.56.88l10.54-6.86a1.05 1.05 0 0 0 0-1.76L9.56 4.26A1.04 1.04 0 0 0 8 5.14Z'),
  pause: fill('M7 4.5h3.2a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Zm6.8 0H17a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-3.2a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Z'),
  next: fill('M5.5 6.11v11.78c0 .86.96 1.37 1.68.9l8.9-5.89a1.08 1.08 0 0 0 0-1.8l-8.9-5.9a1.08 1.08 0 0 0-1.68.9ZM17 5h1.6a.9.9 0 0 1 .9.9v12.2a.9.9 0 0 1-.9.9H17a.9.9 0 0 1-.9-.9V5.9A.9.9 0 0 1 17 5Z'),
  previous: fill('M18.5 6.11v11.78c0 .86-.96 1.37-1.68.9l-8.9-5.89a1.08 1.08 0 0 1 0-1.8l8.9-5.9a1.08 1.08 0 0 1 1.68.9ZM5.4 5H7a.9.9 0 0 1 .9.9v12.2A.9.9 0 0 1 7 19H5.4a.9.9 0 0 1-.9-.9V5.9a.9.9 0 0 1 .9-.9Z'),
  shuffle: (
    <>
      {stroke('M16 3h5v5')}
      {stroke('M21 3 9.7 14.3')}
      {stroke('M21 16v5h-5')}
      {stroke('m15 15 6 6')}
      {stroke('M3 4c2.5 0 4.5 1 6 3')}
      {stroke('M3 20c3.5 0 6-1.5 8-4.5')}
    </>
  ),
  repeat: (
    <>
      {stroke('m17 2 4 4-4 4')}
      {stroke('M3 11v-1a4 4 0 0 1 4-4h14')}
      {stroke('m7 22-4-4 4-4')}
      {stroke('M21 13v1a4 4 0 0 1-4 4H3')}
    </>
  ),
  heart: stroke('M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z'),
  heartFill: fill('M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z'),
  comment: stroke('M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8Z'),
  repost: (
    <>
      {stroke('m17 1 4 4-4 4')}
      {stroke('M3 11V9a4 4 0 0 1 4-4h14')}
      {stroke('m7 23-4-4 4-4')}
      {stroke('M21 13v2a4 4 0 0 1-4 4H3')}
    </>
  ),
  queue: (
    <>
      {stroke('M21 15V6')}
      {stroke('M18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z')}
      {stroke('M12 12H3')}
      {stroke('M16 6H3')}
      {stroke('M12 18H3')}
    </>
  ),
  mic: (
    <>
      {stroke('M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z')}
      {stroke('M19 10v2a7 7 0 0 1-14 0v-2')}
      {stroke('M12 19v3')}
    </>
  ),
  volume: (
    <>
      {fill('M11 5 6 9H2v6h4l5 4V5Z')}
      {stroke('M15.54 8.46a5 5 0 0 1 0 7.07')}
      {stroke('M19.07 4.93a10 10 0 0 1 0 14.14')}
    </>
  ),
  volumeMute: (
    <>
      {fill('M11 5 6 9H2v6h4l5 4V5Z')}
      {stroke('m23 9-6 6')}
      {stroke('m17 9 6 6')}
    </>
  ),
  search: (
    <>
      {stroke('M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z')}
      {stroke('m21 21-4.3-4.3')}
    </>
  ),
  home: (
    <>
      {stroke('m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z')}
      {stroke('M9 22V12h6v10')}
    </>
  ),
  clock: (
    <>
      {stroke('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z')}
      {stroke('M12 6v6l4 2')}
    </>
  ),
  music: (
    <>
      {stroke('M9 18V5l12-2v13')}
      {stroke('M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z')}
      {stroke('M18 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z')}
    </>
  ),
  plus: (
    <>
      {stroke('M5 12h14')}
      {stroke('M12 5v14')}
    </>
  ),
  settings: (
    <>
      {stroke('M4 21v-7')}
      {stroke('M4 10V3')}
      {stroke('M12 21v-9')}
      {stroke('M12 8V3')}
      {stroke('M20 21v-5')}
      {stroke('M20 12V3')}
      {stroke('M2 14h4')}
      {stroke('M10 8h4')}
      {stroke('M18 16h4')}
    </>
  ),
  close: (
    <>
      {stroke('M18 6 6 18')}
      {stroke('m6 6 12 12')}
    </>
  ),
  minimize: stroke('M5 12h14'),
  maximize: stroke('M5.5 5.5h13v13h-13Z'),
  restore: (
    <>
      {stroke('M8.5 8.5h11v11h-11Z')}
      {stroke('M5 15.5V5h10.5')}
    </>
  ),
  chevronLeft: stroke('m15 18-6-6 6-6'),
  chevronRight: stroke('m9 18 6-6-6-6'),
  chevronDown: stroke('m6 9 6 6 6-6'),
  external: (
    <>
      {stroke('M15 3h6v6')}
      {stroke('M10 14 21 3')}
      {stroke('M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6')}
    </>
  ),
  download: (
    <>
      {stroke('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4')}
      {stroke('m7 10 5 5 5-5')}
      {stroke('M12 15V3')}
    </>
  ),
  more: (
    <>
      {fill('M12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z')}
      {fill('M5 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z')}
      {fill('M19 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z')}
    </>
  ),
  trash: (
    <>
      {stroke('M3 6h18')}
      {stroke('M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6')}
      {stroke('M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2')}
      {stroke('M10 11v6')}
      {stroke('M14 11v6')}
    </>
  ),
  edit: stroke('M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z'),
  check: stroke('M20 6 9 17l-5-5'),
  mini: (
    <>
      {stroke('M2 5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v6.5')}
      {stroke('M2 5v12a2 2 0 0 0 2 2h6')}
      {fill('M13 14a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1Z')}
    </>
  ),
  expand: (
    <>
      {stroke('M15 3h6v6')}
      {stroke('M9 21H3v-6')}
      {stroke('m21 3-7 7')}
      {stroke('m3 21 7-7')}
    </>
  ),
  folder: stroke('M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z'),
  refresh: (
    <>
      {stroke('M3 12a9 9 0 0 1 15.74-6L21 8')}
      {stroke('M21 3v5h-5')}
      {stroke('M21 12a9 9 0 0 1-15.74 6L3 16')}
      {stroke('M8 16H3v5')}
    </>
  ),
  arrowUp: (
    <>
      {stroke('m5 12 7-7 7 7')}
      {stroke('M12 19V5')}
    </>
  ),
  arrowDown: (
    <>
      {stroke('M12 5v14')}
      {stroke('m19 12-7 7-7-7')}
    </>
  ),
  alert: (
    <>
      {stroke('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z')}
      {stroke('M12 8v4')}
      {stroke('M12 16h.01')}
    </>
  ),
  info: (
    <>
      {stroke('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z')}
      {stroke('M12 16v-4')}
      {stroke('M12 8h.01')}
    </>
  ),
  plug: (
    <>
      {stroke('M12 22v-5')}
      {stroke('M9 8V2')}
      {stroke('M15 8V2')}
      {stroke('M6 8h12v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4Z')}
    </>
  ),
  user: (
    <>
      {stroke('M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2')}
      {stroke('M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z')}
    </>
  ),
  disc: (
    <>
      {stroke('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z')}
      {stroke('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z')}
    </>
  ),
  globe: (
    <>
      {stroke('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z')}
      {stroke('M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20Z')}
      {stroke('M2 12h20')}
    </>
  ),
  zap: fill('M13.4 2.1 3.7 13.5a.6.6 0 0 0 .46.99h6.3l-.85 6.42c-.08.62.7.94 1.09.45l9.7-11.4a.6.6 0 0 0-.46-.99h-6.3l.85-6.42c.08-.62-.7-.94-1.09-.45Z'),
  activity: stroke('M22 12h-2.5l-2.5 8-5-16-2.5 8H2'),
  sparkle: fill('M12 2.6c.2-.6 1-.6 1.2 0l1.6 4.9a.64.64 0 0 0 .4.4l4.9 1.6c.6.2.6 1 0 1.2l-4.9 1.6a.64.64 0 0 0-.4.4l-1.6 4.9c-.2.6-1 .6-1.2 0l-1.6-4.9a.64.64 0 0 0-.4-.4l-4.9-1.6c-.6-.2-.6-1 0-1.2l4.9-1.6a.64.64 0 0 0 .4-.4ZM5.2 15.9c.1-.35.6-.35.7 0l.68 2.06c.03.1.11.18.21.21l2.06.68c.35.1.35.6 0 .7l-2.06.68a.33.33 0 0 0-.21.21l-.68 2.06c-.1.35-.6.35-.7 0l-.68-2.06a.33.33 0 0 0-.21-.21l-2.06-.68c-.35-.1-.35-.6 0-.7l2.06-.68c.1-.03.18-.11.21-.21Z'),
  power: (
    <>
      {stroke('M18.36 6.64a9 9 0 1 1-12.72 0')}
      {stroke('M12 2v9')}
    </>
  ),
  gauge: (
    <>
      {stroke('m12 14 4-4')}
      {stroke('M3.34 19a10 10 0 1 1 17.32 0Z')}
    </>
  ),
  keyboard: (
    <>
      {stroke('M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z')}
      {stroke('M7 15h10')}
      {stroke('M6.5 10.5h.01')}
      {stroke('M10.5 10.5h.01')}
      {stroke('M14.5 10.5h.01')}
      {stroke('M17.5 10.5h.01')}
    </>
  ),
  playCircle: (
    <>
      {stroke('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z')}
      {fill('M10.2 8.5v7a.6.6 0 0 0 .92.5l5.32-3.5a.6.6 0 0 0 0-1L11.12 8a.6.6 0 0 0-.92.5Z')}
    </>
  ),
  timer: (
    <>
      {stroke('M10 2h4')}
      {stroke('M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z')}
      {stroke('M12 10v4')}
    </>
  )
} as const

export type IconName = keyof typeof ICONS

interface IconProps {
  name: IconName
  size?: number
  className?: string
}

export function Icon({ name, size = 18, className }: IconProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  )
}
