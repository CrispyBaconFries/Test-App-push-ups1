import { percentile } from './stats';

/**
 * Die Startposition: erkennen, dass jemand wirklich im Stütz liegt - und diesen Moment
 * gleichzeitig zum Kalibrieren nutzen.
 *
 * # Warum es das gibt
 *
 * chris stellt das Handy auf den Boden und geht zwei Schritte zurück. Noch **stehend** und
 * nur teilweise im Bild steht bereits die erste Zählung auf dem Schirm; bis er dann Hände
 * und Füße aufgesetzt hat, die zweite.
 *
 * Drei Ursachen, die zusammenwirken:
 *
 * 1. **Halb außerhalb des Bildes.** MediaPipe liefert auch für Körperteile außerhalb des
 *    Bildes Koordinaten - geschätzte. Aussortieren würde man sie über den
 *    Sichtbarkeitswert, aber der kommt bei `react-native-mediapipe` nie in JS an. Der
 *    Zähler rechnete also mit erfundenen Armen. Dagegen hilft die Prüfung auf die
 *    Bildkoordinaten (`allInFrame` in landmarks.ts), nicht diese Datei.
 * 2. **Stehen sieht aus wie Stütz.** Winkel sind richtungslos: Wer aufrecht steht, hat
 *    genauso gestreckte Arme und einen genauso geraden Körper wie jemand im Stütz. Genau
 *    dafür gibt es hier `minTorsoArmAngleDeg` - der Oberarm hängt beim Stehen am Rumpf,
 *    im Stütz steht er quer dazu.
 * 3. **Der Weg nach unten ist eine Armbeugung.** Hinknien und Hände aufsetzen beugt und
 *    streckt den Arm tatsächlich. Für eine Zustandsmaschine, die den Ellbogenwinkel
 *    verfolgt, ist das von einem Liegestütz nicht zu unterscheiden.
 *
 * Deshalb wird hier nicht die Bewegung besser gefiltert, sondern gar nicht erst gezählt,
 * solange nicht bewiesen ist, dass die Ausgangsposition erreicht wurde. Beweis heißt: Arme
 * gestreckt, Körper gestreckt, Arme unter den Schultern - und das alles **ruhig
 * gehalten**. Das Ruhighalten ist gegen Punkt 3 der entscheidende Teil: Jeder Weg nach
 * unten führt durch die Stützhaltung *hindurch*, aber niemand bleibt dabei zwei Sekunden
 * lang in derselben Haltung.
 *
 * # Warum "ruhig" nicht "unbewegt" heißt (Änderung vom 10.09.2026)
 *
 * Die erste Fassung hat die Spannweite (größter minus kleinster Wert) über das ganze
 * Haltefenster geprüft und bei Überschreitung vorne gekürzt. Auf dem Gerät war das
 * unbrauchbar: Bei 30 Bildern/s stehen nach zwei Sekunden rund 60 Frames im Fenster, und
 * die Spannweite ist der Abstand der **beiden extremsten** davon. Ein einziger
 * verrutschter Frame - also genau das, was MediaPipe mehrmals pro Sekunde liefert - hat
 * die Toleranz gesprengt und die gesammelte Haltezeit weggefressen. chris' Rückmeldung
 * dazu: "Sobald sich eine Linie minimal bewegt, obwohl man selbst still hält, läuft der
 * Timer von vorne los und man kommt nie zu den Liegestützen."
 *
 * Ein Extremwert ist die falsche Kennzahl für Rauschen - dieselbe Erkenntnis wie in
 * `stats.ts` für die Formbewertung. Jetzt werden zwei Dinge getrennt geprüft, die vorher
 * in einer Zahl vermischt waren:
 *
 * - **Rauschen** über die robuste Spannweite (10.-90. Perzentil): Die extremsten 20 %
 *   der Frames dürfen liegen, wo sie wollen. Ein Ausreißer kostet nichts mehr.
 * - **Wandern** über den Unterschied der *Mediane* von erstem und letztem Drittel des
 *   Fensters. Der Median über rund 20 Frames ist gegen Rauschen praktisch unempfindlich
 *   (der Zufallsfehler sinkt mit der Wurzel der Anzahl), reagiert aber sofort, wenn sich
 *   die Haltung tatsächlich verschiebt.
 *
 * Damit darf es rauschen, wie es will, solange es nicht *wandert* - und genau das ist der
 * Unterschied zwischen "hält still" und "geht gerade durch diese Haltung hindurch".
 * Zusätzlich überlebt das Fenster kurze Aussetzer (`dropoutGraceMs`): Ein paar Frames
 * ohne Pose sind ein Tracking-Schluckauf, kein Aufstehen.
 */

