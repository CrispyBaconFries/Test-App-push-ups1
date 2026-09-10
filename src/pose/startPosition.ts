import { percentile } from './stats';

/**
 * Die Startposition: erkennen, dass jemand wirklich im Stütz liegt - und diesen Moment
 * gleichzeitig zum Kalibrieren nutzen.
 *
 * # Warum es das gibt
 *
 * chris stellt das Handy auf den Boden, geht zwei Schritte zurück und geht in den Stütz.
 * Dabei wurden ein bis zwei Wiederholungen gezählt, die keine waren. Der naheliegende
 * Verdacht war "das Skelett springt beim Hinlegen wild herum" - die Messdaten sagen etwas
 * anderes: Das Tracking war lückenlos (0 verlorene Frames), die Bewegung war sauber
 * erfasst. Sie *war* nur einfach eine Beugung und Streckung der Arme, und genau darauf
 * schaut eine Zustandsmaschine, die den Ellbogenwinkel verfolgt. Der Gang in die Position
 * ist für sie nicht von einem Liegestütz zu unterscheiden.
 *
 * Deshalb wird hier nicht die Bewegung besser gefiltert, sondern gar nicht erst gezählt,
 * solange nicht bewiesen ist, dass die Ausgangsposition erreicht wurde. Beweis heißt:
 * Arme gestreckt, Körper im Stütz, und beides **ruhig gehalten**. Das Ruhighalten ist der
 * entscheidende Teil - ohne es ließe sich die Bedingung auch im Vorbeigehen erfüllen, weil
 * jeder Weg nach unten durch die Stützhaltung *hindurch* führt. Nur bleibt niemand dabei
 * zwei Sekunden lang innerhalb weniger Grad stehen.
 *
 * # Warum kein Kopf-Rahmen
 *
 * Ursprünglich war ein kopfförmiger Rahmen auf dem Bildschirm geplant, in den man sich
 * hineinstellt. Dagegen sprechen zwei Dinge: Er hängt an Bildschirmkoordinaten und damit
 * daran, wie das Handy gerade steht - kippt es leicht, stimmt der Rahmen nicht mehr. Und
 * er verlangt, dass man aus zwei Metern Entfernung im Stütz liegend Details auf einem am
 * Boden liegenden Handy erkennt. Das Halten der Position braucht dagegen keinen Blick auf
 * den Bildschirm: Es meldet sich über die Anzeige *und* über einen Ton, und es misst genau
 * das, was später gebraucht wird - die eigene Haltung, nicht die Lage im Bild.
 */

/** Warum die Startposition (noch) nicht angenommen wurde - Grundlage für den Hinweis auf dem Bildschirm. */
export type StartPositionStatus =
  /** Arme nicht im Bild oder nicht sicher genug erkannt. */
  | 'NO_POSE'
  /** Arme nicht durchgestreckt - das ist nicht die obere Position eines Liegestützes. */
  | 'ARMS_BENT'
  /** Hüfte messbar, aber der Körper ist nicht im Stütz (kniend, stehend, auf dem Weg). */
  | 'NOT_A_PLANK'
  /** Haltung stimmt, wackelt aber noch zu stark - typisch für den Moment des Hinlegens. */
  | 'MOVING'
  /** Alles stimmt, die Haltezeit läuft. */
  | 'HOLDING';

export interface StartPositionCriteria {
  /**
   * Ellbogenwinkel, ab dem die Arme als gestreckt gelten.
   *
   * Bewusst derselbe Wert wie `PushUpThresholds.elbowUpDeg` und nicht ein kleinerer:
   * Wäre er kleiner, würde die Zustandsmaschine im selben Moment, in dem scharf
   * geschaltet wird, bereits eine Abwärtsbewegung sehen und eine Wiederholung anfangen,
   * die nur aus dem Kalibrier-Halten besteht.
   */
  minElbowAngleDeg: number;
  /**
   * Schulter-Hüfte-Knie-Winkel, ab dem der Körper im Stütz ist. Wird **nur** geprüft,
   * wenn die Hüfte überhaupt messbar ist - bei einem tief vor der Person stehenden Handy
   * fällt der Unterkörper oft aus dem Bild, und daran darf der Start nicht scheitern.
   */
  minHipStraightnessDeg: number;
  /** Zulässige Spannweite des Ellbogenwinkels innerhalb des Haltefensters (Grad). */
  maxElbowJitterDeg: number;
  /** Zulässige Spannweite des Hüftwinkels innerhalb des Haltefensters (Grad). */
  maxHipJitterDeg: number;
  /** Wie lange die Position ruhig gehalten werden muss. */
  holdMs: number;
  /**
   * Wie viele Frames das Haltefenster mindestens enthalten muss.
   *
   * Ohne das ließe sich die Haltezeit auch mit drei Frames im Abstand von je einer
   * Sekunde erfüllen - dazwischen könnte alles passiert sein. Bei 30 Bildern/s sind zwei
   * Sekunden rund 60 Frames; 12 ist also selbst bei stark eingebrochener Bildrate noch
   * erreichbar und schließt trotzdem den Extremfall aus.
   */
  minSamples: number;
  /**
   * Nach dieser Zeit wird auch ohne erfolgreiches Halten scharf geschaltet - dann mit den
   * allgemeinen Schwellwerten statt persönlichen.
   *
   * Warum es diese Notbremse gibt: Ein Bildschirm, der unter ungünstigen Bedingungen
   * (Handy zu nah, Kamera zu flach, Arme nie ganz gestreckt) *nie* zu zählen anfängt,
   * ist schlimmer als eine gelegentliche Fehlzählung - man steht davor und weiß nicht,
   * warum nichts passiert. Nach einer halben Minute hat jeder längst seine Position
   * eingenommen; die Fehlzählungen beim Hinlegen sind zu dem Zeitpunkt vorbei.
   */
  timeoutMs: number;
}

