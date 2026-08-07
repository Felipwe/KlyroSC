/** Account-wide listening time bookkeeping.
 *
 * Each device counts locally (`listeningMs`) and periodically reports the
 * still-unacknowledged delta; the server accumulates deltas into the account
 * total, so time adds up across machines and survives reinstalls. `reportedMs`
 * is the watermark of local time already acknowledged by the server and
 * `accountMs` the last account total it returned (0 = unknown yet).
 */
export interface ListeningLedger {
  listeningMs: number
  reportedMs: number
  accountMs: number
}

/** Local listening time not yet acknowledged by the server. */
export const pendingDeltaMs = (ledger: ListeningLedger): number =>
  Math.max(0, Math.round(ledger.listeningMs - ledger.reportedMs))

/** Ledger after the server acknowledged a report sent at device time `sentMs`. */
export const applyReportAck = (
  ledger: ListeningLedger,
  sentMs: number,
  accountTotalMs: number
): ListeningLedger => ({
  listeningMs: ledger.listeningMs,
  reportedMs: Math.min(Math.max(ledger.reportedMs, sentMs), ledger.listeningMs),
  accountMs: accountTotalMs > 0 ? accountTotalMs : ledger.accountMs
})

/** What the profile shows: the account total plus local time still unreported. */
export const displayListeningMs = (ledger: ListeningLedger): number =>
  ledger.accountMs > 0 ? ledger.accountMs + pendingDeltaMs(ledger) : ledger.listeningMs