/** Warum die Startposition (noch) nicht angenommen wurde - Grundlage für den Hinweis auf dem Bildschirm. */
export type StartPositionStatus =
  /** Arme nicht im Bild oder nicht sicher genug erkannt. */
  | 'NO_POSE'
  /** Arme nicht durchgestreckt - das ist nicht die obere Position eines Liegestützes. */
  | 'ARMS_BENT'
  /** Hüfte messbar, aber der Körper ist abgeknickt (kniend, gebückt, auf dem Weg nach unten). */
  | 'NOT_A_PLANK'
  /**
   * Aufrecht statt im Stütz: Arme hängen am Körper statt unter den Schultern.
   *
   * Eigener Status und nicht Teil von `NOT_A_PLANK`, weil der Hinweis ein anderer ist -
   * "Körper strecken" wäre hier der falsche Rat, gestreckt ist er schon.
   */
  | 'STANDING'
  /**
   * Kniend mit ausgestreckten Armen statt im Stütz: Der Oberarm verlängert die Rumpflinie,
   * statt quer dazu zu stehen.
   *
   * Eigener Status und nicht Teil von `STANDING`, obwohl beides derselbe Winkel ist - nur
   * an den entgegengesetzten Enden. Beim Stehen hängt der Arm *am* Rumpf (kleiner Winkel),
   * hier zeigt er *von ihm weg* (großer Winkel), und der Rat ist ein anderer.
   */
  | 'ARMS_NOT_SUPPORTING'
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
  /**
   * Kleinster Winkel Ellbogen-Schulter-Hüfte, ab dem der Arm unter der Schulter steht
   * statt am Körper zu hängen.
   *
   * Das ist die Bedingung, die **Stehen** von **Stütz** unterscheidet - und ohne sie ist
   * die ganze Prüfung wertlos. Winkel sind richtungslos: Wer aufrecht steht, hat
   * genauso gestreckte Arme (Schulter-Ellbogen-Handgelenk rund 175°) und genauso einen
   * geraden Körper (Schulter-Hüfte-Knie rund 180°) wie jemand im Stütz. Zwei Sekunden
   * ruhig stehen sähe damit aus wie eine eingenommene Startposition, und der
   * anschließende Weg nach unten wäre wieder eine Fehlzählung.
   *
   * Der Unterschied liegt im Arm: Beim Stehen hängt der Oberarm parallel zum Rumpf
   * (Winkel rund 5-25°), im Stütz zeigt er zum Boden und steht damit quer zum Rumpf. Die
   * aufgezeichneten Wiederholungen (`docs/messdaten/`) melden hier 58-101°; 35° lässt
   * also reichlich Luft nach unten und schließt die hängenden Arme trotzdem klar aus.
   */
  minTorsoArmAngleDeg: number;
  /**
   * Größter Winkel Ellbogen-Schulter-Hüfte, bei dem der Arm noch quer zum Rumpf steht.
   *
   * Die Gegenrichtung zu `minTorsoArmAngleDeg`, und aus demselben Grund nötig: Wer kniend
   * die Arme nach vorn hält, hat gestreckte Arme und einen (bis zum Knie) geraden Körper -
   * für eine reine Winkelprüfung ununterscheidbar vom Stütz. Der Unterschied ist wieder
   * der Arm, diesmal am anderen Ende der Skala: Er verlängert die Rumpflinie, statt quer
   * dazu zu stehen.
   *
   * Ohne diese Schranke ließe sich die Startposition kniend einnehmen, und der ganze
   * anschließende Satz wäre in einer Haltung, die kein Liegestütz ist. Die aufgezeichneten
   * Grundhaltungen (`docs/messdaten/`) melden hier 63-67°; 120° lässt also reichlich Luft
   * nach oben und schließt die vorgestreckten Arme (gemessen 133-177°) klar aus. Dieselbe
   * Zahl wie `PushUpThresholds.notAPushUpFlareDeg`, aus demselben Grund.
   */
  maxTorsoArmAngleDeg: number;
  /**
   * Zulässiges **Rauschen** des Ellbogenwinkels im Haltefenster (Grad), gemessen als
   * robuste Spannweite zwischen `jitterTailPercent` und `100 - jitterTailPercent`.
   *
   * Bewusst kein Extremwert-Abstand: Der wäre bei 60 Frames der Abstand der beiden
   * schlechtesten - siehe die Erklärung oben am Modul. Hier dürfen die extremsten 20 %
   * der Frames liegen, wo sie wollen.
   *
   * Dieselbe Zahl dient als Nachsicht an der *Eintrittsschwelle*: Ein Frame, der
   * `minElbowAngleDeg` um höchstens diesen Betrag verfehlt, ist dasselbe Wackeln von der
   * anderen Seite gesehen und verwirft das Fenster deshalb nicht (siehe `push`).
   */
  maxElbowJitterDeg: number;
  /** Dasselbe für den Hüftwinkel. Größer, weil die Hüfte ungenauer verfolgt wird und atmet. */
  maxHipJitterDeg: number;
  /**
   * Zulässiges **Wandern** des Ellbogenwinkels: Unterschied der Mediane von erstem und
   * letztem Drittel des Fensters (Grad).
   *
   * Klein, und das darf es sein: Ein Median über rund 20 Frames schwankt selbst bei
   * kräftigem Rauschen nur um etwa ein Grad. Was hier ausschlägt, ist echte Bewegung.
   * Das ist die Bedingung, die den langsamen Weg nach unten aussperrt, während sie
   * Zittern vollständig ignoriert.
   */
  maxElbowDriftDeg: number;
  /** Dasselbe für die Hüfte - etwas großzügiger, weil Atmen den Hüftwinkel sichtbar bewegt. */
  maxHipDriftDeg: number;
  /** Welcher Anteil an jedem Ende bei der robusten Spannweite abgeschnitten wird (Prozent). */
  jitterTailPercent: number;
  /**
   * Wie lange die Messung aussetzen oder knapp danebenliegen darf, ohne dass die
   * gesammelte Haltezeit verfällt.
   *
   * MediaPipe verliert die Pose regelmäßig für ein, zwei Frames - bei einer Armbewegung
   * vor dunklem Boden auch mal für ein Zehntel. Vorher hat jeder dieser Aussetzer das
   * komplette Fenster gelöscht. Ein Aufstehen dauert deutlich länger als diese Spanne,
   * ein Schluckauf deutlich kürzer.
   */
  dropoutGraceMs: number;
  /**
   * Dasselbe für Frames, die *deutlich* danebenliegen - ein Ellbogenwinkel von 130°, wo
   * eben noch 172° stand.
   *
   * Warum es dafür überhaupt Nachsicht gibt: Solche Sprünge sind auf dem Gerät nachweislich
   * Tracking-Fehler und keine Bewegung. In den aufgezeichneten Wiederholungen
   * (`docs/messdaten/`) melden Frames, bei denen die Erkennung kurz aussetzte, einen
   * Ellbogen-Flare von im Median 138° - ein Winkel, bei dem der Arm hinter dem Rücken
   * stünde. Ein einzelner solcher Frame darf nicht zwei Sekunden Haltezeit kosten.
   *
   * Warum sie viel kürzer ist als `dropoutGraceMs`: Ein Wert weit neben der Schwelle
   * *kann* eine andere Haltung sein. Über hundert Millisekunden ist er es dann auch -
   * schneller kommt niemand in eine andere Haltung und wieder zurück. Vier Frames sind
   * ein Glitch, fünfzehn sind eine Bewegung.
   */
  glitchGraceMs: number;
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
  minTorsoArmAngleDeg: 35,
  maxTorsoArmAngleDeg: 120,
  maxElbowJitterDeg: 14,
  maxHipJitterDeg: 22,
  maxElbowDriftDeg: 5,
  maxHipDriftDeg: 8,
  jitterTailPercent: 10,
  dropoutGraceMs: 400,
  glitchGraceMs: 120,
  holdMs: 2000,
  minSamples: 12,
  timeoutMs: 30000,
};

