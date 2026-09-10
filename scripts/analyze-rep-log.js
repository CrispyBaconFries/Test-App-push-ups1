#!/usr/bin/env node
/**
 * Wertet einen Kalibrier-Log aus (die JSON-Datei, die der DEV-Teilen-Knopf auf dem
 * HomeScreen ausgibt, siehe src/pose/calibrationLogger.ts).
 *
 * Aufruf:
 *   node scripts/analyze-rep-log.js [pfad/zur/datei.json]
 * Ohne Argument wird der eingecheckte Datensatz docs/messdaten/2026-09-09-reps.json
 * ausgewertet.
 *
 * Warum es dieses Skript gibt: Die Schwellwerte in DEFAULT_THRESHOLDS sollen aus echten
 * Messungen kommen, nicht aus Schätzungen. Dafür braucht es immer dieselbe Auswertung -
 * sonst vergleicht man beim nächsten Mal Äpfel mit Birnen. Die drei Kennzahlen, auf die
 * es dabei ankommt:
 *
 *   1. Wie oft eine Prüfung anschlägt. Alles jenseits von etwa 50 % ist keine Prüfung
 *      mehr, sondern eine Konstante, und trägt keine Information.
 *   2. Wie viele Wiederholungen die Schwelle überhaupt je erreichen. Liegt die Schwelle
 *      über dem 90. Perzentil aller je gemessenen Werte, ist sie nicht streng, sondern
 *      falsch.
 *   3. Wie oft die Hüftrichtung zwischen aufeinanderfolgenden Wiederholungen kippt.
 *      Ein Wechsel zwischen "sackt durch" und "zu hoch" bei nahezu gleichem Winkel ist
 *      der Fingerabdruck von Rauschen, nicht von Technik.
 */
const fs = require('fs');
const path = require('path');

const DEFAULT_FILE = path.join(__dirname, '..', 'docs', 'messdaten', '2026-09-09-reps.json');
const file = process.argv[2] || DEFAULT_FILE;

// Muss mit DEFAULT_THRESHOLDS in src/pose/formAnalysis.ts übereinstimmen.
//
// ACHTUNG beim Vergleich alter mit neuen Aufzeichnungen: `minHipStraightnessDeg` misst
// seit dem 10.09.2026 den Winkel Schulter-Hüfte-KNIE statt Schulter-Hüfte-Knöchel. Die
// Hüftspalte aus Aufzeichnungen davor ist mit neueren deshalb nicht vergleichbar - die
// alten Werte sind durch den auf den Zehen stehenden Fuß systematisch zu klein.
const THRESHOLDS = {
  goodDepthElbowDeg: 95,
  minHipStraightnessDeg: 145,
  maxElbowFlareDeg: 80,
  minNeckAngleDeg: 115,
  minRepDurationMs: 600,
  maxRepDurationMs: 12000,
};

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function percentile(values, p) {
  const s = [...values].sort((a, b) => a - b);
  if (s.length === 0) return NaN;
  if (s.length === 1) return s[0];
  const rank = ((s.length - 1) * p) / 100;
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (rank - lo);
}

const defined = (values) => values.filter((v) => typeof v === 'number' && Number.isFinite(v));

if (!fs.existsSync(file)) {
  console.error(`Datei nicht gefunden: ${file}`);
  process.exit(1);
}
const entries = JSON.parse(fs.readFileSync(file, 'utf8'));

// Einträge ohne `kind` stammen aus Aufzeichnungen vor dem 09.09.2026, als es nur
// gezählte Wiederholungen gab.
const reps = entries.filter((e) => (e.kind ?? 'rep') === 'rep');
const discards = entries.filter((e) => e.kind === 'discarded');
const baselines = entries.filter((e) => e.kind === 'baseline');

// Eine neue Sitzung beginnt, wo der Wiederholungszähler wieder bei 0 anfängt.
const sessions = [];
for (const rep of reps) {
  if (rep.index === 0 || sessions.length === 0) sessions.push([]);
  sessions[sessions.length - 1].push(rep);
}

