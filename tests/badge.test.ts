import { describe, expect, it } from 'vitest'
import { badgeLabel, totalNotifications } from '../src/shared/utils/badge'

describe('taskbar badge', () => {
  it('sums every notification source', () => {
    expect(
      totalNotifications({
        unread: { a: 2, b: 1 },
        jamUnread: 3,
        incomingRequests: 1,
        jamInvites: 1,
        updateReady: true
      })
    ).toBe(9)
  })

  it('ignores negative counters', () => {
    expect(
      totalNotifications({ unread: { a: -5 }, jamUnread: -1, incomingRequests: 0, jamInvites: 0, updateReady: false })
    ).toBe(0)
  })

  it('caps the label at 9+', () => {
    expect(badgeLabel(1)).toBe('1')
    expect(badgeLabel(9)).toBe('9')
    expect(badgeLabel(10)).toBe('9+')
    expect(badgeLabel(140)).toBe('9+')
  })
})
