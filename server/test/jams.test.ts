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

function makeService(): { service: JamService; events: JamEvent[] } {
  const events: JamEvent[] = []
  const service = new JamService((event) => events.push(event))
  return { service, events }
}

describe('JamService', () => {
  it('creates a jam with the owner as only member', () => {
    const { service } = makeService()
    const jam = service.create('owner')
    expect(jam.ownerId).toBe('owner')
    expect([...jam.members]).toEqual(['owner'])
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

  it('owner leaving ends the jam for everyone', () => {
    const { service, events } = makeService()
    service.create('owner')
    service.invite('owner', 'guest')
    service.acceptInvite('guest', service.invitesFor('guest')[0]!.id)
    service.leave('owner')
    expect(service.jamOf('owner')).toBeNull()
    expect(service.jamOf('guest')).toBeNull()
    expect(events.some((event) => event.kind === 'ended')).toBe(true)
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
    expect(isJamTrackRef({ ...track(1), duration: -5 })).toBe(false)
    expect(isJamTrackRef({ ...track(1), trackId: 0 })).toBe(false)
    expect(isJamTrackRef({ ...track(1), title: '' })).toBe(false)
    expect(isJamTrackRef('nope')).toBe(false)
  })
})
