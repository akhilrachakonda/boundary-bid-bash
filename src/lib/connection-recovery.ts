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
export const HEARTBEAT_MS = 25_000;
export const ONLINE_WINDOW_MS = 65_000;
export const HOST_GRACE_MS = 120_000;

export function roomReadsAvailable() {
  return navigator.onLine && document.visibilityState !== "hidden";
}

export function transportFailure(error: { message?: string; code?: string }) {
  return /failed to fetch|fetch failed|networkerror|network request failed|load failed|aborterror|timed? ?out|timeout|abort(ed|ing)/i.test(error.message ?? "")
    && !/^[0-9A-Z]{5}$/.test(error.code ?? "");
}

export function actionError(error: { message: string; code?: string }) {
  return transportFailure(error) ? "Connection interrupted. Check the room before trying again." : error.message;
}
