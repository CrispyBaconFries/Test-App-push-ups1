import {
  allVisible,
  angleAtPoint,
  getLandmark,
  pickMoreVisibleSide,
  sideIndices,
  signedPerpendicularDeviation2D,
  type BodySide,
  type Pose,
} from './landmarks';
import { nthSmallest, percentile } from './stats';

export type RepPhase = 'up' | 'descending' | 'down' | 'ascending';

export type FormIssue =
  | 'INSUFFICIENT_DEPTH'
  | 'HIPS_SAGGING'
  | 'HIPS_PIKING'
  | 'ELBOWS_FLARED'
  | 'HEAD_MISALIGNED';

/**
 * Warum eine gezählte Bewegung doch nicht als Wiederholung durchgeht.
 *
 * - `TOO_SHORT`  - schneller als `minRepDurationMs`, also körperlich keine Wiederholung
 *                  (in den Messdaten vom 09.09.2026: 6 von 124 unter 500 ms).
 * - `TOO_LONG`   - länger als `maxRepDurationMs`; der Zähler hing, während sich jemand
 *                  hinlegte oder Pause machte (16 von 124, bis zu 34 Sekunden).
 * - `TRACKING_LOST` - über einen zu großen Teil der Wiederholung war keine verwertbare
 *                  Pose da, die Formwerte wären geraten.
 */
export type RepDiscardReason = 'TOO_SHORT' | 'TOO_LONG' | 'TRACKING_LOST';

/**
 * Eine verworfene Wiederholung. Wird nicht gezählt und nicht bewertet, aber gemeldet -
 * ohne diese Meldung wäre für die Aufrufer (und für spätere Kalibrierläufe) nicht
 * unterscheidbar, ob gerade niemand trainiert oder ob die Erkennung Wiederholungen
 * wegwirft.
 */
export interface DiscardedRep {
  reason: RepDiscardReason;
  durationMs: number;
  /** Frames mit verwertbarer Pose bzw. ohne, während dieser Wiederholung. */
  trackedFrames: number;
  untrackedFrames: number;
}

/**
 * Eine gezählte und bewertete Wiederholung.
 *
 * Zu den vier Winkel-Kennzahlen: Sie sind seit dem 09.09.2026 bewusst **keine**
 * Extremwerte mehr, sondern robuste Kennzahlen über alle Frames der Wiederholung (siehe
 * `PushUpThresholds.formPercentile` / `depthOutlierFrames` und `src/pose/stats.ts`). Die
 * Feldnamen bleiben, weil sie so in der gespeicherten Trainingshistorie und im
 * Kalibrier-Log stehen: "min" heißt jetzt "unteres Perzentil bzw. abgesichertes
 * Minimum", "max" entsprechend "oberes Perzentil".
 */
export interface RepResult {
  index: number;
  formScore: number;
  issues: FormIssue[];
  /** Always measured - shoulder/elbow/wrist are required for a rep to be counted at all. */
  minElbowAngleDeg: number;
  /**
   * `null` when the landmarks that check needs were never visible during the rep (e.g.
   * feet out of frame for the hip/knee-based checks). Deliberately not a number: these
   * are persisted via JSON.stringify (workout history, calibration log), and a
   * non-finite sentinel like Infinity silently becomes `null` there anyway - but typed
   * as `number`, which would then feed NaN into any later averaging.
   */
  minHipStraightnessDeg: number | null;
  maxElbowFlareDeg: number | null;
  minNeckAngleDeg: number | null;
  durationMs: number;
}

export interface LiveFeedback {
  phase: RepPhase;
  trackingOk: boolean;
  elbowAngleDeg: number;
  hipStraightnessDeg: number;
  cue: FormIssue | 'GOOD_FORM' | null;
}

