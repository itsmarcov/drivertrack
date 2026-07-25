const STORAGE_KEY = 'drivertrack_sounds_enabled';

let audioCtx = null;

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

export function areSoundsEnabled() {
  try { return localStorage.getItem(STORAGE_KEY) !== 'false'; } catch { return true; }
}

export function setSoundsEnabled(v) {
  try { localStorage.setItem(STORAGE_KEY, String(v)); } catch {}
}

function playTone(freq, duration, type = 'sine', volume = 0.18) {
  if (!areSoundsEnabled()) return;
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playSequence(notes) {
  if (!areSoundsEnabled()) return;
  const ctx = getCtx();
  let t = ctx.currentTime;
  notes.forEach(([freq, dur, vol = 0.18]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
    t += dur * 0.7;
  });
}

export function playSuccess() {
  playSequence([
    [523, 0.12],
    [659, 0.12],
    [784, 0.18],
  ]);
}

export function playError() {
  playSequence([
    [311, 0.15, 0.2],
    [233, 0.22, 0.2],
  ]);
}

export function playNotification() {
  playTone(880, 0.15, 'sine', 0.12);
}

export function playScan() {
  playSequence([
    [1047, 0.08, 0.14],
    [1319, 0.12, 0.14],
  ]);
}

export function playClick() {
  playTone(600, 0.05, 'square', 0.06);
}