export const DEFAULT_START_POSITION_CRITERIA: StartPositionCriteria = {
  minElbowAngleDeg: 160,
  minHipStraightnessDeg: 110,
  maxElbowJitterDeg: 8,
  maxHipJitterDeg: 12,
  holdMs: 2000,
  minSamples: 12,
  timeoutMs: 30000,
};

/**
 * Die eigene Haltung, gemessen in der ruhig gehaltenen Startposition.
 *
 * Das ist der eigentliche Gewinn der Kalibrierung: Eine Hüftgerade von 150° heißt bei der
 * einen Person "leicht durchgesackt" und bei der anderen "kerzengerade, nur flach von
 * vorn gefilmt". Ohne diesen Bezugspunkt muss ein fester Schwellwert beides gleich
 * behandeln - und genau daher kommen die Fehlalarme zu Hüfte und Kopfposition, über die
 * sich alle bisherigen Testpersonen beschwert haben.
 */
export interface PostureBaseline {
  /** Ellbogenwinkel in der oberen Position (Median über das Haltefenster). */
  topElbowAngleDeg: number;
  /** Schulter-Hüfte-Knie-Winkel im eigenen, ruhig gehaltenen Stütz. `null`, wenn nie messbar. */
  neutralHipStraightnessDeg: number | null;
  /** Ohr-Schulter-Hüfte-Winkel in derselben Haltung. `null`, wenn nie messbar. */
  neutralNeckAngleDeg: number | null;
  /** Spannweite des Ellbogenwinkels im Haltefenster - je kleiner, desto ruhiger wurde gehalten. */
  elbowJitterDeg: number;
  /** Dasselbe für die Hüfte. `null`, wenn nie messbar. */
  hipJitterDeg: number | null;
  /** Anzahl Frames im Haltefenster und dessen tatsächliche Dauer - macht die Messung bewertbar. */
  samples: number;
  heldMs: number;
}

/** Fortschritt beim Einnehmen der Startposition, für die Anzeige. */
export interface StartPositionProgress {
  status: StartPositionStatus;
  /** Wie lange bereits ruhig gehalten wird. */
  heldMs: number;
  /** Wie lange gehalten werden muss (`criteria.holdMs`). */
  requiredMs: number;
}

interface Sample {
  timeMs: number;
  elbowAngleDeg: number;
  hipStraightnessDeg: number | null;
  neckAngleDeg: number | null;
}

/** Ein Frame, wie ihn `PushUpAnalyzer` ohnehin schon berechnet hat. `null` heißt "nicht messbar". */
export interface StartPositionFrame {
  timeMs: number;
  /** `null`, wenn Schulter/Ellbogen/Handgelenk diesen Frame nicht verwertbar waren. */
  elbowAngleDeg: number | null;
  hipStraightnessDeg: number | null;
  neckAngleDeg: number | null;
}

export type StartPositionOutcome =
  | { ready: false; progress: StartPositionProgress }
  /** `baseline` ist `null`, wenn über die Notbremse (`timeoutMs`) scharf geschaltet wurde. */
  | { ready: true; baseline: PostureBaseline | null };