/**
 * Längster Zeitsprung zwischen zwei Frames, der noch voll als Haltezeit zählt.
 *
 * Ohne diese Deckelung würde ein überbrückter Aussetzer die Haltezeit *verlängern*: Wer
 * eine Sekunde lang nicht erkannt wird, bekäme diese Sekunde geschenkt. Bei 30 Bildern/s
 * sind 33 ms normal, 150 ms ist also reichlich Luft für eine schwankende Bildrate und
 * trotzdem knapp genug, dass ein Aussetzer echte Haltezeit kostet.
 */
const MAX_GAP_BRIDGE_MS = 150;

/**
 * Ab so vielen Frames sind Rauschen und Wandern überhaupt beurteilbar.
 *
 * Darunter wird das Fenster nicht geprüft, sondern wachsen gelassen: Ein Median über drei
 * Werte ist keine Aussage, und "unruhig" wäre bei jedem Neustart des Fensters die
 * Standardantwort. Neun Frames sind drei je Drittel - das Minimum, mit dem der Vergleich
 * erstes/letztes Drittel etwas bedeutet - und bei 30 Bildern/s keine drei Zehntelsekunden.
 */
const MIN_STABILITY_SAMPLES = 9;

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
  /**
   * Spannweite des Ellbogenwinkels im Haltefenster (größter minus kleinster Wert) - je
   * kleiner, desto ruhiger wurde gehalten.
   *
   * Bewusst weiterhin der **Extremwert**-Abstand, obwohl geprüft wird über die robuste
   * Spannweite: Zusammen mit `elbowSpreadDeg` sagt das Paar, wie viel des Wackelns auf
   * einzelne Ausreißer entfällt. Klaffen die beiden weit auseinander, liefert das
   * Tracking Aussetzer; liegen sie dicht beieinander, hat sich die Person wirklich bewegt.
   * Das ist die einzige Möglichkeit, das auf chris' Gerät zu messen (siehe CLAUDE.md:
   * keine Diagnose über `console.log`).
   */
  elbowJitterDeg: number;
  /** Dasselbe für die Hüfte. `null`, wenn nie messbar. */
  hipJitterDeg: number | null;
  /** Robuste Spannweite des Ellbogenwinkels (10.-90. Perzentil) - das tatsächlich geprüfte Rauschen. */
  elbowSpreadDeg: number;
  /** Dasselbe für die Hüfte. `null`, wenn nie messbar. */
  hipSpreadDeg: number | null;
  /** Wandern des Ellbogenwinkels: Median letztes Drittel minus Median erstes Drittel. */
  elbowDriftDeg: number;
  /** Dasselbe für die Hüfte. `null`, wenn nie messbar. */
  hipDriftDeg: number | null;
  /**
   * Wie oft das Haltefenster neu begonnen werden musste - weil die Haltung gewandert ist
   * oder weil eine Störung länger als ihre Nachsichtsspanne gedauert hat.
   */
  restarts: number;
  /** Wie viele **Frames** über eine Nachsichtsspanne hinweg überbrückt wurden. */
  dropouts: number;
  /** Winkel Ellbogen-Schulter-Hüfte in der gehaltenen Position. `null`, wenn nie messbar. */
  neutralElbowFlareDeg: number | null;
  /**
   * Wie waagerecht der Rumpf im Bild lag (1 = waagerecht, 0 = senkrecht).
   *
   * Bewusst **nur gemessen und nicht geprüft**: Das wäre der physikalisch sauberste Weg,
   * Stehen von Stütz zu unterscheiden - er hängt aber daran, wie MediaPipes
   * `worldLandmarks` gegenüber dem Bild ausgerichtet sind, und das lässt sich nur auf
   * einem echten Gerät nachweisen, nicht in Tests. Bis dahin macht diese Zahl die
   * Annahme überprüfbar: Stehen sollte hier deutlich unter 0,5 liegen, ein Stütz
   * deutlich darüber. Stimmt das über mehrere Aufzeichnungen, kann daraus eine zweite,
   * unabhängige Bedingung werden.
   */
  torsoHorizontalRatio: number | null;
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
  /**
   * `true`, wenn die Position schon einmal stand und mitten in der Sitzung wieder verloren
   * ging - im Unterschied zum ersten Einnehmen vor dem Training.
   *
   * Nur für die Anzeige, die Prüfung selbst ist dieselbe. Der Unterschied ist trotzdem
   * wichtig: "Geh in die Liegestütz-Position" ist beim ersten Mal eine Anleitung, mitten
   * im Satz aber die falsche Ansage - dort weiß die Person längst, wie die Position geht,
   * und muss nur erfahren, dass sie sie verlassen hat.
   */
  reentry: boolean;
}

