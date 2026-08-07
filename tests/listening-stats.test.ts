import { describe, expect, it } from 'vitest'
import {
  applyReportAck,
  displayListeningMs,
  pendingDeltaMs,
  type ListeningLedger
} from '../src/shared/utils/listening-stats'

describe('listening stats ledger', () => {
  it('reports only the unacknowledged delta', () => {
    expect(pendingDeltaMs({ listeningMs: 10_000, reportedMs: 4_000, accountMs: 0 })).toBe(6_000)
    expect(pendingDeltaMs({ listeningMs: 10_000, reportedMs: 10_000, accountMs: 0 })).toBe(0)
    // watermark can never make the delta negative
    expect(pendingDeltaMs({ listeningMs: 5_000, reportedMs: 9_000, accountMs: 0 })).toBe(0)
  })

  it('acknowledging a report advances the watermark and caches the account total', () => {
    const ledger: ListeningLedger = { listeningMs: 12_000, reportedMs: 4_000, accountMs: 0 }
    const acked = applyReportAck(ledger, 10_000, 50_000)
    expect(acked).toEqual({ listeningMs: 12_000, reportedMs: 10_000, accountMs: 50_000 })
    // watermark is clamped to what the device actually counted
    expect(applyReportAck(ledger, 99_000, 50_000).reportedMs).toBe(12_000)
    // a non-positive total keeps the previous known account value
    expect(applyReportAck({ ...ledger, accountMs: 7_000 }, 10_000, 0).accountMs).toBe(7_000)
  })

  it('shows the local counter until the server total is known', () => {
    expect(displayListeningMs({ listeningMs: 1_200_000, reportedMs: 1_200_000, accountMs: 0 })).toBe(1_200_000)
  })

  it('device reset keeps showing the account total (20min vs 9h30m bug)', () => {
    // fresh install: local counter restarted at 20min, server still holds 9h30m
    let ledger: ListeningLedger = { listeningMs: 1_200_000, reportedMs: 1_200_000, accountMs: 0 }
    // first report acknowledged with the account-wide total
    ledger = applyReportAck(ledger, 1_200_000, 34_200_000)
    expect(displayListeningMs(ledger)).toBe(34_200_000)
    // 5 more minutes listened locally show up immediately on top of the account total
    ledger = { ...ledger, listeningMs: ledger.listeningMs + 300_000 }
    expect(pendingDeltaMs(ledger)).toBe(300_000)
    expect(displayListeningMs(ledger)).toBe(34_500_000)
  })
})
