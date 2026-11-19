/** Only explicit authorization failures mean membership was lost. Transport errors never do. */
export function membershipFailure(error: { code?: string; message?: string } | null) {
  return error?.code === 'P0001' && /not a member|room not found|join this room|not in this room/i.test(error.message ?? '');
}
export function recoveryDelay(failures: number) {
  return Math.min(30000, 1000 * 2 ** Math.min(5, Math.max(0, failures - 1)));
}
/** Memory-only aggregates. Never record identity, room codes, payloads, tokens or error text. */
export const connectionDiagnostics = {
  reads: 0, failures: 0, recoveries: 0, lastReadMs: 0,
};