interface Sample {
  timeMs: number;
  elbowAngleDeg: number;
  hipStraightnessDeg: number | null;
  neckAngleDeg: number | null;
  elbowFlareDeg: number | null;
  torsoHorizontalRatio: number | null;
}

/** Ein Frame, wie ihn `PushUpAnalyzer` ohnehin schon berechnet hat. `null` heißt "nicht messbar". */
export interface StartPositionFrame {
  timeMs: number;
  /** `null`, wenn Schulter/Ellbogen/Handgelenk diesen Frame nicht verwertbar waren. */
  elbowAngleDeg: number | null;
  hipStraightnessDeg: number | null;
  neckAngleDeg: number | null;
  /** Winkel Ellbogen-Schulter-Hüfte: unterscheidet Stütz (Arm quer zum Rumpf) von Stehen (Arm am Rumpf). */
  elbowFlareDeg: number | null;
  /**
   * Wie waagerecht der Rumpf im Bild liegt: 1 = ganz waagerecht (Stütz), 0 = ganz
   * senkrecht (Stehen). Wird **nur aufgezeichnet, nicht geprüft** - siehe `PostureBaseline`.
   */
  torsoHorizontalRatio: number | null;
}

export type StartPositionOutcome =
  | { ready: false; progress: StartPositionProgress }
  /** `baseline` ist `null`, wenn über die Notbremse (`timeoutMs`) scharf geschaltet wurde. */
  | { ready: true; baseline: PostureBaseline | null };