console.log(`Datei: ${path.relative(process.cwd(), file)}`);
console.log(`Gezählte Wiederholungen: ${reps.length}   Sitzungen: ${sessions.length}`);
if (discards.length > 0) {
  const byReason = {};
  for (const d of discards) byReason[d.reason] = (byReason[d.reason] ?? 0) + 1;
  console.log(
    `Verworfene Bewegungen: ${discards.length}  (` +
      Object.entries(byReason)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ') +
      ')'
  );
  // Der Winkelbereich entscheidet, wie ein TOO_LONG zu lesen ist: Ein weiter Bereich
  // heißt "hier stecken mehrere echte Wiederholungen drin" (verschmolzen), ein enger
  // heißt "die Person hat sich nicht bewegt".
  for (const d of discards) {
    const range =
      typeof d.minElbowAngleDeg === 'number' && typeof d.maxElbowAngleDeg === 'number'
        ? `Ellbogen ${d.minElbowAngleDeg}-${d.maxElbowAngleDeg}°`
        : 'Winkelbereich nicht aufgezeichnet';
    const hint =
      typeof d.minElbowAngleDeg === 'number' && d.maxElbowAngleDeg - d.minElbowAngleDeg > 50
        ? '  <-- weiter Bereich: hier steckten echte Wiederholungen drin'
        : '';
    // Ein TRACKING_LOST mit vielen "aus dem Bild"-Frames heißt "steh weiter weg vom
    // Handy", eines mit 0 heißt "MediaPipe hat die Pose verloren" - zwei völlig
    // verschiedene Ursachen, die ohne diese Zahl gleich aussehen.
    const outOfFrame =
      typeof d.outOfFrameFrames === 'number' && d.outOfFrameFrames > 0
        ? `, davon ${d.outOfFrameFrames} ausserhalb des Bildes`
        : '';
    console.log(
      `    ${String(d.reason).padEnd(14)} ${String(d.durationMs).padStart(6)} ms, ` +
        `${d.trackedFrames} Frames verfolgt / ${d.untrackedFrames} verloren${outOfFrame}, ${range}${hint}`
    );
  }
} else {
  console.log('Verworfene Bewegungen: keine aufgezeichnet (Aufzeichnung vor dem 09.09.2026?)');
}

// Die in der gehaltenen Startposition gemessene Grundhaltung (siehe src/pose/startPosition.ts).
// Ohne sie sind die Hüft- und Nackenwerte weiter unten nicht deutbar: 140° heißt bei einer
// Grundhaltung von 180° etwas anderes als bei 150°.
if (baselines.length > 0) {
  console.log('\n--- Grundhaltung (Startposition) --------------------------------------------');
  console.log('  Zeit                 Ellbogen  Hüfte  Nacken  Flare  waagerecht  Frames  gehalten');
  for (const b of baselines) {
    const time = (b.recordedAtIso ?? '').slice(0, 19).replace('T', ' ');
    const num = (v) => (typeof v === 'number' ? String(v).padStart(5) : '    -');
    console.log(
      `  ${time}  ${num(b.topElbowAngleDeg)}°    ${num(b.neutralHipStraightnessDeg)}°  ` +
        `${num(b.neutralNeckAngleDeg)}°  ${num(b.neutralElbowFlareDeg)}°  ` +
        `${num(b.torsoHorizontalRatio)}       ${String(b.samples).padStart(6)}  ${String(b.heldMs).padStart(6)} ms`
    );
  }
  // Prüfbare Annahme: Ein Stütz sollte im Bild deutlich waagerecht liegen. Bestätigt sich
  // das, kann daraus eine von der Hüfte unabhängige Stehen-Erkennung werden (siehe README).
  const horizontal = defined(baselines.map((b) => b.torsoHorizontalRatio));
  if (horizontal.length > 0) {
    console.log(
      `  -> Rumpflage im Bild: ${Math.min(...horizontal)}-${Math.max(...horizontal)} ` +
        '(1 = waagerecht/Stütz, 0 = senkrecht/stehend). Deutlich über 0,5 = Annahme bestätigt.'
    );
  }
  const hips = defined(baselines.map((b) => b.neutralHipStraightnessDeg));
  if (hips.length > 0) {
    console.log(
      `  -> Persönliche Hüft-Schwelle wäre ${Math.min(...hips) - 20}-${Math.max(...hips) - 20}° ` +
        '(Grundhaltung minus 20°, gedeckelt auf höchstens den allgemeinen Wert von 145°).'
    );
  }
} else {
  console.log('Grundhaltung: nicht aufgezeichnet (Aufzeichnung vor dem 10.09.2026?)');
}

console.log('\n--- Sitzungen ---------------------------------------------------------------');
console.log('  #  Start                 n  Score  Tiefe  Hüfte (Spanne)    Flare  Nacken');
sessions.forEach((s, i) => {
  const hip = defined(s.map((r) => r.minHipStraightnessDeg));
  const start = (s[0].recordedAtIso ?? '').slice(0, 19).replace('T', ' ');
  const span = hip.length ? `${Math.min(...hip)}-${Math.max(...hip)}` : '-';
  const med = (values) => (values.length ? String(Math.round(median(values))) : '-');
  console.log(
    `  ${String(i + 1).padStart(2)}  ${start.padEnd(20)} ${String(s.length).padStart(3)}` +
      `  ${med(s.map((r) => r.formScore)).padStart(5)}` +
      `  ${med(s.map((r) => r.minElbowAngleDeg)).padStart(5)}` +
      `  ${med(hip).padStart(5)} (${span.padStart(7)})` +
      `  ${med(defined(s.map((r) => r.maxElbowFlareDeg))).padStart(5)}` +
      `  ${med(defined(s.map((r) => r.minNeckAngleDeg))).padStart(6)}`
  );
});

