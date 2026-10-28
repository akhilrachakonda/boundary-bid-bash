let ctx: AudioContext | null = null;

/** Synthesised auctioneer's hammer: a short low thump plus a wooden click. */
export function playHammer() {
  try {
    ctx ??= new AudioContext();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.25);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.32);
    const n = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, 2205, 44100);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
    n.buffer = buf;
    const ng = ctx.createGain();
    ng.gain.value = 0.5;
    n.connect(ng).connect(ctx.destination);
    n.start(t);
  } catch {
    /* audio unavailable */
  }
}

export function getSoundPref() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("auction-sound") === "on";
}
export function playBid() {
  try {
    ctx ??= new AudioContext();
    const tone=ctx.createOscillator();const gain=ctx.createGain();const t=ctx.currentTime;
    tone.frequency.setValueAtTime(520,t);tone.frequency.exponentialRampToValueAtTime(740,t+.08);
    gain.gain.setValueAtTime(.06,t);gain.gain.exponentialRampToValueAtTime(.001,t+.12);
    tone.connect(gain).connect(ctx.destination);tone.start(t);tone.stop(t+.13);
  } catch { /* optional audio unavailable */ }
}
export function setSoundPref(on: boolean) {
  localStorage.setItem("auction-sound", on ? "on" : "off");
}