function span(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

/**
 * Spannweite ohne die extremsten `tailPercent` an jedem Ende.
 *
 * Für kurze Reihen fällt sie auf die einfache Spannweite zurück: Bei vier Werten ist
 * "das schlechteste Zehntel abschneiden" keine Aussage, sondern eine Interpolation
 * zwischen denselben zwei Zahlen.
 */
function robustSpread(values: readonly number[], tailPercent: number): number {
  if (values.length < 5) return span(values);
  return percentile(values, 100 - tailPercent) - percentile(values, tailPercent);
}

/**
 * Wie weit die Haltung im Lauf des Fensters gewandert ist: Median des letzten Drittels
 * minus Median des ersten Drittels. **Mit Vorzeichen** - beim Ellbogen heißt negativ "es
 * geht nach unten", und das ist beim Auswerten der Aufzeichnungen der interessante Teil.
 *
 * Warum Drittel und nicht Anfang gegen Ende: Ein einzelner Wert am Rand wäre wieder ein
 * Extremwert. Ein Median über rund 20 Frames ist praktisch rauschfrei, und der Vergleich
 * zweier solcher Mediane misst genau die Verschiebung, um die es geht.
 */
function medianDrift(values: readonly number[]): number {
  const third = Math.floor(values.length / 3);
  if (third < 3) return 0;
  return percentile(values.slice(values.length - third), 50) - percentile(values.slice(0, third), 50);
}

/**
 * Verfolgt Frame für Frame, ob die Startposition eingenommen und gehalten wurde.
 *
 * Das Haltefenster wächst, solange die Haltung *rauscht*, und wird nur dann neu begonnen,
 * wenn sie tatsächlich *wandert* oder wenn die Messung länger als `dropoutGraceMs`
 * aussetzt. Warum diese Trennung nötig war, steht oben am Modul.
 */
export class StartPositionGate {
  private readonly criteria: StartPositionCriteria;
  private samples: Sample[] = [];
  private firstFrameMs: number | null = null;
  private lastStatus: StartPositionStatus = 'NO_POSE';
  /** Zeitpunkt des ersten Frames der laufenden Aussetzer-Strecke, `null` außerhalb einer solchen. */
  private graceStartMs: number | null = null;
  /** Kürzeste Nachsicht, die für die laufende Störungsstrecke gilt. */
  private graceLimitMs = Infinity;
  private restarts = 0;
  private dropouts = 0;

  /**
   * `reentry` sagt nur der Anzeige, ob dies das erste Einnehmen ist oder ein erneutes
   * mitten in der Sitzung. Auf die Prüfung hat es bewusst keinen Einfluss: Wer die
   * Position verloren hat, muss sie genauso beweisen wie beim ersten Mal - sonst wäre das
   * Verlieren der Position ein Weg, die Prüfung abzukürzen.
   */
  constructor(criteria: Partial<StartPositionCriteria> = {}, private readonly reentry = false) {
    this.criteria = { ...DEFAULT_START_POSITION_CRITERIA, ...criteria };
  }

  reset(): void {
    this.samples = [];
    this.firstFrameMs = null;
    this.lastStatus = 'NO_POSE';
    this.graceStartMs = null;
    this.graceLimitMs = Infinity;
    this.restarts = 0;
    this.dropouts = 0;
  }

  getStatus(): StartPositionStatus {
    return this.lastStatus;
  }

  push(frame: StartPositionFrame): StartPositionOutcome {
    const c = this.criteria;
    if (this.firstFrameMs === null) this.firstFrameMs = frame.timeMs;
    const timedOut = frame.timeMs - this.firstFrameMs >= c.timeoutMs;

    // Verfehlt der Frame eine der Eintrittsbedingungen, entscheidet das *Ausmaß*, ob das
    // bisher Gehaltene verfällt. Ein Frame knapp unter der Schwelle ist dasselbe Wackeln,
    // das im Fenster ohnehin toleriert wird - nur zufällig auf der falschen Seite der
    // Grenze. Ein Frame weit darunter ist eine andere Haltung.
    const miss = this.classifyMiss(frame);
    if (miss) return this.handleMiss(miss, frame.timeMs, timedOut);

    this.graceStartMs = null;
    this.graceLimitMs = Infinity;
    this.samples.push({
      timeMs: frame.timeMs,
      elbowAngleDeg: frame.elbowAngleDeg!,
      hipStraightnessDeg: frame.hipStraightnessDeg,
      neckAngleDeg: frame.neckAngleDeg,
      elbowFlareDeg: frame.elbowFlareDeg,
      torsoHorizontalRatio: frame.torsoHorizontalRatio,
    });
    // Sicherheitsnetz gegen ein unbegrenzt wachsendes Fenster bei extrem niedriger
    // Bildrate. Im Normalfall greift es nie: Bei 30 Bildern/s ist nach zwei Sekunden
    // scharf geschaltet, lange vor dem Dreifachen der Haltezeit.
    const oldestAllowedMs = frame.timeMs - c.holdMs * 3;
    while (this.samples.length > c.minSamples && this.samples[0]!.timeMs < oldestAllowedMs) {
      this.samples.shift();
    }

    if (!this.isStable()) {
      // Neu begonnen statt vorne gekürzt: Mit robusten Kennzahlen heißt "instabil" nicht
      // mehr "ein Frame ist verrutscht", sondern "die Haltung hat sich verschoben". Dann
      // ist der aktuelle Frame der einzige, der die neue Haltung beschreibt - alles davor
      // gehört zur alten.
      this.restarts += 1;
      this.samples = [this.samples[this.samples.length - 1]!];
      return this.notReady('MOVING', timedOut);
    }

    const heldMs = this.heldMs();
    if (heldMs >= c.holdMs && this.samples.length >= c.minSamples) {
      const baseline = this.buildBaseline(heldMs);
      this.reset();
      return { ready: true, baseline };
    }

    return this.notReady(this.samples.length < 2 ? 'MOVING' : 'HOLDING', timedOut);
  }

  /**
   * Welche Eintrittsbedingung dieser Frame verfehlt - und wie lange das noch als Störung
   * durchgehen darf. `null` heißt: Der Frame gehört ins Haltefenster.
   *
   * Die Grenze zwischen "knapp daneben" und "deutlich daneben" ist absichtlich dieselbe
   * Zahl wie die zugehörige Rauschtoleranz: Wenn der Ellbogenwinkel im Fenster um
   * `maxElbowJitterDeg` schwanken darf, dann ist ein Frame, der die Eintrittsschwelle um
   * weniger als das verfehlt, kein anderer Vorgang - nur zufällig auf der falschen Seite
   * der Grenze gelandet.
   */
  private classifyMiss(
    frame: StartPositionFrame
  ): { status: StartPositionStatus; graceMs: number } | null {
    const c = this.criteria;
    const near = (value: number, threshold: number, tolerance: number): number =>
      value >= threshold - tolerance ? c.dropoutGraceMs : c.glitchGraceMs;

    // Keine Pose bekommt immer die lange Nachsicht: Ob jemand aufgestanden ist oder das
    // Tracking geblinzelt hat, unterscheidet nicht dieser Frame, sondern die Dauer.
    if (frame.elbowAngleDeg === null) return { status: 'NO_POSE', graceMs: c.dropoutGraceMs };
    if (frame.elbowAngleDeg < c.minElbowAngleDeg) {
      return {
        status: 'ARMS_BENT',
        graceMs: near(frame.elbowAngleDeg, c.minElbowAngleDeg, c.maxElbowJitterDeg),
      };
    }
    // Hüfte und Arm-zu-Rumpf-Winkel zählen nur gegen den Start, wenn sie überhaupt
    // gemessen werden konnten - sonst würde ein aus dem Bild ragender Unterkörper den
    // Start dauerhaft blockieren.
    if (frame.hipStraightnessDeg !== null && frame.hipStraightnessDeg < c.minHipStraightnessDeg) {
      return {
        status: 'NOT_A_PLANK',
        graceMs: near(frame.hipStraightnessDeg, c.minHipStraightnessDeg, c.maxHipJitterDeg),
      };
    }
    // Aufrecht stehen erfüllt beide Bedingungen oben - gestreckte Arme, gerader Körper.
    // Erst der Arm-zu-Rumpf-Winkel trennt die beiden Haltungen.
    if (frame.elbowFlareDeg !== null && frame.elbowFlareDeg < c.minTorsoArmAngleDeg) {
      return {
        status: 'STANDING',
        graceMs: near(frame.elbowFlareDeg, c.minTorsoArmAngleDeg, c.maxElbowJitterDeg),
      };
    }
    // Und dasselbe am anderen Ende: kniend mit vorgestreckten Armen. Auch das erfüllt
    // "Arme gestreckt" und "Körper gerade", ist aber kein Stütz.
    if (frame.elbowFlareDeg !== null && frame.elbowFlareDeg > c.maxTorsoArmAngleDeg) {
      return {
        status: 'ARMS_NOT_SUPPORTING',
        graceMs: near(-frame.elbowFlareDeg, -c.maxTorsoArmAngleDeg, c.maxElbowJitterDeg),
      };
    }
    return null;
  }

  private handleMiss(
    miss: { status: StartPositionStatus; graceMs: number },
    timeMs: number,
    timedOut: boolean
  ): StartPositionOutcome {
    // Ist noch nichts gesammelt, gibt es nichts zu schützen - dann soll auf dem Bildschirm
    // der echte Grund stehen ("Geh in die Liegestütz-Position"), nicht Nachsicht.
    if (this.samples.length === 0) {
      this.graceStartMs = null;
      this.graceLimitMs = Infinity;
      return this.notReady(miss.status, timedOut);
    }

    if (this.graceStartMs === null) this.graceStartMs = timeMs;
    // Die kürzeste Nachsicht der laufenden Strecke gilt für die ganze Strecke: Wer erst
    // aus dem Bild fällt und dann mit gebeugten Armen wieder auftaucht, hat sich bewegt -
    // die lange Aussetzer-Nachsicht wäre dafür der falsche Maßstab.
    this.graceLimitMs = Math.min(this.graceLimitMs, miss.graceMs);

    if (timeMs - this.graceStartMs > this.graceLimitMs) {
      this.samples = [];
      this.graceStartMs = null;
      this.graceLimitMs = Infinity;
      this.restarts += 1;
      return this.notReady(miss.status, timedOut);
    }

    this.dropouts += 1;
    // Während der Nachsichtsspanne bleibt die Anzeige stehen, wie sie war: Das Fenster
    // *läuft* noch, und ein für zwei Frames aufblitzendes "Ich sehe dich nicht" wäre
    // Flackern, das nichts erklärt und zu nichts auffordert.
    return this.notReady(this.lastStatus, timedOut);
  }

  private notReady(status: StartPositionStatus, timedOut: boolean): StartPositionOutcome {
    this.lastStatus = status;
    if (timedOut) return { ready: true, baseline: null };
    return {
      ready: false,
      progress: {
        status,
        heldMs: this.heldMs(),
        requiredMs: this.criteria.holdMs,
        reentry: this.reentry,
      },
    };
  }

  /** Rauschen und Wandern innerhalb der Toleranzen? Zu kurze Fenster gelten als in Ordnung. */
  private isStable(): boolean {
    const c = this.criteria;
    if (this.samples.length < MIN_STABILITY_SAMPLES) return true;

    const elbow = this.samples.map((s) => s.elbowAngleDeg);
    if (robustSpread(elbow, c.jitterTailPercent) > c.maxElbowJitterDeg) return false;
    if (Math.abs(medianDrift(elbow)) > c.maxElbowDriftDeg) return false;

    const hip = this.samples.map((s) => s.hipStraightnessDeg).filter((v): v is number => v !== null);
    if (hip.length >= MIN_STABILITY_SAMPLES) {
      if (robustSpread(hip, c.jitterTailPercent) > c.maxHipJitterDeg) return false;
      if (Math.abs(medianDrift(hip)) > c.maxHipDriftDeg) return false;
    }
    return true;
  }

  /**
   * Wie lange schon gehalten wird: Summe der Abstände zwischen den Frames im Fenster,
   * jeder einzelne gedeckelt auf `MAX_GAP_BRIDGE_MS`.
   *
   * Nicht einfach "letzter minus erster Zeitstempel": Damit würde jede überbrückte Lücke
   * als Haltezeit zählen - drei Frames im Abstand von je einer Sekunde wären zwei
   * Sekunden "gehalten", obwohl dazwischen alles passiert sein kann. Die Deckelung macht
   * aus jedem Aussetzer genau das, was er ist: verlorene Zeit statt geschenkter.
   */
  private heldMs(): number {
    let total = 0;
    for (let i = 1; i < this.samples.length; i++) {
      total += Math.min(this.samples[i]!.timeMs - this.samples[i - 1]!.timeMs, MAX_GAP_BRIDGE_MS);
    }
    return total;
  }

  private buildBaseline(heldMs: number): PostureBaseline {
    const c = this.criteria;
    const elbow = this.samples.map((s) => s.elbowAngleDeg);
    const hip = this.samples.map((s) => s.hipStraightnessDeg).filter((v): v is number => v !== null);
    const neck = this.samples.map((s) => s.neckAngleDeg).filter((v): v is number => v !== null);
    const flare = this.samples.map((s) => s.elbowFlareDeg).filter((v): v is number => v !== null);
    const horizontal = this.samples.map((s) => s.torsoHorizontalRatio).filter((v): v is number => v !== null);
    // Median und nicht Mittelwert: Ein einzelner verrutschter Frame im Haltefenster darf
    // die Grundlinie nicht verschieben, auf der anschließend die ganze Sitzung bewertet wird.
    return {
      topElbowAngleDeg: Math.round(percentile(elbow, 50)),
      neutralHipStraightnessDeg: hip.length > 0 ? Math.round(percentile(hip, 50)) : null,
      neutralNeckAngleDeg: neck.length > 0 ? Math.round(percentile(neck, 50)) : null,
      elbowJitterDeg: Math.round(span(elbow)),
      hipJitterDeg: hip.length > 0 ? Math.round(span(hip)) : null,
      elbowSpreadDeg: Math.round(robustSpread(elbow, c.jitterTailPercent)),
      hipSpreadDeg: hip.length > 0 ? Math.round(robustSpread(hip, c.jitterTailPercent)) : null,
      elbowDriftDeg: Math.round(medianDrift(elbow)),
      hipDriftDeg: hip.length > 0 ? Math.round(medianDrift(hip)) : null,
      restarts: this.restarts,
      dropouts: this.dropouts,
      neutralElbowFlareDeg: flare.length > 0 ? Math.round(percentile(flare, 50)) : null,
      torsoHorizontalRatio: horizontal.length > 0 ? Math.round(percentile(horizontal, 50) * 100) / 100 : null,
      samples: this.samples.length,
      heldMs: Math.round(heldMs),
    };
  }
}
