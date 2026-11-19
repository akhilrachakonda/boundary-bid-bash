/** Fixed-window invalidation batching with at most one read and one dirty bit per key. */
export function createRefetchCoordinator<K extends string>(read: (key: K) => Promise<unknown>, delay = 80) {
  const pending = new Set<K>();
  const running = new Map<K, Promise<unknown>>();
  const dirty = new Set<K>();
  const failures = new Map<K, number>();
  const retryAt = new Map<K, number>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  const refresh = (key: K): Promise<unknown> => {
    if (disposed) return Promise.resolve();
    const active = running.get(key);
    if (active) { dirty.add(key); return active; }
    const task = Promise.resolve().then(() => read(key)).then(value => {
      failures.delete(key); retryAt.delete(key); return value;
    }, error => {
      const count = (failures.get(key) ?? 0) + 1;
      failures.set(key, count);
      retryAt.set(key, Date.now() + Math.min(30000, 1000 * 2 ** Math.min(count - 1, 5)));
      throw error;
    }).finally(() => {
      running.delete(key);
      if (!disposed && dirty.delete(key)) schedule(key);
    });
    running.set(key, task);
    return task;
  };
  const schedule = (key: K) => {
    if (disposed) return;
    pending.add(key);
    if (timer) return;
    timer = setTimeout(() => {
      timer = undefined;
      const keys = [...pending]; pending.clear();
      keys.forEach(key => {
        const wait = (retryAt.get(key) ?? 0) - Date.now();
        if (wait > 0) { pending.add(key); return; }
        void refresh(key).catch(() => { schedule(key); });
      });
      if (pending.size) schedule([...pending][0]);
    }, delay);
  };
  return { refresh, schedule, dispose: () => { disposed = true; clearTimeout(timer); pending.clear(); dirty.clear(); failures.clear(); retryAt.clear(); } };
}