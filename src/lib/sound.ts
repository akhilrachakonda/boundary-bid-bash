let ctx: AudioContext | null = null;
let celebration: HTMLAudioElement | null = null;
let celebrationTimeout: ReturnType<typeof setTimeout> | undefined;
let playbackId = 0;

const teamAliases: Record<string,string> = {
  csk:'CSK', chennai:'CSK', chennaisuperkings:'CSK',
  mi:'MI', mumbai:'MI', mumbaiindians:'MI',
  rcb:'RCB', royalchallengersbengaluru:'RCB', royalchallengersbangalore:'RCB',
  kkr:'KKR', kolkata:'KKR', kolkataknightriders:'KKR',
  dc:'DC', delhi:'DC', delhicapitals:'DC',
  pbks:'PBKS', punjab:'PBKS', punjabkings:'PBKS',
  rr:'RR', rajasthan:'RR', rajasthanroyals:'RR',
  srh:'SRH', hyderabad:'SRH', sunrisershyderabad:'SRH',
  lsg:'LSG', lucknow:'LSG', lucknowsupergiants:'LSG',
  gt:'GT', gujarat:'GT', gujarattitans:'GT',
};

export function celebrationTrack(kind: 'sold'|'unsold', teamName?: string) {
  if (kind === 'unsold') return '/audio/crickauction/unsold1.mpeg';
  const code = teamAliases[(teamName ?? '').toLowerCase().replace(/[^a-z]/g,'')];
  return code ? `/audio/crickauction/${code}.mp3` : null;
}

export function stopCelebration() {
  playbackId++;
  clearTimeout(celebrationTimeout);
  if (celebration) { celebration.pause(); celebration.currentTime = 0; }
}

/** Called from an explicit sound-toggle gesture, including on mobile Safari. */
export function unlockSound() {
  try {
    ctx ??= new AudioContext();
    void ctx.resume().catch(() => {});
    celebration ??= new Audio();
    celebration.preload = 'auto';
    celebration.src = '/audio/crickauction/unsold1.mpeg';
    celebration.volume = 0;
    const token = ++playbackId;
    void celebration.play().then(() => {
      if (token === playbackId) stopCelebration();
    }).catch(() => {});
  } catch { /* Optional audio must never block an auction action. */ }
}

export function playCelebration(kind: 'sold'|'unsold', teamName?: string) {
  stopCelebration();
  const track = celebrationTrack(kind, teamName);
  if (!track) { if (kind === 'sold') playHammer(); return; }
  try {
    celebration ??= new Audio();
    celebration.src = track;
    celebration.volume = kind === 'sold' ? 0.5 : 0.6;
    const token = playbackId;
    void celebration.play().catch(() => {
      if (token === playbackId && kind === 'sold') playHammer();
    });
    celebrationTimeout = setTimeout(stopCelebration, 2600);
  } catch { if (kind === 'sold') playHammer(); }
}

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
  if (on) unlockSound();
  else stopCelebration();
}
