/** Taskbar badge helpers  pure so they can be unit-tested. */

export interface NotificationSources {
  /** per-friend unread direct messages */
  unread: Record<string, number>
  jamUnread: number
  incomingRequests: number
  jamInvites: number
  updateReady: boolean
}

export function totalNotifications(sources: NotificationSources): number {
  const unreadTotal = Object.values(sources.unread).reduce((sum, count) => sum + Math.max(0, count), 0)
  return (
    unreadTotal +
    Math.max(0, sources.jamUnread) +
    Math.max(0, sources.incomingRequests) +
    Math.max(0, sources.jamInvites) +
    (sources.updateReady ? 1 : 0)
  )
}

export function badgeLabel(count: number): string {
  return count > 9 ? '9+' : String(count)
}