console.log('\n--- Wie oft schlägt welche Prüfung an? --------------------------------------');
const counts = {};
for (const r of reps) for (const issue of r.issues ?? []) counts[issue] = (counts[issue] ?? 0) + 1;
Object.entries(counts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([issue, n]) => {
    const share = (n / reps.length) * 100;
    const warn = share > 50 ? '  <-- trägt so keine Information mehr' : '';
    console.log(`  ${issue.padEnd(20)} ${String(n).padStart(4)}  ${share.toFixed(1).padStart(5)} %${warn}`);
  });

console.log('\n--- Liegen die Schwellen überhaupt im gemessenen Bereich? -------------------');
const checks = [
  ['Tiefe (kleiner ist besser)', 'minElbowAngleDeg', THRESHOLDS.goodDepthElbowDeg, 'below'],
  ['Hüftgerade (größer ist besser)', 'minHipStraightnessDeg', THRESHOLDS.minHipStraightnessDeg, 'above'],
  ['Ellbogen-Flare (kleiner ist besser)', 'maxElbowFlareDeg', THRESHOLDS.maxElbowFlareDeg, 'below'],
  ['Nackenwinkel (größer ist besser)', 'minNeckAngleDeg', THRESHOLDS.minNeckAngleDeg, 'above'],
];
for (const [label, key, threshold, direction] of checks) {
  const values = defined(reps.map((r) => r[key]));
  if (values.length === 0) continue;
  const pass = values.filter((v) => (direction === 'above' ? v >= threshold : v <= threshold)).length;
  const p10 = percentile(values, 10);
  const p90 = percentile(values, 90);
  // Zwei verschiedene Befunde, die nicht verwechselt werden dürfen:
  //   unerreichbar - die Schwelle liegt jenseits von dem, was fast niemand je erreicht.
  //                  Dann misst sie nicht mehr die Person, sondern die Methode. Das ist
  //                  der Fehler, der HEAD_MISALIGNED bei 93 % anschlagen ließ.
  //   wirkungslos  - die Prüfung schlägt nie an. Nicht falsch, aber sie trägt nichts bei
  //                  und man sollte wissen, dass sie faktisch abgeschaltet ist.
  const unreachable = direction === 'above' ? threshold > p90 : threshold < p10;
  const inert = pass === values.length;
  const note = unreachable
    ? `   <-- unerreichbar: Schwelle jenseits von p${direction === 'above' ? '90' : '10'}`
    : inert
      ? '   (schlägt in diesem Datensatz nie an)'
      : '';
  console.log(
    `  ${label.padEnd(36)} Schwelle ${String(threshold).padStart(3)}°  ` +
      `p10 ${p10.toFixed(0).padStart(3)}  Median ${median(values).toFixed(0).padStart(3)}  p90 ${p90.toFixed(0).padStart(3)}  ` +
      `eingehalten: ${pass}/${values.length}` +
      note
  );
}

console.log('\n--- Kippt die Hüftrichtung zwischen benachbarten Wiederholungen? ------------');
let pairs = 0;
let flips = 0;
let closeFlips = 0;
for (const s of sessions) {
  for (let i = 1; i < s.length; i += 1) {
    const dir = (r) =>
      r.issues?.includes('HIPS_SAGGING') ? 'sag' : r.issues?.includes('HIPS_PIKING') ? 'pike' : null;
    const a = dir(s[i - 1]);
    const b = dir(s[i]);
    if (!a || !b) continue;
    pairs += 1;
    if (a === b) continue;
    flips += 1;
    const delta = Math.abs((s[i - 1].minHipStraightnessDeg ?? 0) - (s[i].minHipStraightnessDeg ?? 0));
    if (delta <= 8) closeFlips += 1;
  }
}
if (pairs === 0) {
  console.log('  Zu wenige Hüft-Meldungen für eine Aussage.');
} else {
  console.log(`  Benachbarte Paare mit Hüft-Meldung: ${pairs}`);
  console.log(`  davon Richtungswechsel sackt-durch <-> zu-hoch: ${flips} (${((flips / pairs) * 100).toFixed(0)} %)`);
  console.log(`  davon bei höchstens 8° Winkelunterschied: ${closeFlips}   <-- das ist Rauschen, keine Technik`);
}

console.log('\n--- Was würde die Segmentierung heute aussortieren? -------------------------');
const durations = defined(reps.map((r) => r.durationMs));
const tooShort = durations.filter((d) => d < THRESHOLDS.minRepDurationMs).length;
const tooLong = durations.filter((d) => d > THRESHOLDS.maxRepDurationMs).length;
console.log(`  zu kurz (< ${THRESHOLDS.minRepDurationMs} ms, Doppelzählung):  ${tooShort}`);
console.log(`  zu lang (> ${THRESHOLDS.maxRepDurationMs} ms, Zähler hing):    ${tooLong}`);
console.log(
  `  zusammen ${tooShort + tooLong} von ${reps.length} (${(((tooShort + tooLong) / reps.length) * 100).toFixed(0)} %) - ` +
    'diese Wiederholungen zählen seit dem 09.09.2026 nicht mehr mit.'
);
