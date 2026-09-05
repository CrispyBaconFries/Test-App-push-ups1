#!/usr/bin/env node
/**
 * Generates the two short confirmation sounds used by src/audio/repSounds.ts
 * (assets/sounds/rep-good.wav, rep-warn.wav) as plain synthesized sine tones - no
 * external audio assets/licensing to track. Re-run this after changing the tones
 * below; the output files are committed to the repo, this script isn't run at build
 * time.
 */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'sounds');
const SAMPLE_RATE = 44100;

function writeWav(filePath, samples, sampleRate) {
  const dataSize = samples.length * 2; // 16-bit mono
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }

  fs.writeFileSync(filePath, buffer);
}

function envelope(t, duration, attack, release) {
  if (t < attack) return t / attack;
  if (t > duration - release) return Math.max(0, (duration - t) / release);
  return 1;
}

function tone(freq, duration, amplitude, attack, release) {
  const n = Math.floor(duration * SAMPLE_RATE);
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    out[i] = amplitude * envelope(t, duration, attack, release) * Math.sin(2 * Math.PI * freq * t);
  }
  return out;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

// "Good rep": bright ascending two-note chime (A5 -> C#6, a major third), short & satisfying.
writeWav(
  path.join(OUT_DIR, 'rep-good.wav'),
  [...tone(880.0, 0.11, 0.5, 0.005, 0.05), ...tone(1108.73, 0.16, 0.5, 0.005, 0.09)],
  SAMPLE_RATE
);

// "Counted, check your form": a single softer, lower tone - acknowledges the rep without celebrating it.
writeWav(path.join(OUT_DIR, 'rep-warn.wav'), tone(392.0, 0.14, 0.35, 0.005, 0.08), SAMPLE_RATE);

console.log(`Wrote rep-good.wav and rep-warn.wav to ${OUT_DIR}`);