export interface PushUpThresholds {
  /** Elbow angle (deg) above which the arm counts as "locked out" / top of the rep. */
  elbowUpDeg: number;
  /**
   * Elbow angle (deg) that, once crossed on the way down, marks this as a genuine rep
   * attempt rather than noise near lockout. Crossing it guarantees the rep will be
   * counted (and scored) once the arm returns to `elbowUpDeg` - even if the user never
   * gets anywhere near `goodDepthElbowDeg`. Only movement that never reaches this bar
   * is discarded as a false start.
   */
  elbowAttemptDeg: number;
  /** Elbow angle (deg) a rep must reach at minimum to count as full depth. */
  goodDepthElbowDeg: number;
  /**
   * shoulder-hip-KNEE angle (deg); below this the torso counts as not straight (sag or pike).
   *
   * Bewusst über das Knie und nicht über den Knöchel: Beim Liegestütz steht der Fuß auf
   * den Zehen, der Knöchel liegt damit deutlich *unterhalb* der Körperlinie
   * Schulter-Hüfte-Knie. Über den Knöchel gemessen ist der Winkel deshalb auch bei
   * kerzengeradem Rücken systematisch kleiner als 180° - in den Messdaten vom 09.09.2026
   * erreichten 0 von 20 sauber ausgeführten Wiederholungen die Schwelle von 160°. Das Knie
   * liegt auf der Körperlinie und ist zusätzlich zuverlässiger im Bild als der Fuß, der
   * bei einem tief vor der Person stehenden Handy oft ganz herausfällt.
   */
  minHipStraightnessDeg: number;
  /** elbow-shoulder-hip angle (deg); above this the elbow counts as flared out. */
  maxElbowFlareDeg: number;
  /**
   * ear-shoulder-hip angle (deg); below this the head/neck counts as misaligned.
   *
   * Aus echten Messungen kalibriert (144 Wiederholungen, `docs/messdaten/`), nicht
   * geschätzt. Ein neutraler Nacken ergibt in dieser Kameraperspektive **nicht** 180°:
   * Die App bittet die Person, in die Kamera zu schauen, und genau das verkleinert den
   * Winkel Ohr-Schulter-Hüfte. Gemessener Median über alle Aufzeichnungen: 128°, bei
   * einer sauber ausgeführten Serie 126-140°. Der alte Wert von 140° lag oberhalb des
   * 90. Perzentils von allem je Gemessenen und schlug deshalb bei 93 % aller
   * Wiederholungen an - eine Prüfung, die fast immer anschlägt, trägt keine Information.
   */
  minNeckAngleDeg: number;
  /** Minimum landmark visibility (0..1) required to trust a frame. */
  minVisibility: number;
  /**
   * Perzentil (0..100), mit dem die Formwerte statt des schlechtesten Einzelframes
   * gebildet werden: `formPercentile` für die "je kleiner desto schlechter"-Werte
   * (Tiefe, Hüftgerade, Nacken), `100 - formPercentile` für den Ellbogen-Flare, wo es
   * andersherum ist. 10 bedeutet: die schlechtesten 10 % der Frames einer Wiederholung
   * dürfen das Urteil nicht mehr allein bestimmen.
   */
  formPercentile: number;
  /**
   * Wie viele Ausreißer-Frames bei der Tiefenmessung übersprungen werden. Die Tiefe ist
   * der Umkehrpunkt einer Bewegung und nicht wie die übrigen Kennzahlen ein Plateau -
   * ein Perzentil über den ganzen Bewegungsbogen würde sie systematisch zu flach
   * schätzen. Siehe `nthSmallest` in `src/pose/stats.ts`.
   */
  depthOutlierFrames: number;
  /**
   * Kürzeste Dauer (ms), die eine Wiederholung haben muss. Alles darunter ist keine
   * Wiederholung, sondern eine Doppelzählung durch Winkelrauschen an der Schwelle.
   */
  minRepDurationMs: number;
  /**
   * Längste Dauer (ms), nach der eine laufende Wiederholung abgebrochen wird. Eine
   * bewusst langsam ausgeführte Wiederholung dauert rund 4 Sekunden; alles jenseits
   * davon ist der hängende Zähler, nicht der Sportler.
   */
  maxRepDurationMs: number;
  /**
   * Mindestanteil (0..1) der Frames einer Wiederholung, in denen eine verwertbare Pose
   * da war. Darunter wird die Wiederholung verworfen, statt aus Bruchstücken eine
   * Formnote zu erfinden.
   */
  minTrackedFrameRatio: number;
}

