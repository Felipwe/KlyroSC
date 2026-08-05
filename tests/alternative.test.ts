import { describe, expect, it } from 'vitest'
import { pickAlternative, type AltCandidate, type AltOriginal } from '../src/shared/utils/alternative'

const original: AltOriginal = {
  id: 100,
  title: 'All Girls Are The Same',
  artist: 'Juice WRLD',
  fullDurationMs: 165000
}

const candidate = (over: Partial<AltCandidate>): AltCandidate => ({
  id: 1,
  title: 'Juice WRLD - All Girls Are The Same',
  artist: 'someone',
  fullDurationMs: 165000,
  snipped: false,
  policy: 'ALLOW',
  playbackCount: 1000,
  ...over
})

describe('pickAlternative', () => {
  it('picks a clean full-length reupload of the same song', () => {
    expect(pickAlternative(original, [candidate({ id: 7 })])).toBe(7)
  })

  it('never returns the original track itself', () => {
    expect(pickAlternative(original, [candidate({ id: 100 })])).toBeNull()
  })

  it('rejects snipped / Go+ candidates', () => {
    expect(pickAlternative(original, [candidate({ id: 8, snipped: true })])).toBeNull()
    expect(pickAlternative(original, [candidate({ id: 9, policy: 'SNIP' })])).toBeNull()
  })

  it('rejects remixes, slowed, sped and cover versions', () => {
    const edits = [
      candidate({ id: 2, title: 'All Girls Are The Same (Slowed + Reverb) Juice WRLD' }),
      candidate({ id: 3, title: 'All Girls Are The Same - Juice WRLD (sped up)' }),
      candidate({ id: 4, title: 'All Girls Are The Same (8D Audio) Juice WRLD' }),
      candidate({ id: 5, title: 'All Girls Are The Same Juice WRLD (Acoustic Cover)' }),
      candidate({ id: 6, title: 'Juice WRLD - All Girls Are The Same Pt. 2' })
    ]
    expect(pickAlternative(original, edits)).toBeNull()
  })

  it('rejects wildly different durations', () => {
    expect(pickAlternative(original, [candidate({ id: 11, fullDurationMs: 300000 })])).toBeNull()
  })

  it('rejects a same-title song from a different artist', () => {
    expect(
      pickAlternative(original, [
        candidate({ id: 12, title: 'All Girls Are The Same', artist: 'Random Kid' })
      ])
    ).toBeNull()
  })

  it('prefers the closest-duration clean match', () => {
    const picked = pickAlternative(original, [
      candidate({ id: 20, fullDurationMs: 173000 }),
      candidate({ id: 21, fullDurationMs: 165500 }),
      candidate({ id: 22, fullDurationMs: 158000 })
    ])
    expect(picked).toBe(21)
  })
})
