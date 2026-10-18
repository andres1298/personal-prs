// Synthesized cue effects (no voice, no audio files). iOS only allows audio
// after a user gesture, so unlock() must run inside a tap handler.

// [frequency Hz, offset s, duration s]
const SOUNDS = {
  tick:  [[880, 0, 0.12]],
  round: [[990, 0, 0.16]],
  start: [[1320, 0, 0.55]],
  half:  [[660, 0, 0.16], [990, 0.2, 0.28]],
  end:   [[1320, 0, 0.22], [990, 0.26, 0.22], [660, 0.52, 0.7]],
};

export function createSoundPlayer() {
  let context = null;

  function unlock() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      context ??= new AudioContextClass();
      if (context.state === 'suspended') context.resume();
      // A silent buffer started from the gesture fully unlocks output on iOS.
      const source = context.createBufferSource();
      source.buffer = context.createBuffer(1, 1, 22050);
      source.connect(context.destination);
      source.start(0);
    } catch {
      context = null;
    }
  }

  function play(cue) {
    const tones = SOUNDS[cue];
    if (!tones || !context) return;
    if (context.state === 'suspended') context.resume();
    const now = context.currentTime + 0.01;
    for (const [frequency, offset, duration] of tones) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'square';
      oscillator.frequency.value = frequency;
      const begin = now + offset;
      gain.gain.setValueAtTime(0.0001, begin);
      gain.gain.exponentialRampToValueAtTime(0.18, begin + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, begin + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(begin);
      oscillator.stop(begin + duration + 0.02);
    }
  }

  function close() {
    context?.close().catch(() => {});
    context = null;
  }

  return { unlock, play, close };
}