export const DEFAULT_THRESHOLDS: PushUpThresholds = {
  elbowUpDeg: 160,
  elbowAttemptDeg: 140,
  goodDepthElbowDeg: 95,
  minHipStraightnessDeg: 160,
  maxElbowFlareDeg: 80,
  minNeckAngleDeg: 115,
  minVisibility: 0.5,
  formPercentile: 10,
  depthOutlierFrames: 2,
  minRepDurationMs: 600,
  maxRepDurationMs: 8000,
  minTrackedFrameRatio: 0.6,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * `percentile()` liefert `NaN`, wenn die Messreihe leer blieb - also wenn die
 * Landmarken, die diese Prüfung braucht, während der ganzen Wiederholung nie sichtbar
 * waren (typisch: Füße außerhalb des Bildes). Das wird hier zu "nicht gemessen"
 * (`null`), statt einen nicht-endlichen Wert in die gespeicherte Historie oder das
 * Kalibrier-Log durchzulassen, wo `JSON.stringify` ihn ohnehin still zu `null` machen
 * würde - dann aber als `number` typisiert, was später NaN in jede Mittelwertbildung
 * trägt.
 */
function roundOrNull(value: number): number | null {
  return Number.isFinite(value) ? Math.round(value) : null;
}

/**
 * Sammelt alle Messwerte einer laufenden Wiederholung. Bewusst die vollständigen
 * Reihen statt laufender Minima/Maxima: Erst damit lässt sich am Ende ein Perzentil
 * bilden. Eine Wiederholung dauert ein bis vier Sekunden, bei ~30 Frames/s sind das
 * einige Dutzend Zahlen - vernachlässigbar, und die Arrays werden mit jeder
 * Wiederholung neu angelegt.
 */
interface RepAccumulator {
  startTimeMs: number;
  elbowAngles: number[];
  hipStraightness: number[];
  elbowFlare: number[];
  neckAngles: number[];
  hipSagDeviationAtDeepest: number;
  deepestElbowAngleSoFar: number;
  /** Frames mit verwertbarer Pose seit Beginn dieser Wiederholung. */
  trackedFrames: number;
  /** Frames ohne verwertbare Pose seit Beginn dieser Wiederholung. */
  untrackedFrames: number;
}

function freshAccumulator(timeMs: number): RepAccumulator {
  return {
    startTimeMs: timeMs,
    elbowAngles: [],
    hipStraightness: [],
    elbowFlare: [],
    neckAngles: [],
    hipSagDeviationAtDeepest: 0,
    deepestElbowAngleSoFar: Infinity,
    trackedFrames: 0,
    untrackedFrames: 0,
  };
}

/**
 * A frame-by-frame push-up rep counter and form scorer.
 *
 * Feed it one MediaPipe pose per camera frame (ideally `worldLandmarks`, MediaPipe's
 * metric 3D landmarks, since those are far more stable across camera angles than
 * image-space coordinates). It runs a small state machine over the elbow angle to
 * detect rep phases, and while a rep is in progress it tracks hip/elbow/neck angles
 * to catch the most common push-up form mistakes. When a rep completes it is scored
 * 0-100 and handed back together with which mistakes (if any) were detected.
 */
export class PushUpAnalyzer {
  private phase: RepPhase = 'up';
  private repIndex = 0;
  private acc: RepAccumulator | null = null;
  /**
   * The body side used for angle math, locked for the duration of a rep. Without this,
   * `pickMoreVisibleSide` re-evaluates every frame and, when left/right visibility
   * scores are close, can flip mid-rep on nothing more than tracking noise - mixing
   * left- and right-side angle readings into the same min/max accumulators and
   * corrupting the rep's score. Only re-picked once the analyzer is idle (`'up'`).
   */
  private lockedSide: BodySide | null = null;
  private readonly thresholds: PushUpThresholds;
  /**
   * Wie oft in dieser Sitzung eine Bewegung verworfen wurde, nach Grund. Rein
   * diagnostisch: Steigt hier etwas auffällig, stimmt etwas mit der Aufnahmesituation
   * nicht (Handy zu nah, Person halb aus dem Bild, Bildrate eingebrochen) - und nicht
   * mit der Ausführung.
   */
  private discardCounts: Record<RepDiscardReason, number> = {
    TOO_SHORT: 0,
    TOO_LONG: 0,
    TRACKING_LOST: 0,
  };

  constructor(thresholds: Partial<PushUpThresholds> = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  reset(): void {
    this.phase = 'up';
    this.repIndex = 0;
    this.acc = null;
    this.lockedSide = null;
    this.discardCounts = { TOO_SHORT: 0, TOO_LONG: 0, TRACKING_LOST: 0 };
  }

  /** Kopie der Verwurf-Zähler dieser Sitzung (siehe `discardCounts`). */
  getDiscardCounts(): Record<RepDiscardReason, number> {
    return { ...this.discardCounts };
  }

  getPhase(): RepPhase {
    return this.phase;
  }

  /**
   * Process one frame. Returns the live feedback for this frame, plus a completed
   * `RepResult` when this frame closed out a rep. Returns `trackingOk: false` in the
   * live feedback (and no rep updates) when the pose isn't confidently visible enough
   * to trust, e.g. the user stepped partly out of frame.
   */
  processFrame(
    pose: Pose,
    timestampMs: number
  ): { live: LiveFeedback; completedRep: RepResult | null; discardedRep: DiscardedRep | null } {
    const t = this.thresholds;

    // Der Zeitablauf wird VOR der Sichtbarkeitsprüfung ausgewertet. Sonst könnte eine
    // Wiederholung, die genau deshalb hängt, weil das Tracking weggebrochen ist, nie
    // ablaufen - der Zweig unten kehrt ja vorzeitig zurück. Genau dieser Fall steckt in
    // den Messdaten vom 09.09.2026 als 26-, 30- und 34-Sekunden-"Wiederholung".
    let discardedRep: DiscardedRep | null = null;
    if (this.acc && timestampMs - this.acc.startTimeMs > t.maxRepDurationMs) {
      discardedRep = this.discardRep('TOO_LONG', timestampMs);
    }

    const side = this.lockedSide ?? pickMoreVisibleSide(pose);
    const idx = sideIndices(side);

    // Only the arm itself is required to count a rep at all - shoulder/elbow/wrist are
    // reliably in frame in any push-up camera setup. Ear/hip/knee are only needed for
    // the *optional* form-quality checks below: a phone propped up low in front of the
    // user very often has the lower body out of frame or at too shallow an angle for
    // MediaPipe to trust, and requiring them here used to mean the rep counter simply
    // never advanced past 'up' whenever that happened - no rep ever counted, regardless
    // of how clean the push-up itself was.
    if (!allVisible(pose, [idx.shoulder, idx.elbow, idx.wrist], t.minVisibility)) {
      // Mitzählen, statt den Ausfall stillschweigend zu überspringen: Am Ende der
      // Wiederholung entscheidet dieser Anteil darüber, ob die Formwerte überhaupt
      // belastbar sind.
      if (this.acc) this.acc.untrackedFrames += 1;
      return {
        live: { phase: this.phase, trackingOk: false, elbowAngleDeg: 0, hipStraightnessDeg: 0, cue: null },
        completedRep: null,
        discardedRep,
      };
    }

    const shoulder = getLandmark(pose, idx.shoulder)!;
    const elbow = getLandmark(pose, idx.elbow)!;
    const wrist = getLandmark(pose, idx.wrist)!;
    const elbowAngleDeg = angleAtPoint(shoulder, elbow, wrist);

    const hasHip = allVisible(pose, [idx.hip], t.minVisibility);
    const hasKnee = allVisible(pose, [idx.knee], t.minVisibility);
    const hasEar = allVisible(pose, [idx.ear], t.minVisibility);
    const hip = hasHip ? getLandmark(pose, idx.hip)! : null;
    const knee = hasKnee ? getLandmark(pose, idx.knee)! : null;
    const ear = hasEar ? getLandmark(pose, idx.ear)! : null;

    // null (rather than a bogus 0) whenever the landmarks needed for that specific check
    // aren't visible this frame - finishRep()/liveCue() below treat null as "unknown,
    // don't penalize", not as a real bad-form reading.
    const hipStraightnessDeg = hip && knee ? angleAtPoint(shoulder, hip, knee) : null;
    const elbowFlareDeg = hip ? angleAtPoint(elbow, shoulder, hip) : null;
    const neckAngleDeg = ear && hip ? angleAtPoint(ear, shoulder, hip) : null;
    const hipSagDeviation = hip && knee ? signedPerpendicularDeviation2D(shoulder, knee, hip) : null;

    let completedRep: RepResult | null = null;

    switch (this.phase) {
      case 'up':
        if (elbowAngleDeg < t.elbowUpDeg) {
          this.phase = 'descending';
          this.lockedSide = side;
          this.acc = freshAccumulator(timestampMs);
        }
        break;

      case 'descending':
        if (elbowAngleDeg <= t.elbowAttemptDeg) {
          this.phase = 'down';
        } else if (elbowAngleDeg >= t.elbowUpDeg) {
          // Went back up without ever committing to a real attempt: noise near lockout, discard.
          this.phase = 'up';
          this.acc = null;
          this.lockedSide = null;
        }
        break;

      case 'down':
        if (elbowAngleDeg > t.elbowAttemptDeg) {
          this.phase = 'ascending';
        }
        break;

      case 'ascending':
        if (elbowAngleDeg <= t.elbowAttemptDeg) {
          this.phase = 'down';
        } else if (elbowAngleDeg >= t.elbowUpDeg) {
          const outcome = this.finishRep(timestampMs);
          completedRep = outcome.rep;
          // Ein bereits gesetztes `discardedRep` (Zeitablauf) kann hier nicht mehr
          // stehen: Der Zeitablauf hat `this.acc` geleert, dann gäbe es keine laufende
          // Wiederholung mehr abzuschließen.
          if (outcome.discarded) discardedRep = outcome.discarded;
          this.phase = 'up';
          this.lockedSide = null;
        }
        break;
    }

    if (this.acc && this.phase !== 'up') {
      this.acc.trackedFrames += 1;
      this.acc.elbowAngles.push(elbowAngleDeg);
      if (hipStraightnessDeg !== null) this.acc.hipStraightness.push(hipStraightnessDeg);
      if (elbowFlareDeg !== null) this.acc.elbowFlare.push(elbowFlareDeg);
      if (neckAngleDeg !== null) this.acc.neckAngles.push(neckAngleDeg);
      if (elbowAngleDeg < this.acc.deepestElbowAngleSoFar) {
        this.acc.deepestElbowAngleSoFar = elbowAngleDeg;
        if (hipSagDeviation !== null) {
          this.acc.hipSagDeviationAtDeepest = hipSagDeviation;
        }
      }
    }

    const cue = this.liveCue(hipStraightnessDeg, hipSagDeviation, elbowFlareDeg, neckAngleDeg);

    return {
      live: { phase: this.phase, trackingOk: true, elbowAngleDeg, hipStraightnessDeg: hipStraightnessDeg ?? 0, cue },
      completedRep,
      discardedRep,
    };
  }

  /**
   * Bricht die laufende Wiederholung ab, ohne sie zu zählen oder zu bewerten. Der
   * Wiederholungszähler wird bewusst nicht erhöht - eine verworfene Wiederholung darf
   * keine Nummer verbrauchen, sonst klaffen später Lücken in der Historie.
   */
  private discardRep(reason: RepDiscardReason, timestampMs: number): DiscardedRep {
    const acc = this.acc!;
    const discarded: DiscardedRep = {
      reason,
      durationMs: timestampMs - acc.startTimeMs,
      trackedFrames: acc.trackedFrames,
      untrackedFrames: acc.untrackedFrames,
    };
    this.discardCounts[reason] += 1;
    this.acc = null;
    this.phase = 'up';
    this.lockedSide = null;
    return discarded;
  }

  private liveCue(
    hipStraightnessDeg: number | null,
    hipSagDeviation: number | null,
    elbowFlareDeg: number | null,
    neckAngleDeg: number | null
  ): LiveFeedback['cue'] {
    if (this.phase === 'up') return null;
    const t = this.thresholds;
    if (hipStraightnessDeg !== null && hipStraightnessDeg < t.minHipStraightnessDeg) {
      // Das Vorzeichen entscheidet die Richtung, genau wie in finishRep(). Ohne diese
      // Auswertung konnte der Live-Hinweis nie HIPS_PIKING melden und nannte jede
      // Abweichung "sackt durch" - auch ein hochgestrecktes Gesäß.
      return hipSagDeviation !== null && hipSagDeviation < 0 ? 'HIPS_PIKING' : 'HIPS_SAGGING';
    }
    if (elbowFlareDeg !== null && elbowFlareDeg > t.maxElbowFlareDeg) {
      return 'ELBOWS_FLARED';
    }
    if (neckAngleDeg !== null && neckAngleDeg < t.minNeckAngleDeg) {
      return 'HEAD_MISALIGNED';
    }
    return 'GOOD_FORM';
  }

  /**
   * Schließt die laufende Wiederholung ab. Liefert entweder eine bewertete
   * Wiederholung **oder** - wenn sie die Plausibilitätsprüfungen nicht besteht - den
   * Grund, aus dem sie verworfen wurde. Nie beides.
   */
  private finishRep(timestampMs: number): { rep: RepResult | null; discarded: DiscardedRep | null } {
    const t = this.thresholds;
    const acc = this.acc!;
    const durationMs = timestampMs - acc.startTimeMs;

    // --- Plausibilitätsprüfungen vor jeder Bewertung -------------------------------
    if (durationMs < t.minRepDurationMs) {
      return { rep: null, discarded: this.discardRep('TOO_SHORT', timestampMs) };
    }

    const totalFrames = acc.trackedFrames + acc.untrackedFrames;
    const trackedRatio = totalFrames === 0 ? 0 : acc.trackedFrames / totalFrames;
    if (acc.elbowAngles.length === 0 || trackedRatio < t.minTrackedFrameRatio) {
      return { rep: null, discarded: this.discardRep('TRACKING_LOST', timestampMs) };
    }

    // --- Robuste Kennzahlen statt schlechtester Einzelframe -------------------------
    // Zwei unterschiedliche Verfahren, aus gutem Grund: Die Tiefe ist der Umkehrpunkt
    // einer Bewegung (n-kleinster Wert), Hüfte/Flare/Nacken sind Plateaus über die
    // Wiederholung (Perzentil). Warum das nicht dasselbe ist, steht in src/pose/stats.ts.
    // NaN bedeutet "nie gemessen" (leere Reihe). Jeder Vergleich mit NaN ist false, die
    // betroffene Prüfung fällt damit still aus - genau das gewünschte Verhalten, wenn
    // z. B. die Füße nie im Bild waren.
    const lowP = t.formPercentile;
    const highP = 100 - t.formPercentile;
    const elbowDepthDeg = nthSmallest(acc.elbowAngles, t.depthOutlierFrames);
    const hipStraightnessDeg = percentile(acc.hipStraightness, lowP);
    const elbowFlareDeg = percentile(acc.elbowFlare, highP);
    const neckAngleDeg = percentile(acc.neckAngles, lowP);

    const issues: FormIssue[] = [];
    let score = 100;

    if (elbowDepthDeg > t.goodDepthElbowDeg) {
      const deficit = elbowDepthDeg - t.goodDepthElbowDeg;
      score -= clamp(deficit * 1.5, 0, 40);
      issues.push('INSUFFICIENT_DEPTH');
    }

    if (hipStraightnessDeg < t.minHipStraightnessDeg) {
      const deficit = t.minHipStraightnessDeg - hipStraightnessDeg;
      score -= clamp(deficit * 1.2, 0, 35);
      issues.push(acc.hipSagDeviationAtDeepest >= 0 ? 'HIPS_SAGGING' : 'HIPS_PIKING');
    }

    if (elbowFlareDeg > t.maxElbowFlareDeg) {
      const deficit = elbowFlareDeg - t.maxElbowFlareDeg;
      score -= clamp(deficit * 0.8, 0, 20);
      issues.push('ELBOWS_FLARED');
    }

    if (neckAngleDeg < t.minNeckAngleDeg) {
      const deficit = t.minNeckAngleDeg - neckAngleDeg;
      score -= clamp(deficit * 0.5, 0, 15);
      issues.push('HEAD_MISALIGNED');
    }

    const rep: RepResult = {
      index: this.repIndex++,
      formScore: Math.round(clamp(score, 0, 100)),
      issues,
      minElbowAngleDeg: Math.round(elbowDepthDeg),
      minHipStraightnessDeg: roundOrNull(hipStraightnessDeg),
      maxElbowFlareDeg: roundOrNull(elbowFlareDeg),
      minNeckAngleDeg: roundOrNull(neckAngleDeg),
      durationMs,
    };

    this.acc = null;
    return { rep, discarded: null };
  }
}