function span(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

/**
 * Verfolgt Frame für Frame, ob die Startposition eingenommen und gehalten wurde.
 *
 * Das Haltefenster ist bewusst gleitend und wird bei kleinem Wackeln nicht komplett
 * verworfen, sondern vorne gekürzt, bis die Spannweite wieder passt. Damit kostet ein
 * einzelner verrutschter Frame nicht die ganze bisherige Haltezeit - eine langsame
 * Abwärtsbewegung sammelt aber trotzdem nie die volle Zeit an, weil das Fenster mit ihr
 * mitwandert, statt zu wachsen. Genau das unterscheidet "hält still" von "geht gerade
 * durch diese Haltung hindurch".
 */
export class StartPositionGate {
  private readonly criteria: StartPositionCriteria;
  private samples: Sample[] = [];
  private firstFrameMs: number | null = null;
  private lastStatus: StartPositionStatus = 'NO_POSE';

  constructor(criteria: Partial<StartPositionCriteria> = {}) {
    this.criteria = { ...DEFAULT_START_POSITION_CRITERIA, ...criteria };
  }

  reset(): void {
    this.samples = [];
    this.firstFrameMs = null;
    this.lastStatus = 'NO_POSE';
  }

  getStatus(): StartPositionStatus {
    return this.lastStatus;
  }

  push(frame: StartPositionFrame): StartPositionOutcome {
    const c = this.criteria;
    if (this.firstFrameMs === null) this.firstFrameMs = frame.timeMs;
    const timedOut = frame.timeMs - this.firstFrameMs >= c.timeoutMs;

    if (frame.elbowAngleDeg === null) {
      return this.notReady('NO_POSE', timedOut, true);
    }
    if (frame.elbowAngleDeg < c.minElbowAngleDeg) {
      return this.notReady('ARMS_BENT', timedOut, true);
    }
    // Die Hüfte zählt nur gegen den Start, wenn sie überhaupt gemessen werden konnte -
    // sonst würde ein aus dem Bild ragender Unterkörper den Start dauerhaft blockieren.
    if (frame.hipStraightnessDeg !== null && frame.hipStraightnessDeg < c.minHipStraightnessDeg) {
      return this.notReady('NOT_A_PLANK', timedOut, true);
    }

    this.samples.push({
      timeMs: frame.timeMs,
      elbowAngleDeg: frame.elbowAngleDeg,
      hipStraightnessDeg: frame.hipStraightnessDeg,
      neckAngleDeg: frame.neckAngleDeg,
    });

    // Vorne kürzen, bis die Ruhe-Toleranzen wieder eingehalten sind.
    //
    // Bewusst KEINE zusätzliche Kürzung nach Alter: Ein Fenster, das auf `holdMs`
    // zugeschnitten wird, erreicht `heldMs >= holdMs` nur bei exakter Gleichheit - bei
    // Zeitstempeln aus dem Kamerapfad also praktisch nie. Es wächst auch nicht
    // unbegrenzt, weil es genau in dem Moment fertig ist, in dem es lang genug ist.
    while (this.samples.length > 1) {
      const elbowSpan = span(this.samples.map((s) => s.elbowAngleDeg));
      const hipValues = this.samples
        .map((s) => s.hipStraightnessDeg)
        .filter((v): v is number => v !== null);
      const hipSpan = span(hipValues);
      if (elbowSpan <= c.maxElbowJitterDeg && hipSpan <= c.maxHipJitterDeg) break;
      this.samples.shift();
    }

    const heldMs = this.heldMs();
    if (heldMs >= c.holdMs && this.samples.length >= c.minSamples) {
      const baseline = this.buildBaseline(heldMs);
      this.reset();
      return { ready: true, baseline };
    }

    // Ein Fenster, das gerade erst wieder aufgebaut wird (weil es vorne gekürzt werden
    // musste), heißt "es wackelt noch" - und genau das soll auf dem Bildschirm stehen,
    // solange sich jemand noch zurechtruckelt.
    const stillSettling = this.samples.length < 2;
    return this.notReady(stillSettling ? 'MOVING' : 'HOLDING', timedOut, false);
  }

  private notReady(status: StartPositionStatus, timedOut: boolean, clearWindow: boolean): StartPositionOutcome {
    if (clearWindow) this.samples = [];
    this.lastStatus = status;
    if (timedOut) return { ready: true, baseline: null };
    return {
      ready: false,
      progress: { status, heldMs: this.heldMs(), requiredMs: this.criteria.holdMs },
    };
  }

  private heldMs(): number {
    if (this.samples.length < 2) return 0;
    return this.samples[this.samples.length - 1]!.timeMs - this.samples[0]!.timeMs;
  }

  private buildBaseline(heldMs: number): PostureBaseline {
    const elbow = this.samples.map((s) => s.elbowAngleDeg);
    const hip = this.samples.map((s) => s.hipStraightnessDeg).filter((v): v is number => v !== null);
    const neck = this.samples.map((s) => s.neckAngleDeg).filter((v): v is number => v !== null);
    // Median und nicht Mittelwert: Ein einzelner verrutschter Frame im Haltefenster darf
    // die Grundlinie nicht verschieben, auf der anschließend die ganze Sitzung bewertet wird.
    return {
      topElbowAngleDeg: Math.round(percentile(elbow, 50)),
      neutralHipStraightnessDeg: hip.length > 0 ? Math.round(percentile(hip, 50)) : null,
      neutralNeckAngleDeg: neck.length > 0 ? Math.round(percentile(neck, 50)) : null,
      elbowJitterDeg: Math.round(span(elbow)),
      hipJitterDeg: hip.length > 0 ? Math.round(span(hip)) : null,
      samples: this.samples.length,
      heldMs: Math.round(heldMs),
    };
  }
}
