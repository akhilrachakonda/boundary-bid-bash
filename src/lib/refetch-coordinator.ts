/** Fixed-window invalidation batching with at most one read and one dirty bit per key. */
export function createRefetchCoordinator<K extends string>(read: (key: K) => Promise<unknown>, delay = 80) {
  const pending = new Set<K>();
  const running = new Map<K, Promise<unknown>>();
  const dirty = new Set<K>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  const refresh = (key: K): Promise<unknown> => {
    if (disposed) return Promise.resolve();
    const active = running.get(key);
    if (active) { dirty.add(key); return active; }
    const task = Promise.resolve().then(() => read(key)).finally(() => {
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
      keys.forEach(key => { void refresh(key).catch(() => {}); });
    }, delay);
  };
  return { refresh, schedule, dispose: () => { disposed = true; clearTimeout(timer); pending.clear(); dirty.clear(); } };
}