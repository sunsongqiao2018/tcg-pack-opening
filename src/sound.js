let _ctx = null;
function getCtx() {
  if (!_ctx) _ctx = new AudioContext();
  return _ctx;
}

function noise(duration) {
  const c = getCtx();
  const n = Math.ceil(c.sampleRate * duration);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  return src;
}

function osc(freq, type = 'sine') {
  const c = getCtx();
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  return o;
}

function gain(val) {
  const g = getCtx().createGain();
  g.gain.value = val;
  return g;
}

export function resumeAudio() {
  if (_ctx && _ctx.state === 'suspended') _ctx.resume();
}

export function playTear() {
  const c = getCtx();
  const n = noise(0.22);
  const bpf = c.createBiquadFilter();
  bpf.type = 'bandpass'; bpf.frequency.value = 900; bpf.Q.value = 0.8;
  const g1 = gain(0);
  g1.gain.linearRampToValueAtTime(0.9, c.currentTime + 0.01);
  g1.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.22);
  n.connect(bpf); bpf.connect(g1); g1.connect(c.destination);
  n.start(); n.stop(c.currentTime + 0.22);

  const o = osc(60);
  const g2 = gain(0);
  g2.gain.linearRampToValueAtTime(0.6, c.currentTime + 0.03);
  g2.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.22);
  o.connect(g2); g2.connect(c.destination);
  o.start(); o.stop(c.currentTime + 0.22);
}

export function playCardSlide() {
  const c = getCtx();
  const n = noise(0.12);
  const lpf = c.createBiquadFilter();
  lpf.type = 'lowpass'; lpf.frequency.value = 400;
  const g = gain(0);
  g.gain.linearRampToValueAtTime(0.25, c.currentTime + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
  n.connect(lpf); lpf.connect(g); g.connect(c.destination);
  n.start(); n.stop(c.currentTime + 0.12);
}

export function playFlip(rarity) {
  const c = getCtx();
  const vol = { legendary: 1.3, rare: 0.9, uncommon: 0.65, common: 0.5 }[rarity] ?? 0.5;
  const n = noise(0.09);
  const hpf = c.createBiquadFilter();
  hpf.type = 'highpass'; hpf.frequency.value = 1800;
  const g = gain(0);
  g.gain.linearRampToValueAtTime(vol, c.currentTime + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.09);
  n.connect(hpf); hpf.connect(g); g.connect(c.destination);
  n.start(); n.stop(c.currentTime + 0.09);
}

export function playReveal(rarity) {
  const c = getCtx();
  if (rarity === 'legendary') {
    // Am chord (A3, C4, E4)
    [[220, 0], [261.6, 0.07], [329.6, 0.12]].forEach(([freq, delay]) => {
      const o = osc(freq, 'triangle');
      const g = gain(0);
      g.gain.linearRampToValueAtTime(0.16, c.currentTime + delay + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + 1.8);
      o.connect(g); g.connect(c.destination);
      o.start(c.currentTime + delay); o.stop(c.currentTime + delay + 1.8);
    });
    const crack = noise(0.06);
    const g2 = gain(0);
    g2.gain.linearRampToValueAtTime(0.9, c.currentTime + 0.005);
    g2.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.06);
    crack.connect(g2); g2.connect(c.destination);
    crack.start(); crack.stop(c.currentTime + 0.06);
  } else if (rarity === 'rare' || rarity === 'uncommon') {
    const vol = rarity === 'rare' ? 1.0 : 0.7;
    [[220, 0], [330, 0], [440, 0]].forEach(([freq]) => {
      const o = osc(freq, 'triangle');
      o.frequency.exponentialRampToValueAtTime(freq * 3, c.currentTime + 0.35);
      const g = gain(0);
      g.gain.linearRampToValueAtTime(0.12 * vol, c.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4);
      o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.4);
    });
  } else {
    const o = osc(440, 'triangle');
    o.frequency.exponentialRampToValueAtTime(220, c.currentTime + 0.08);
    const g = gain(0);
    g.gain.linearRampToValueAtTime(0.07, c.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
    o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime + 0.12);
  }
}

// Returns a stop() function to fade out the build-up early
export function playLegendaryBuildUp() {
  const c = getCtx();
  const o = osc(55, 'sawtooth');
  o.frequency.linearRampToValueAtTime(110, c.currentTime + 1.5);
  const lpf = c.createBiquadFilter();
  lpf.type = 'lowpass'; lpf.frequency.value = 180;
  const g = gain(0);
  g.gain.linearRampToValueAtTime(0.35, c.currentTime + 0.2);
  o.connect(lpf); lpf.connect(g); g.connect(c.destination);
  o.start(); o.stop(c.currentTime + 4);
  return () => {
    g.gain.cancelScheduledValues(c.currentTime);
    g.gain.linearRampToValueAtTime(0, c.currentTime + 0.12);
  };
}
