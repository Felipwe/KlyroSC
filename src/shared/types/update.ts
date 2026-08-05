export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdateStatus {
  phase: UpdatePhase
  current: string
  latest: string | null
  notes: string | null
  percent: number
  error: string | null
  autoInstalling?: boolean
}
