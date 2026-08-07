import { totalNotifications } from '@shared/utils/badge'
import { updateAppBadge } from '@renderer/utils/app-badge'
import { useSocial } from '@renderer/stores/social'
import { api } from '@renderer/services/ipc'

let updateReady = false
let initialized = false

function recompute(): void {
  const social = useSocial.getState()
  updateAppBadge(
    totalNotifications({
      unread: social.unread,
      jamUnread: social.jamUnread,
      incomingRequests: social.snapshot.requests.filter((request) => request.direction === 'in').length,
      jamInvites: social.snapshot.invites.length,
      updateReady
    })
  )
}

/** Mirrors every notification source into the taskbar badge (9+ cap drawn by app-badge). */
export function initBadgeSync(): void {
  if (initialized) return
  initialized = true
  useSocial.subscribe(recompute)
  api.updates.onStatus((status) => {
    updateReady = status.phase === 'downloaded' && !status.autoInstalling
    recompute()
  })
  recompute()
}
