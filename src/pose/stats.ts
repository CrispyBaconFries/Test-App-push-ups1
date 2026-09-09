/**
 * Kleine robuste Statistik-Helfer für die Formauswertung.
 *
 * Warum das ein eigenes Modul ist: Die Formbewertung hat bis 09.09.2026 den
 * *Extremwert* über eine Wiederholung benutzt (kleinster Hüftwinkel, größter
 * Ellbogen-Flare). Ein einziger verrutschter Frame hat damit über die ganze
 * Wiederholung entschieden. In den 124 aufgezeichneten Wiederholungen aus
 * `docs/messdaten/2026-09-09-reps.json` ist das messbar: Wiederholungen, bei denen die
 * Erkennung zwischendurch aussetzte, melden einen Ellbogen-Flare von im Median 138° -
 * ein Winkel, bei dem der Arm hinter dem Rücken stünde. Ein Perzentil statt des
 * Extremwerts macht genau diese Einzelausreißer wirkungslos, ohne echte Formfehler zu
 * verstecken: Wer wirklich durchhängt, hängt nicht in einem Frame durch, sondern in
 * vielen.
 */

/**
 * Linear interpoliertes Perzentil (`p` in 0..100) einer unsortierten Zahlenreihe.
 *
 * `p = 0` liefert das Minimum, `p = 100` das Maximum, `p = 50` den Median. Für die
 * Formauswertung wird bewusst nicht 0 bzw. 100 verwendet, sondern ein Stück davon
 * entfernt (siehe `PushUpThresholds.formPercentile`).
 *
 * Gibt `NaN` für eine leere Reihe zurück - das ist in `formAnalysis` genau der Fall
 * "diese Kennzahl wurde nie gemessen" und wird dort zu `null`. Die Eingabe wird nicht
 * verändert (es wird auf einer Kopie sortiert), weil die Aufrufer dieselben Arrays für
 * mehrere Perzentile weiterverwenden.
 */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];

  const clampedP = Math.min(100, Math.max(0, p));
  const rank = ((sorted.length - 1) * clampedP) / 100;
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (rank - lower);
}

/**
 * Der `n`-kleinste Wert (0-basiert), also ein gegen Ausreißer abgesichertes Minimum.
 *
 * Warum das neben `percentile` existiert: Beide Aufgaben sehen ähnlich aus, sind es aber
 * nicht.
 *
 * - Hüftgerade, Nackenwinkel und Ellbogen-Flare sollen über eine saubere Wiederholung
 *   *ungefähr konstant* bleiben. Dort ist ein Perzentil über alle Frames genau richtig:
 *   Wer wirklich durchhängt, hängt in vielen Frames durch, nicht in einem.
 * - Die Ellbogen-Tiefe ist dagegen der **Umkehrpunkt einer Bewegung**. Der Winkel läuft
 *   von 170° auf 90° und zurück; nur wenige Frames liegen überhaupt in der Nähe des
 *   Tiefpunkts. Ein Perzentil über den ganzen Bogen würde die Tiefe deshalb systematisch
 *   zu flach schätzen - und zwar umso stärker, je langsamer jemand die Wiederholung
 *   ausführt. Hier ist der n-kleinste Wert richtig: Er überspringt einzelne Ausreißer,
 *   bleibt aber am echten Umkehrpunkt.
 *
 * `n` wird auf den Median begrenzt. Bei sehr kurzen Reihen (wenige Frames) darf das
 * Überspringen von Ausreißern sonst über die Mitte hinausschießen und aus dem Minimum
 * praktisch das Maximum machen.
 */
export function nthSmallest(values: readonly number[], n: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const maxIndex = Math.floor((sorted.length - 1) / 2);
  return sorted[Math.min(Math.max(0, Math.trunc(n)), maxIndex)];
}
