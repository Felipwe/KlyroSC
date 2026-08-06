import { describe, expect, it, vi } from 'vitest'
import { JamService, JAM_MAX_MEMBERS, type JamEvent } from '../src/jams.js'
import { isJamTrackRef, isListeningInfo } from '../src/types.js'

const track = (id: number) => ({
  trackId: id,
  title: `Track ${id}`,
  artist: 'Artist',
  artwork: null,
  duration: 200
})

function makeService(isOnline: (id: string) => boolean = () => true): {
  service: JamService
  events: JamEvent[]
} {
  const events: JamEvent[] = []
  const service = new JamService((event) => events.push(event), isOnline)
  return { service, events }
}

describe('JamService', () => {
  it('creates a jam with the owner as only member', () => {
    const { service } = makeService()
    const jam = service.create('owner')
    expect(jam.ownerId).toBe('owner')
    expect([...jam.members.keys()]).toEqual(['owner'])
    expect(service.jamOf('owner')?.id).toBe(jam.id)
  })

  it('invite → accept joins the jam', () => {
    const { service, events } = makeService()
    service.create('owner')
    const invited = service.invite('owner', 'guest')
    expect(invited.ok).toBe(true)
    const inviteEvent = events.find((event) => event.kind === 'invite')
    expect(inviteEvent).toBeDefined()
    const invite = service.invitesFor('guest')[0]!
    const accepted = service.acceptInvite('guest', invite.id)
    expect(accepted.ok).toBe(true)
    expect(service.jamOf('guest')?.members.size).toBe(2)
    expect(service.invitesFor('guest')).toHaveLength(0)
  })

  it('rejects duplicate and stranger invites', () => {
    const { service } = makeService()
    service.create('owner')
    expect(service.invite('owner', 'guest').ok).toBe(true)
    expect(service.invite('owner', 'guest')).toEqual({ ok: false, error: 'already_invited' })
    expect(service.invite('nobody', 'guest')).toEqual({ ok: false, error: 'not_in_jam' })
    const invite = service.invitesFor('guest')[0]!
    expect(service.acceptInvite('other-user', invite.id).ok).toBe(false)
  })

  it('caps members at 8', () => {
    const { service } = makeService()
    service.create('owner')
    for (let i = 1; i < JAM_MAX_MEMBERS; i++) {
      service.invite('owner', `user-${i}`)
      const invite = service.invitesFor(`user-${i}`)[0]!
      expect(service.acceptInvite(`user-${i}`, invite.id).ok).toBe(true)
    }
    expect(service.jamOf('owner')?.members.size).toBe(JAM_MAX_MEMBERS)
    expect(service.invite('owner', 'one-too-many')).toEqual({ ok: false, error: 'jam_full' })
  })

  it('owner leaving alone ends the jam; with members it hands over to the oldest', () => {
    const { service, events } = makeService()
    // alone → end
    service.create('solo')
    service.leave('solo')
    expect(service.jamOf('solo')).toBeNull()
    expect(events.some((event) => event.kind === 'ended')).toBe(true)

    // with members → transfer to the oldest
    vi.useFakeTimers()
    try {
      service.create('owner')
      service.invite('owner', 'first')
      service.acceptInvite('first', service.invitesFor('first')[0]!.id)
      vi.advanceTimersByTime(1000) // second joins later
      service.invite('owner', 'second')
      service.acceptInvite('second', service.invitesFor('second')[0]!.id)
      service.leave('owner')
      const jam = service.jamOf('first')
      expect(jam).not.toBeNull()
      expect(jam?.ownerId).toBe('first')
      expect(service.jamOf('owner')).toBeNull()
      expect(jam?.members.size).toBe(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('guest leaving keeps the jam alive', () => {
    const { service } = makeService()
    service.create('owner')
    service.invite('owner', 'guest')
    service.acceptInvite('guest', service.invitesFor('guest')[0]!.id)
    service.leave('guest')
    expect(service.jamOf('guest')).toBeNull()
    expect(service.jamOf('owner')?.members.size).toBe(1)
  })

  it('only controllers can update playback', () => {
    const { service, events } = makeService()
    service.create('owner')
    service.invite('owner', 'guest')
    service.acceptInvite('guest', service.invitesFor('guest')[0]!.id)
    events.length = 0

    service.updatePlayback('guest', { track: track(1), playing: true, position: 0 })
    expect(events.filter((event) => event.kind === 'playback')).toHaveLength(0)

    service.setGuestControl('owner', true)
    service.updatePlayback('guest', { track: track(1), playing: true, position: 0 })
    const playbackEvents = events.filter((event) => event.kind === 'playback')
    expect(playbackEvents).toHaveLength(1)
    expect(playbackEvents[0]!.userIds).toEqual(['owner'])
  })

  it('only the owner can toggle guest control', () => {
    const { service } = makeService()
    service.create('owner')
    service.invite('owner', 'guest')
    service.acceptInvite('guest', service.invitesFor('guest')[0]!.id)
    expect(service.setGuestControl('guest', true)).toBe(false)
    expect(service.setGuestControl('owner', true)).toBe(true)
  })

  it('playback updates are broadcast to other members only', () => {
    const { service, events } = makeService()
    service.create('owner')
    service.invite('owner', 'guest')
    service.acceptInvite('guest', service.invitesFor('guest')[0]!.id)
    events.length = 0
    service.updatePlayback('owner', { track: track(9), playing: true, position: 12 })
    const playback = events.find((event) => event.kind === 'playback')
    expect(playback?.userIds).toEqual(['guest'])
    if (playback?.kind === 'playback') {
      expect(playback.playback.track?.trackId).toBe(9)
      expect(playback.playback.at).toBeGreaterThan(0)
    }
  })

  it('owner going offline transfers to the oldest ONLINE member after the grace', () => {
    vi.useFakeTimers()
    try {
      const online = new Set(['owner', 'first', 'second'])
      const { service, events } = makeService((id) => online.has(id))
      service.create('owner')
      service.invite('owner', 'first')
      service.acceptInvite('first', service.invitesFor('first')[0]!.id)
      vi.advanceTimersByTime(500)
      service.invite('owner', 'second')
      service.acceptInvite('second', service.invitesFor('second')[0]!.id)

      online.delete('owner')
      online.delete('first') // oldest is ALSO offline → crown goes to second
      service.memberOffline('owner')
      expect(service.jamOf('owner')?.ownerId).toBe('owner') // grace not elapsed yet
      vi.advanceTimersByTime(61_000)
      const jam = service.jamOf('second')
      expect(jam?.ownerId).toBe('second')
      expect(service.jamOf('owner')).toBeNull()
      expect(events.some((event) => event.kind === 'sync')).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('owner reconnecting within the grace keeps the crown', () => {
    vi.useFakeTimers()
    try {
      const online = new Set(['owner', 'guest'])
      const { service } = makeService((id) => online.has(id))
      service.create('owner')
      service.invite('owner', 'guest')
      service.acceptInvite('guest', service.invitesFor('guest')[0]!.id)
      online.delete('owner')
      service.memberOffline('owner')
      vi.advanceTimersByTime(30_000)
      online.add('owner')
      service.memberOnline('owner')
      vi.advanceTimersByTime(40_000)
      expect(service.jamOf('owner')?.ownerId).toBe('owner')
    } finally {
      vi.useRealTimers()
    }
  })

  it('jam chat broadcasts to all members and keeps a bounded history', () => {
    const { service, events } = makeService()
    service.create('owner')
    service.invite('owner', 'guest')
    service.acceptInvite('guest', service.invitesFor('guest')[0]!.id)
    events.length = 0
    expect(service.addChat('guest', 'Guest Name', 'oi pessoal')).toBe(true)
    const chat = events.find((event) => event.kind === 'chat')
    expect(chat?.kind === 'chat' && chat.message.text).toBe('oi pessoal')
    expect(chat?.kind === 'chat' && chat.userIds.sort()).toEqual(['guest', 'owner'])
    expect(service.addChat('stranger', 'X', 'invadindo')).toBe(false)
    for (let i = 0; i < 60; i++) service.addChat('owner', 'Owner', `m${i}`)
    expect(service.jamOf('owner')?.chat.length).toBeLessThanOrEqual(50)
    const dto = service.toDto(service.jamOf('owner')!, () => null)
    expect(dto.chat.length).toBeLessThanOrEqual(30)
  })

  it('queue keeps addedBy attribution', () => {
    const { service } = makeService()
    service.create('owner')
    service.updateQueue('owner', [{ ...track(1), addedById: 'owner', addedByName: 'Bold Zebra' }])
    expect(service.jamOf('owner')?.queue[0]?.addedByName).toBe('Bold Zebra')
  })

  it('restores persisted jams after a restart and hands over if the owner never returns', async () => {
    vi.useFakeTimers()
    try {
      const online = new Set(['guest'])
      const events: JamEvent[] = []
      const saved: unknown[] = []
      const persistence = {
        loadAll: async () => [
          {
            id: '11111111-1111-1111-1111-111111111111',
            ownerId: 'owner',
            allowGuestControl: false,
            playback: { track: track(7), playing: true, position: 42, at: 123 },
            queue: [track(8)],
            chat: [{ id: 1, fromId: 'owner', fromName: 'Owner', text: 'oi', at: 1 }],
            chatCounter: 1,
            lastActivity: 1,
            members: [
              { userId: 'owner', joinedAt: 100 },
              { userId: 'guest', joinedAt: 200 }
            ]
          }
        ],
        save: (row: unknown) => void saved.push(row),
        remove: () => undefined
      }
      const service = new JamService((event) => events.push(event), (id) => online.has(id), persistence)
      const restored = await service.restore()
      expect(restored).toBe(1)
      const jam = service.jamOf('guest')
      expect(jam?.ownerId).toBe('owner')
      expect(jam?.queue[0]?.trackId).toBe(8)
      expect(jam?.chat[0]?.text).toBe('oi')
      // the stamped moment is refreshed so followers do not fast-forward
      expect(jam!.playback.at).toBeGreaterThan(1000)

      // owner never reconnects → after the restore check + grace, guest takes over
      vi.advanceTimersByTime(91_000)
      vi.advanceTimersByTime(61_000)
      expect(service.jamOf('guest')?.ownerId).toBe('guest')
      expect(saved.length).toBeGreaterThan(0)
    } finally {
      vi.useRealTimers()
    }
  })

  it('idle jams are swept, active ones survive', () => {
    vi.useFakeTimers()
    try {
      const { service, events } = makeService()
      service.create('owner')
      service.updatePlayback('owner', { track: track(1), playing: true, position: 0 })
      vi.advanceTimersByTime(10 * 60 * 1000)
      service.heartbeat('owner') // active listener keeps it alive
      vi.advanceTimersByTime(15 * 60 * 1000)
      expect(service.jamOf('owner')).not.toBeNull()
      vi.advanceTimersByTime(21 * 60 * 1000) // no activity beyond TTL
      expect(service.jamOf('owner')).toBeNull()
      expect(events.some((event) => event.kind === 'ended')).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('queue updates are capped and validated upstream', () => {
    const { service } = makeService()
    service.create('owner')
    service.updateQueue('owner', Array.from({ length: 60 }, (_, i) => track(i + 1)))
    expect(service.jamOf('owner')?.queue.length).toBe(30)
  })
})

describe('wire validation', () => {
  it('accepts valid listening info and rejects junk', () => {
    expect(
      isListeningInfo({ trackId: 1, title: 'a', artist: 'b', artwork: null, playing: true })
    ).toBe(true)
    expect(isListeningInfo({ trackId: 'x', title: 'a', artist: 'b', artwork: null, playing: true })).toBe(false)
    expect(isListeningInfo({ trackId: 1, title: 'a'.repeat(500), artist: 'b', artwork: null, playing: true })).toBe(
      false
    )
    expect(isListeningInfo(null)).toBe(false)
  })

  it('validates jam track refs', () => {
    expect(isJamTrackRef(track(1))).toBe(true)
    expect(isJamTrackRef({ ...track(1), addedById: 'abc', addedByName: 'Bold Zebra' })).toBe(true)
    expect(isJamTrackRef({ ...track(1), addedByName: 'x'.repeat(60) })).toBe(false)
    expect(isJamTrackRef({ ...track(1), duration: -5 })).toBe(false)
    expect(isJamTrackRef({ ...track(1), trackId: 0 })).toBe(false)
    expect(isJamTrackRef({ ...track(1), title: '' })).toBe(false)
    expect(isJamTrackRef('nope')).toBe(false)
  })
})
