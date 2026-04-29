// Synthesised SFX via the Web Audio API. No asset downloads. Each effect is
// a short envelope-shaped oscillator/noise burst — cheap, fast, and feels
// suitably arcade-y for a slot machine.

let ctx = null;
let muted = false;

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setMuted(m) {
  muted = m;
}

export function unlock() {
  // Browsers require a user gesture before audio can play. Call this on the
  // first PULL click.
  getCtx();
}

function tone({ freq = 440, dur = 0.1, type = 'sine', gain = 0.15, slide = 0 }) {
  if (muted) return;
  const c = getCtx();
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  if (slide) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, freq + slide),
      c.currentTime + dur
    );
  }
  g.gain.setValueAtTime(0, c.currentTime);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  osc.connect(g).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + dur + 0.02);
}

function noiseBurst({ dur = 0.08, gain = 0.1 }) {
  if (muted) return;
  const c = getCtx();
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(g).connect(c.destination);
  src.start();
}

export const sfx = {
  lever() {
    noiseBurst({ dur: 0.06, gain: 0.1 });
    tone({ freq: 180, dur: 0.12, type: 'square', gain: 0.06, slide: -60 });
  },
  reelStop() {
    tone({ freq: 500, dur: 0.06, type: 'square', gain: 0.08 });
  },
  lose() {
    tone({ freq: 220, dur: 0.18, type: 'sawtooth', gain: 0.1, slide: -120 });
  },
  win() {
    // Cheery arpeggio.
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      setTimeout(() => {
        tone({ freq: f, dur: 0.18, type: 'triangle', gain: 0.12 });
      }, i * 90);
    });
  },
  spinTick() {
    tone({ freq: 1200, dur: 0.02, type: 'square', gain: 0.03 });
  },
};
