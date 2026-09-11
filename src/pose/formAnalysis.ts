import {
  allInFrame,
  allVisible,
  angleAtPoint,
  getLandmark,
  pickMoreVisibleSide,
  sideIndices,
  signedPerpendicularDeviation2D,
  type BodySide,
  type Pose,
} from './landmarks';
import { nthLargest, nthSmallest, percentile } from './stats';
import {
  StartPositionGate,
  type PostureBaseline,
  type StartPositionCriteria,
  type StartPositionFrame,
  type StartPositionProgress,
} from './startPosition';

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
 * - `NOT_A_PLANK` - der Körper war überhaupt nicht in Stützposition und die Bewegung ging
 *                  auch nicht in die Tiefe. Das ist der Gang zur Position hin und wieder
 *                  weg, kein Liegestütz.
 */
export type RepDiscardReason =
  | 'TOO_SHORT'
  | 'TOO_LONG'
  | 'TRACKING_LOST'
  | 'NOT_A_PLANK'
  /** Der Arm hat sich kaum gebeugt - siehe `PushUpThresholds.minRepRangeDeg`. */
  | 'TOO_SHALLOW'
  /** Der Oberarm lag in der Rumpflinie statt quer dazu - siehe `PushUpThresholds.notAPushUpFlareDeg`. */
  | 'ARMS_NOT_SUPPORTING';

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
  /**
   * Wie viele der ausgefallenen Frames daran lagen, dass der Arm aus dem **Bild** ragte -
   * im Unterschied zu "nicht sicher erkannt".
   *
   * Rein diagnostisch, und der einzige Weg, das später zu erfahren: Im Release-Build gibt
   * es kein Log, und die Kalibrierungsdaten sind alles, was von einer Trainingseinheit bei
   * mir ankommt. Ein `TRACKING_LOST` mit hohem Wert hier heißt "steh weiter weg vom
   * Handy", eines mit 0 heißt "MediaPipe hat die Pose verloren" - zwei völlig
   * verschiedene Ursachen, die sonst gleich aussehen.
   */
  outOfFrameFrames: number;
  /**
   * Kleinster und größter Ellbogenwinkel während der verworfenen Bewegung, `null` wenn
   * gar kein verwertbarer Frame dabei war.
   *
   * Ohne diese beiden Zahlen ist ein `TOO_LONG` nicht deutbar: Ein Bereich von 90-170°
   * heißt "hier stecken mehrere echte Wiederholungen drin", ein Bereich von 150-170°
   * heißt "die Person hat sich gar nicht bewegt". Genau diese Frage war beim ersten
   * Auftreten am 09.09.2026 nicht aus den Daten zu beantworten.
   */
  minElbowAngleDeg: number | null;
  maxElbowAngleDeg: number | null;
  /**
   * Größter Winkel Ellbogen-Schulter-Hüfte während der verworfenen Bewegung, `null` wenn
   * die Hüfte nie messbar war.
   *
   * Seit dem 10.09.2026 dabei, weil `ARMS_NOT_SUPPORTING` an dieser Zahl hängt: Ohne sie
   * ließe sich in einer Aufzeichnung nicht unterscheiden, ob die Schwelle von 120° gerade
   * knapp oder deutlich überschritten wurde - und damit nicht prüfen, ob sie richtig liegt.
   */
  maxElbowFlareDeg: number | null;
}

/**
 * Der zeitliche Verlauf **einer** Bewegung - jeder Frame, in Reihe, mit Zeitstempel.
 *
 * # Warum das existiert (10.09.2026)
 *
 * Bis hierher hat die Erkennung jede Bewegung auf vier Zahlen eingedampft: tiefster
 * Ellbogenwinkel, Hüfte, Flare, Nacken. Damit lassen sich Schwellwerte prüfen - aber nicht
 * die Frage beantworten, die chris gestellt hat: *wie* sich die Werte zwischen Anfang und
 * Umkehrpunkt verhalten.
 *
 * Und genau daran hängt der nächste Schritt. Ein Liegestütz ist keine Menge von Extremwerten,
 * sondern ein Ablauf, in dem sich mehrere Größen **gemeinsam** bewegen: Der Ellbogen beugt
 * sich, und *währenddessen* sinkt die Schulter zum Boden, während die Hände liegen bleiben.
 * Wer kniend die Arme in der Luft beugt, erzeugt dieselben Extremwerte - aber die Schulter
 * bleibt, wo sie ist, und die Hände wandern. Eine Zusammenfassung kann diesen Unterschied
 * nicht ausdrücken, ein Verlauf schon.
 *
 * # Warum erst aufzeichnen und dann entscheiden
 *
 * Für eine Regel über den Verlauf brauche ich Schwellwerte, und die kann ich nicht raten:
 * Wie weit das Handgelenk in einem echten Liegestütz auf diesem Gerät wandert, weiß
 * niemand - MediaPipes Handgelenk ist bekanntermaßen die unruhigste Landmarke. Deshalb
 * zeichnet diese Struktur zuerst auf, was tatsächlich passiert. Dieselbe Reihenfolge wie
 * bei allen Schwellwerten davor (Nacken, Tiefe, Bewegungsumfang): erst messen, dann
 * festlegen - siehe README.
 *
 * Aufgezeichnet wird **jede** Bewegung, auch die verworfenen: Der Vergleich zwischen einem
 * echten Liegestütz und einem ausgetricksten ist der ganze Zweck.
 *
 * `null` in einer Reihe heißt "in diesem Frame nicht messbar" - nicht 0. Die Reihen sind
 * index-gleich zu `t`; anders als die Kennzahl-Arrays im Sammler, die einzeln gefiltert
 * werden und deshalb nicht zueinander passen.
 */
export interface RepTrace {
  /** `'rep'` wenn gezählt, sonst der Grund, aus dem verworfen wurde. */
  outcome: 'rep' | RepDiscardReason;
  /** Millisekunden seit Beginn der Bewegung, ein Eintrag je verwertbarem Frame. */
  t: number[];
  /** Schulter-Ellbogen-Handgelenk (Grad). */
  elbow: number[];
  /** Schulter-Hüfte-Knie (Grad). */
  hip: (number | null)[];
  /** Ellbogen-Schulter-Hüfte (Grad) - die Richtung des Oberarms zum Rumpf. */
  flare: (number | null)[];
  /** Ohr-Schulter-Hüfte (Grad). */
  neck: (number | null)[];
  /** Rumpflage im Bild × 100 (100 = waagerecht, 0 = senkrecht). */
  horiz: (number | null)[];
  /**
   * Schulter- und Handgelenkposition im **Bild** × 1000 (normalisiert, kann außerhalb
   * 0..1000 liegen - MediaPipe schätzt auch außerhalb des Bildes weiter).
   *
   * Die eigentlich interessante Reihe: Im Liegestütz liegen die Hände fest und die
   * Schulter wandert zu ihnen hin; beim Armbeugen in der Luft ist es umgekehrt. Das ist
   * die einzige hier aufgezeichnete Größe, die nicht aus Winkeln besteht - und damit die
   * einzige, die diesen Unterschied überhaupt sehen kann.
   */
  sx: (number | null)[];
  sy: (number | null)[];
  wx: (number | null)[];
  wy: (number | null)[];
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
  /**
   * Wie weit sich der Ellbogen in dieser Wiederholung tatsächlich gebeugt hat (oberer
   * minus unterer Umkehrpunkt).
   *
   * Aufgezeichnet, weil `minRepRangeDeg` seit dem 10.09.2026 an dieser Zahl entscheidet,
   * **ob** gezählt wird - und weil sich sonst nicht prüfen lässt, ob die 45° auf einem
   * anderen Gerät oder bei einer anderen Person noch richtig liegen. Auf dem Handy gibt
   * es kein Log (siehe CLAUDE.md); was hier nicht drinsteht, ist später nicht zu erfahren.
   *
   * In gespeicherten Wiederholungen von **vor** dem 10.09.2026 fehlt das Feld - beim
   * Auswerten alter Verläufe also nicht als garantiert vorhanden behandeln.
   */
  elbowRangeDeg: number;
}

/**
 * Was gerade nicht im Bild ist - und was das kostet.
 *
 * Zwei Fälle, die sich für den Nutzer völlig unterschiedlich anfühlen und deshalb nicht
 * dieselbe Meldung bekommen dürfen:
 *
 * - `ARMS_OUT_OF_FRAME`: Der Arm ragt aus dem Bild. Es wird **gar nicht gezählt** - das
 *   muss sofort und deutlich auf dem Bildschirm stehen, sonst steht jemand vor einem
 *   toten Zähler und weiß nicht, warum.
 * - `LOWER_BODY_OUT_OF_FRAME`: Hüfte oder Knie ragen aus dem Bild. Gezählt wird ganz
 *   normal weiter, nur Hüft- und Nackenbewertung fallen aus (im Zweifel für den
 *   Sportler). Ohne Hinweis wäre für den Nutzer nicht erklärbar, warum plötzlich nie
 *   mehr etwas zur Haltung gemeldet wird.
 */
export type FramingIssue = 'ARMS_OUT_OF_FRAME' | 'LOWER_BODY_OUT_OF_FRAME';

export interface LiveFeedback {
  phase: RepPhase;
  trackingOk: boolean;
  elbowAngleDeg: number;
  hipStraightnessDeg: number;
  cue: FormIssue | 'GOOD_FORM' | null;
  /**
   * Solange die Startposition noch nicht eingenommen und gehalten wurde: wie weit es ist
   * und woran es gerade hakt. `null` bedeutet "scharf geschaltet, es wird gezählt".
   *
   * Bis dahin läuft die Zustandsmaschine gar nicht - der Weg in die Position hinein ist
   * damit keine Wiederholung mehr, egal wie er aussieht (siehe `startPosition.ts`).
   */
  startPosition: StartPositionProgress | null;
  /** Welcher Körperteil gerade aus dem Bild ragt, `null` wenn alles drin ist. */
  framing: FramingIssue | null;
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
  /**
   * Unterhalb dieses Schulter-Hüfte-Knie-Winkels ist der Körper gar nicht in
   * Stützposition. Zusammen mit fehlender Tiefe (siehe `goodDepthElbowDeg`) wird die
   * Bewegung dann verworfen, statt sie als schlechte Wiederholung zu zählen.
   *
   * Warum beide Bedingungen und nicht nur eine: chris stellt das Handy auf den Boden,
   * geht zwei Schritte zurück und geht dann in die Position - dabei wurden ein bis zwei
   * Wiederholungen gezählt, die keine waren. In der Aufzeichnung vom 09.09.2026,
   * 20:12 Uhr sind das die Einträge um 20:12:02 (Hüfte 56°, Tiefe 117°), 20:12:06
   * (88°/130°) und 20:13:01 beim Aufstehen (22°/126°). Alle 21 echten Wiederholungen
   * derselben Sitzung liegen bei 158-169°.
   *
   * Die Hüfte allein reicht als Kriterium aber nicht: Eine echte Wiederholung mit
   * deutlich abgekippter Hüfte (gemessen 97°) ist ein *schlechter* Liegestütz, kein
   * Nicht-Liegestütz - sie soll gezählt und schlecht bewertet werden. Sie unterscheidet
   * sich vom Positionswechsel dadurch, dass sie in die Tiefe ging (85°). Deshalb wird
   * nur verworfen, was *beides* nicht erfüllt: weder Stützposition noch Tiefe.
   */
  minPlankHipStraightnessDeg: number;
  /**
   * Ellbogenwinkel, ab dem eine Bewegung "ging nicht in die Tiefe" heißt - zweite Hälfte
   * der Und-Bedingung, mit der der Positionswechsel als `NOT_A_PLANK` verworfen wird.
   *
   * Warum das eine eigene Zahl ist und nicht `goodDepthElbowDeg`: Bis zum 10.09.2026 war
   * es dieselbe, und das ist eine Falle. `goodDepthElbowDeg` entscheidet über *Punkte*,
   * diese Zahl darüber, ob überhaupt **gezählt** wird. Als die Tiefenschwelle für die
   * Bewertung von 95° auf 105° gelockert wurde, hätte das lautlos auch das Zählen
   * geändert - Wiederholungen mit abgekippter Hüfte und mittlerer Tiefe wären ab da
   * verschwunden, ohne dass irgendwo "Zählung" draufgestanden hätte. Zwei Fragen, zwei
   * Zahlen.
   *
   * Bleibt deshalb bei den 95°, mit denen die Verwurfsregel aufgestellt und an den
   * Aufzeichnungen geprüft wurde.
   */
  notAPlankDepthDeg: number;
  /**
   * Um wie viel Grad sich der Ellbogen zwischen oberem und unterem Umkehrpunkt mindestens
   * gebeugt haben muss, damit die Bewegung überhaupt gezählt wird.
   *
   * # Wogegen das ist (10.09.2026)
   *
   * chris hat vorgeführt, dass es reicht, im Stütz zu liegen und nur den **Kopf** auf und
   * ab zu bewegen: 21 Wiederholungen am Stück, ohne die Arme zu benutzen. Der Grund ist
   * nicht Nachlässigkeit der Schwellwerte, sondern MediaPipe selbst - das Modell schätzt
   * die ganze Pose gemeinsam, und eine Kopfbewegung zieht die geschätzte Schulterposition
   * mit. Der Ellbogenwinkel *wackelt* dabei messbar, ohne dass sich der Arm bewegt.
   *
   * Ein absoluter Tiefpunkt taugt gegen diesen Trick nicht: Die Kopf-Sitzung erreichte
   * 121-142°, echte flache Wiederholungen derselben Person 121-124°. Die beiden Mengen
   * überschneiden sich. Der **Bewegungsumfang** trennt sie dagegen sauber, gemessen gegen
   * die eigene, in der Startposition kalibrierte Streckung (161-163°):
   *
   * | Sitzung | Wiederholungen | Bewegungsumfang |
   * |---|---|---|
   * | 10.09. 17:43 (echt) | 15 | 51-67° |
   * | 10.09. 18:18 (echt) | 19 | 39-65° |
   * | 10.09. 18:32 (**nur Kopf**) | 21 | 19-40° |
   *
   * Bei 45° zählt keine einzige der 21 Kopfbewegungen mehr, und 32 der 34 echten
   * Wiederholungen bleiben. Die beiden verlorenen waren die flachsten der Sitzung (39°
   * und 40°) und lagen damit mitten im Kopf-Bereich - sie sind an dieser Messung von
   * einer Kopfbewegung nicht zu unterscheiden.
   *
   * # Warum das nicht dasselbe ist wie `goodDepthElbowDeg`
   *
   * Diese Zahl sagt **nicht**, wie tief ein Liegestütz sein soll - das tut
   * `goodDepthElbowDeg`, und sie kostet nur Punkte. Diese hier sagt: "unter so wenig
   * Bewegung war es gar keine Wiederholung". 45° ist deshalb bewusst weit unterhalb
   * dessen, was ein sauberer Liegestütz hat (rund 60°): Sie soll Betrug aussortieren,
   * nicht Technik bewerten.
   *
   * # Warum gegen die eigene Streckung und nicht gegen einen festen Winkel
   *
   * Weil beide Enden mit demselben Fehler gemessen werden. Wessen gestreckter Arm auf
   * diesem Gerät als 161° ankommt statt als 180°, dessen Tiefpunkt kommt ebenfalls zu
   * hoch an; die *Differenz* bleibt davon unberührt. Ein fester Tiefen-Winkel würde
   * genau diese Person aussperren.
   */
  minRepRangeDeg: number;
  /**
   * Winkel Ellbogen-Schulter-Hüfte, ab dem der Oberarm **in** der Rumpflinie liegt statt
   * quer dazu - dann trägt der Arm den Körper nicht, und es war kein Liegestütz.
   *
   * # Wogegen das ist (10.09.2026, zweiter Trick)
   *
   * Nachdem das Kopfwippen ausgesperrt war, hat chris den nächsten Weg gefunden: auf den
   * Knien sitzen und nur die Arme in der Luft beugen und strecken, der Oberkörper bewegt
   * sich nicht. Der Ellbogen beugt sich dabei **wirklich** - `minRepRangeDeg` greift
   * also nicht, die aufgezeichneten Bewegungsumfänge liegen bei 47-102°, mitten im
   * Bereich echter Wiederholungen.
   *
   * Was sich stattdessen unterscheidet, ist die *Richtung* des Oberarms. Im Liegestütz
   * steht er quer zum Rumpf und zeigt zum Boden; wer kniend die Arme nach vorn hält,
   * verlängert damit die Rumpflinie. Gemessen (alle Sitzungen mit Startpositions-Sperre):
   *
   * | Sitzung | Wiederholungen | Ellbogen-Flare |
   * |---|---|---|
   * | 10.09. 17:43 (echt) | 15 | 54-88° |
   * | 10.09. 18:18 (echt) | 19 | 56-61° |
   * | 10.09. 18:32 (Kopfwippen) | 20 | 59-98° |
   * | 10.09. 19:03 (**nur Arme, kniend**) | 21 | **63-177°, Median 174°** |
   *
   * Bei 120° fällt keine einzige echte Wiederholung durch (schlechtester Wert 98°) und 19
   * der 21 Armbewegungen. Die zwei, die bleiben, hatten 77° und 63° - in diesen beiden
   * Momenten stand der Arm tatsächlich quer zum Rumpf, sie sind an dieser Messung nicht
   * von einem Liegestütz zu unterscheiden.
   *
   * # Warum nicht über die Hüfte
   *
   * Der naheliegende zweite Weg wäre der Hüftwinkel: kniend 110-114°, echt 121-163°. Er
   * wird bewusst **nicht** benutzt. Der Abstand beträgt 7°, und genau so groß ist das
   * gemessene Rauschen der Hüfte in der Startposition (`hipSpreadDeg` 6-9° in allen drei
   * Aufzeichnungen). Eine Schwelle in dieser Lücke würde echte Wiederholungen wegwerfen,
   * sobald jemand einen halben Meter weiter links liegt.
   *
   * # Nicht zu verwechseln mit `maxElbowFlareDeg` (80°)
   *
   * Die andere Zahl bewertet die *Technik* ("Ellenbogen näher am Körper führen") und
   * kostet Punkte. Diese hier entscheidet, ob überhaupt gezählt wird, und liegt deshalb
   * weit darüber: Sie soll nicht Technik beurteilen, sondern eine Haltung ausschließen,
   * die kein Liegestütz ist. Dieselbe Trennung wie bei `goodDepthElbowDeg` /
   * `minRepRangeDeg`.
   */
  notAPushUpFlareDeg: number;
  /**
   * Wie lange die Stützhaltung durchgehend verlassen sein darf, bevor die Startposition
   * neu eingenommen werden muss.
   *
   * # Wogegen das ist (11.09.2026)
   *
   * Die Startposition wurde bisher **einmal** geprüft und danach nie wieder. Wer sie
   * einnahm und anschließend aufstand, sich hinkniete oder das Handy umstellte, konnte
   * den Rest der Sitzung in beliebiger Haltung verbringen - die Prüfungen je Wiederholung
   * greifen zwar weiter, aber sie greifen eben erst *nach* jeder Bewegung und sagen nichts
   * darüber, ob die Person überhaupt noch trainiert.
   *
   * Jetzt läuft dieselbe Prüfung weiter: Bleibt die Haltung länger als diese Spanne
   * außerhalb dessen, was ein Stütz ist, wird die Zählung angehalten und die Position muss
   * erneut zwei Sekunden gehalten werden - wie beim ersten Mal.
   *
   * # Warum 1,5 Sekunden
   *
   * Die Kosten stehen hier ungewöhnlich: Ein Fehlalarm kostet mitten im Satz zwei Sekunden
   * Nachkalibrieren, ein verpasster Alarm lässt beliebiges Schummeln zu. 1,5 Sekunden sind
   * lang genug, dass kein Tracking-Aussetzer und kein tiefer Umkehrpunkt sie erreicht (eine
   * ganze Wiederholung dauert im Median 1,2 s, die Haltung ist dabei durchgehend gültig),
   * und kurz genug, dass niemand in dieser Zeit eine Wiederholung in falscher Haltung
   * unterbringt.
   */
  postureLostMs: number;
  /**
   * Um wie viele Grad der Ellbogenwinkel vom höchsten Punkt der Aufwärtsbewegung wieder
   * abfallen muss, damit die Wiederholung als beendet gilt - auch wenn `elbowUpDeg` nie
   * erreicht wurde.
   *
   * Warum es das braucht: Der Abschluss hing bis zum 10.09.2026 allein an `elbowUpDeg`
   * (160°). Wer oben nicht ganz durchstreckt - was mit zunehmender Ermüdung normal ist -
   * schloss die Wiederholung nie ab. Die nächste Abwärtsbewegung wurde dann als
   * Fortsetzung *derselben* Wiederholung gelesen, und mehrere Liegestütze verschmolzen zu
   * einem einzigen, überlangen "Rep", der schließlich am Zeitlimit verworfen wurde. In der
   * Aufzeichnung vom 09.09.2026, 19:26 Uhr steckten in zwei verworfenen Abschnitten von
   * je 8 Sekunden - bei lückenlosem Tracking, 0 verlorene Frames - rund sechs echte
   * Liegestütze: 8 gezählt plus 6 verschluckt ergibt genau die 14, die chris gemacht hat.
   *
   * Mit dieser Umkehrpunkt-Erkennung ist der Abschluss unabhängig davon, wie weit jemand
   * oben durchstreckt: Sobald es nach dem Hochkommen wieder abwärts geht, war das eine
   * Wiederholung. 15° liegen deutlich über dem Messrauschen (die Winkelverläufe sind
   * glatt), aber unter jeder echten Abwärtsbewegung.
   */
  repReversalToleranceDeg: number;
  /**
   * Ellbogenwinkel (Grad), bis zu dem eine Wiederholung heruntergehen muss, damit sie als
   * tief genug gilt. Größer = nachsichtiger. Entscheidet **nur die Bewertung**, nicht ob
   * gezählt wird (dafür sind `elbowUpDeg` und `elbowAttemptDeg` zuständig).
   *
   * # Warum 105 und nicht die 95 aus der Lehrbuch-Geometrie (Stand 10.09.2026)
   *
   * Auf dem Papier ist die untere Position eines Liegestützes ein rechter Winkel oder
   * enger. Gemessen wird auf dem Gerät aber etwas anderes: In allen 176 aufgezeichneten
   * Wiederholungen (`docs/messdaten/`) liegt der tiefste Punkt im Median bei 101°, und in
   * den Sitzungen vom 09.09.2026 abends häufen sich die Werte auffällig eng zwischen 96°
   * und 104°. Bei 95° hätte das 85 % aller Wiederholungen als "nicht tief genug" gemeldet,
   * bei 105° sind es 17 %.
   *
   * Dass das Messung und nicht Ausführung ist, zeigt die Streuung *innerhalb* einer
   * Sitzung: Am 09.09.2026 um 20:12 Uhr liegen 24 Wiederholungen am Stück zwischen 91°
   * und 139°. Niemand ändert seine Tiefe im selben Satz um 48°. Der Grund ist die
   * Perspektive: Am Tiefpunkt zeigt der Unterarm fast auf die Kamera zu, und genau dann
   * ist MediaPipes Tiefenschätzung am schlechtesten - der Winkel fällt zu groß aus.
   *
   * Eine Meldung, die bei fast jeder Wiederholung erscheint, ist keine Rückmeldung
   * mehr, sondern Rauschen: Man gewöhnt sich an sie und übersieht sie auch dann, wenn sie
   * einmal stimmt. 105° meldet die Wiederholungen, die wirklich aus der Reihe fallen.
   *
   * Das ist ein **empirischer Wert für diese Kameraperspektive**, keine Aussage über
   * richtige Ausführung. Der saubere Weg wäre ein Tiefenmaß, das nicht am Unterarm hängt
   * (etwa die Schulterhöhe im Verhältnis zur Armlänge) - siehe `docs/backlog.md`,
   * "Erkennung weiter verbessern".
   */
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
   *
   * Der Wert stammt aus der ersten Aufzeichnung *nach* dieser Umstellung (09.09.2026,
   * 19:26 Uhr): sauber ausgeführte Wiederholungen lagen bei 152-169°, eine erkennbar
   * abgekippte Hüfte bei 97°. 145° lässt die sauberen mit 7° Luft durch und markiert die
   * echte Abweichung mit großem Abstand. Vorher standen hier 160° - ein Wert, der zur
   * alten, über den Knöchel verzerrten Messung gehörte und den in dieser Aufzeichnung
   * nur 2 von 8 Wiederholungen erreichten.
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
   * Längste Dauer (ms), nach der eine laufende Wiederholung abgebrochen wird.
   *
   * Stand 10.09.2026 auf 12 Sekunden angehoben (vorher 8): Bei 8 Sekunden wurden echte
   * Wiederholungen mitgerissen, sobald mehrere zu einer verschmolzen - die Ursache dafür
   * behebt jetzt `repReversalToleranceDeg`. Gemessene echte Wiederholungen dauern bis zu
   * 5,3 Sekunden; 12 Sekunden lassen bewusst langsamen Ausführungen Luft und fangen
   * trotzdem den hängenden Zähler ab, um den es ursprünglich ging (dort standen 26, 30
   * und 34 Sekunden).
   */
  maxRepDurationMs: number;
  /**
   * Mindestanteil (0..1) der Frames einer Wiederholung, in denen eine verwertbare Pose
   * da war. Darunter wird die Wiederholung verworfen, statt aus Bruchstücken eine
   * Formnote zu erfinden.
   */
  minTrackedFrameRatio: number;
  /**
   * Sicherheitsabstand zum Bildrand (Anteil der Bildbreite/-höhe), innerhalb dessen eine
   * Landmarke noch als "im Bild" gilt - **nur für die Formprüfungen** (Hüfte, Knie, Ohr).
   *
   * Warum diese Prüfung überhaupt gebraucht wird, steht bei `allInFrame` in
   * landmarks.ts: MediaPipe liefert auch für Körperteile außerhalb des Bildes
   * Koordinaten - geschätzte -, und der Sichtbarkeitswert, mit dem man sie normalerweise
   * aussortieren würde, kommt bei `react-native-mediapipe` nie in JS an. Ohne diese
   * Prüfung rechnet die Analyse mit erfundenen Punkten weiter: Genau daher kamen
   * Zählungen, während jemand noch halb außerhalb des Bildes stand, und Hüftwinkel, die
   * innerhalb einer Sitzung zwischen 10° und 158° sprangen.
   *
   * **Warum der Arm einen anderen Maßstab bekommt** (siehe `processFrame`): Die beiden
   * Fehlerrichtungen kosten völlig Unterschiedliches. Ist eine Hüfte fälschlich
   * ausgeschlossen, fällt *eine Formnote* aus - im Zweifel für den Sportler, genau wie
   * bei einem nie sichtbaren Unterkörper. Ist der Arm fälschlich ausgeschlossen, zählt
   * die App **gar nichts mehr**, und chris steht mit einem toten Zähler vor dem Handy,
   * ohne dass ihm ein Log zur Verfügung stünde. Deshalb ist beim Arm nur "nachweislich
   * außerhalb des Bildes" ein Ausschlussgrund (Abstand 0), bei den Formpunkten dagegen
   * schon der angeschnittene Rand.
   */
  frameMargin: number;
}

export const DEFAULT_THRESHOLDS: PushUpThresholds = {
  elbowUpDeg: 160,
  elbowAttemptDeg: 140,
  minPlankHipStraightnessDeg: 110,
  notAPlankDepthDeg: 95,
  minRepRangeDeg: 45,
  notAPushUpFlareDeg: 120,
  postureLostMs: 1500,
  repReversalToleranceDeg: 15,
  goodDepthElbowDeg: 105,
  minHipStraightnessDeg: 145,
  maxElbowFlareDeg: 80,
  minNeckAngleDeg: 115,
  minVisibility: 0.5,
  formPercentile: 10,
  depthOutlierFrames: 2,
  minRepDurationMs: 600,
  maxRepDurationMs: 12000,
  minTrackedFrameRatio: 0.6,
  frameMargin: 0.02,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Wie weit unter der eigenen, ruhig gehaltenen Grundhaltung ein Wert noch als in Ordnung
 * durchgeht.
 *
 * Die 20° bei der Hüfte sind aus den Messdaten abgeleitet, nicht geraten: In der
 * Aufzeichnung vom 09.09.2026 (19:26 Uhr) liegen sauber ausgeführte Wiederholungen bei
 * 152-169°, eine erkennbar abgekippte Hüfte bei 97°. Eine Grundhaltung von rund 165°
 * minus 20° ergibt genau die 145°, die als allgemeiner Schwellwert aus denselben Daten
 * kalibriert wurden - die persönliche Rechnung fällt für diese Person also mit dem
 * bisherigen Wert zusammen und weicht nur ab, wo die Perspektive den Winkel staucht.
 *
 * Beim Nacken sind es 25°, weil dort mehr Spiel drin ist: Der Kopf senkt sich im Verlauf
 * einer Wiederholung, während die Hüfte über die ganze Wiederholung gerade bleiben soll.
 */
const PERSONAL_HIP_MARGIN_DEG = 20;
const PERSONAL_NECK_MARGIN_DEG = 25;

/**
 * Wie weit die persönliche Schwelle den allgemeinen Wert höchstens lockern darf. Ohne
 * diese Grenze würde eine Kalibrierung in schlechter Haltung die Prüfung praktisch
 * abschalten - wer mit durchgesackter Hüfte einsteigt, bekäme das Durchsacken für den
 * Rest der Sitzung als "normal" bescheinigt.
 */
const MAX_PERSONAL_RELAXATION_DEG = 25;

/**
 * Persönliche Schwellwerte aus der in der Startposition gemessenen Grundhaltung.
 *
 * **Sie lockern nur, sie verschärfen nie.** Das ist eine bewusste Entscheidung und keine
 * Vereinfachung: Das Problem, das die Kalibrierung lösen soll, sind Fehlalarme - "Hüfte
 * hängt durch" bei kerzengeradem Rücken, nur flach von vorn gefilmt. Wessen Grundhaltung
 * *besser* ist als der allgemeine Schwellwert, der hat dieses Problem nicht, und ihn
 * dafür strenger zu bewerten würde genau die Sorte Meldung erzeugen, die hier abgestellt
 * werden soll. Die beiden Fehlerrichtungen wiegen unterschiedlich schwer: Eine zu milde
 * Schwelle bewertet eine schlechte Wiederholung zu gut, eine zu strenge nörgelt bei jeder
 * guten - und Letzteres bringt Leute dazu, der App nicht mehr zu glauben.
 *
 * Bewusst **nicht** angefasst werden die Ellbogen-Schwellen (`elbowUpDeg`,
 * `elbowAttemptDeg`, `goodDepthElbowDeg`): Sie entscheiden, *ob* gezählt wird, nicht wie
 * gut bewertet wird. Ein Fehler dort kostet Wiederholungen, ein Fehler bei Hüfte oder
 * Nacken nur Punkte. Und die Tiefe lässt sich aus einer gehaltenen Startposition ohnehin
 * nicht ableiten - dafür bräuchte es eine vorgeführte Wiederholung. `topElbowAngleDeg`
 * wird trotzdem gemessen und mitprotokolliert, damit sich später anhand echter Daten
 * entscheiden lässt, ob es sich lohnt.
 */
export function personalThresholds(
  baseline: PostureBaseline,
  base: PushUpThresholds = DEFAULT_THRESHOLDS
): Partial<PushUpThresholds> {
  const personal: Partial<PushUpThresholds> = {};

  if (baseline.neutralHipStraightnessDeg !== null) {
    personal.minHipStraightnessDeg = clamp(
      baseline.neutralHipStraightnessDeg - PERSONAL_HIP_MARGIN_DEG,
      base.minHipStraightnessDeg - MAX_PERSONAL_RELAXATION_DEG,
      base.minHipStraightnessDeg
    );
  }

  if (baseline.neutralNeckAngleDeg !== null) {
    personal.minNeckAngleDeg = clamp(
      baseline.neutralNeckAngleDeg - PERSONAL_NECK_MARGIN_DEG,
      base.minNeckAngleDeg - MAX_PERSONAL_RELAXATION_DEG,
      base.minNeckAngleDeg
    );
  }

  return personal;
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
/**
 * Wie waagerecht die Strecke `a`-`b` im Bild liegt: 1 = ganz waagerecht, 0 = ganz
 * senkrecht. Nur zur Aufzeichnung - siehe `PostureBaseline.torsoHorizontalRatio`.
 */
function horizontalRatio(a: { x: number; y: number }, b: { x: number; y: number }): number | null {
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  const total = dx + dy;
  if (total === 0) return null;
  return dx / total;
}

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
interface TraceSample {
  tMs: number;
  elbow: number;
  hip: number | null;
  flare: number | null;
  neck: number | null;
  horiz: number | null;
  sx: number | null;
  sy: number | null;
  wx: number | null;
  wy: number | null;
}

interface RepAccumulator {
  startTimeMs: number;
  /** Jeder verwertbare Frame dieser Bewegung, in Reihe - Grundlage für `RepTrace`. */
  samples: TraceSample[];
  elbowAngles: number[];
  hipStraightness: number[];
  elbowFlare: number[];
  neckAngles: number[];
  hipSagDeviationAtDeepest: number;
  deepestElbowAngleSoFar: number;
  /** Höchster Ellbogenwinkel, seit die Aufwärtsbewegung begonnen hat. */
  peakElbowSinceBottom: number;
  /** Frames mit verwertbarer Pose seit Beginn dieser Wiederholung. */
  trackedFrames: number;
  /** Frames ohne verwertbare Pose seit Beginn dieser Wiederholung. */
  untrackedFrames: number;
  /** Davon die, bei denen der Arm nachweislich aus dem Bild ragte (siehe `DiscardedRep.outOfFrameFrames`). */
  outOfFrameFrames: number;
}

function freshAccumulator(timeMs: number): RepAccumulator {
  return {
    startTimeMs: timeMs,
    samples: [],
    elbowAngles: [],
    hipStraightness: [],
    elbowFlare: [],
    neckAngles: [],
    hipSagDeviationAtDeepest: 0,
    deepestElbowAngleSoFar: Infinity,
    peakElbowSinceBottom: -Infinity,
    trackedFrames: 0,
    untrackedFrames: 0,
    outOfFrameFrames: 0,
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
  /**
   * `baseThresholds` ist der Stand vor der Kalibrierung, `thresholds` der gerade
   * geltende. Getrennt, damit `reset()` sauber zurückkommt, ohne den ursprünglichen
   * Konstruktor-Parameter noch einmal zu brauchen.
   */
  private readonly baseThresholds: PushUpThresholds;
  private thresholds: PushUpThresholds;
  /**
   * Solange gesetzt, wird noch **nicht** gezählt: Erst muss die Startposition eingenommen
   * und ruhig gehalten werden (siehe `startPosition.ts`). `null` heißt scharf.
   */
  private gate: StartPositionGate | null;
  private readonly gateCriteria: Partial<StartPositionCriteria>;
  private baseline: PostureBaseline | null = null;
  /**
   * Der Verlauf der zuletzt abgeschlossenen Bewegung, bis `processFrame` ihn zurückgibt.
   *
   * Über ein Feld und nicht über den Rückgabewert von `finishRep`/`discardRep`: Beide
   * werden an mehreren Stellen der Zustandsmaschine aufgerufen, und der Verlauf müsste
   * sonst durch jeden dieser Pfade einzeln durchgereicht werden - genau dort geht er dann
   * irgendwann verloren.
   */
  private pendingTrace: RepTrace | null = null;
  /**
   * Seit wann die Stützhaltung durchgehend verlassen ist, `null` solange sie stimmt.
   * Grundlage für das erneute Einnehmen (siehe `PushUpThresholds.postureLostMs`).
   */
  private postureLostSinceMs: number | null = null;
  /**
   * Ob die Startposition in dieser Sitzung schon einmal stand. Entscheidet nur, welche
   * Texte die Anzeige nimmt - die Prüfung selbst ist beim zweiten Mal dieselbe.
   */
  private armedBefore = false;
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
    NOT_A_PLANK: 0,
    TOO_SHALLOW: 0,
    ARMS_NOT_SUPPORTING: 0,
  };

  constructor(thresholds: Partial<PushUpThresholds> = {}, startPosition: Partial<StartPositionCriteria> = {}) {
    this.baseThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    this.thresholds = this.baseThresholds;
    // Die Startposition ist die obere Position eines Liegestützes - deshalb dieselbe
    // Ellbogenschwelle. Wäre sie kleiner, sähe die Zustandsmaschine im Moment des
    // Scharfschaltens bereits eine Abwärtsbewegung und begänne eine Wiederholung, die nur
    // aus dem Kalibrier-Halten besteht.
    this.gateCriteria = {
      minElbowAngleDeg: this.baseThresholds.elbowUpDeg,
      minHipStraightnessDeg: this.baseThresholds.minPlankHipStraightnessDeg,
      ...startPosition,
    };
    this.gate = new StartPositionGate(this.gateCriteria);
  }

  reset(): void {
    this.phase = 'up';
    this.repIndex = 0;
    this.acc = null;
    this.lockedSide = null;
    this.discardCounts = {
      TOO_SHORT: 0,
      TOO_LONG: 0,
      TRACKING_LOST: 0,
      NOT_A_PLANK: 0,
      TOO_SHALLOW: 0,
      ARMS_NOT_SUPPORTING: 0,
    };
    this.thresholds = this.baseThresholds;
    this.baseline = null;
    this.pendingTrace = null;
    this.postureLostSinceMs = null;
    this.armedBefore = false;
    this.gate = new StartPositionGate(this.gateCriteria);
  }

  /** `false`, solange die Startposition noch nicht eingenommen wurde - dann wird nicht gezählt. */
  isArmed(): boolean {
    return this.gate === null;
  }

  /**
   * Die in der Startposition gemessene Grundhaltung, oder `null` - wenn noch nicht scharf
   * geschaltet wurde, oder wenn über die Notbremse (`timeoutMs`) ohne gültige Messung
   * gestartet wurde. Für den Kalibrier-Log und die Anzeige.
   */
  getBaseline(): PostureBaseline | null {
    return this.baseline;
  }

  /** Die aktuell geltenden Schwellwerte - nach der Kalibrierung die persönlichen. */
  getThresholds(): PushUpThresholds {
    return this.thresholds;
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
    timestampMs: number,
    imageLandmarks?: Pose
  ): {
    live: LiveFeedback;
    completedRep: RepResult | null;
    discardedRep: DiscardedRep | null;
    /**
     * Der Verlauf der gerade abgeschlossenen Bewegung - gezählt oder verworfen -, sonst
     * `null`. Nur für die Aufzeichnung (siehe `RepTrace`), die Bewertung benutzt ihn nicht.
     */
    trace: RepTrace | null;
  } {
    const t = this.thresholds;
    /**
     * Eine Landmarke ist nur brauchbar, wenn sie sowohl sicher erkannt als auch
     * tatsächlich im Bild ist. Die zweite Hälfte trägt auf dem echten Gerät die ganze
     * Last: `allVisible` ist dort wirkungslos, weil `react-native-mediapipe` den
     * Sichtbarkeitswert nie durchreicht (siehe landmarks.ts). Ohne `imageLandmarks` -
     * etwa in Tests - bleibt es beim alten Verhalten.
     *
     * `margin` unterscheidet Arm von Formpunkten, weil die Fehlerrichtungen
     * unterschiedlich viel kosten - siehe `PushUpThresholds.frameMargin`.
     */
    const usable = (indices: number[], margin: number) =>
      allVisible(pose, indices, t.minVisibility) && allInFrame(imageLandmarks, indices, margin);

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
    // Abstand 0: Nur ein Arm, der nachweislich aus dem Bild ragt, hält die Zählung an.
    const armIndices = [idx.shoulder, idx.elbow, idx.wrist];
    if (!usable(armIndices, 0)) {
      // Mitzählen, statt den Ausfall stillschweigend zu überspringen: Am Ende der
      // Wiederholung entscheidet dieser Anteil darüber, ob die Formwerte überhaupt
      // belastbar sind.
      if (this.acc) {
        this.acc.untrackedFrames += 1;
        if (!allInFrame(imageLandmarks, armIndices, 0)) this.acc.outOfFrameFrames += 1;
      }
      // Auch ein Frame ohne verwertbare Pose gehört in das Startpositions-Fenster: Er
      // verwirft die bisher gesammelte Haltezeit (wer zwischendurch aus dem Bild
      // verschwindet, hat nicht durchgehend gehalten) und lässt die Notbremse weiterlaufen.
      // Auch ohne Pose weiterprüfen: Wer aus dem Bild geht, hat die Position verlassen -
      // und genau das war bisher der bequemste Weg, sich der Prüfung zu entziehen.
      if (!this.gate) discardedRep = this.trackPosture(timestampMs, false, null, null) ?? discardedRep;
      const startPosition = this.gate ? this.pushToGate(null, timestampMs) : null;
      return {
        live: {
          phase: this.phase,
          trackingOk: false,
          elbowAngleDeg: 0,
          hipStraightnessDeg: 0,
          cue: null,
          startPosition,
          // Nur melden, was sich auch beheben lässt: "Arm aus dem Bild" heißt zurücktreten,
          // "Arm nicht sicher erkannt" hieße nichts, was jemand tun könnte.
          framing: allInFrame(imageLandmarks, armIndices, 0) ? null : 'ARMS_OUT_OF_FRAME',
        },
        completedRep: null,
        discardedRep,
        trace: this.takeTrace(),
      };
    }

    const shoulder = getLandmark(pose, idx.shoulder)!;
    const elbow = getLandmark(pose, idx.elbow)!;
    const wrist = getLandmark(pose, idx.wrist)!;
    const elbowAngleDeg = angleAtPoint(shoulder, elbow, wrist);

    const hasHip = usable([idx.hip], t.frameMargin);
    const hasKnee = usable([idx.knee], t.frameMargin);
    const hasEar = usable([idx.ear], t.frameMargin);
    // Gezählt wird weiter, nur Hüft- und Nackenbewertung fallen aus. Ohne Hinweis wäre
    // für den Nutzer nicht erklärbar, warum plötzlich nie mehr etwas zur Haltung gemeldet
    // wird - er würde es für "meine Haltung ist perfekt" halten.
    const framing: FramingIssue | null =
      !allInFrame(imageLandmarks, [idx.hip, idx.knee], t.frameMargin) ? 'LOWER_BODY_OUT_OF_FRAME' : null;
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
    // Wie waagerecht der Rumpf im Bild liegt (1 = waagerecht, 0 = senkrecht). Nur
    // aufgezeichnet, nicht geprüft - warum, steht bei `PostureBaseline.torsoHorizontalRatio`.
    const torsoHorizontalRatio = hip ? horizontalRatio(shoulder, hip) : null;

    // Vor dem Scharfschalten läuft die Zustandsmaschine gar nicht. Der Weg in die
    // Position hinein kann damit keine Wiederholung mehr erzeugen - er *sieht* für einen
    // Ellbogenwinkel-Zähler nämlich genau wie eine aus (siehe `startPosition.ts`).
    if (this.gate) {
      const startPosition = this.pushToGate(
        { elbowAngleDeg, hipStraightnessDeg, neckAngleDeg, elbowFlareDeg, torsoHorizontalRatio },
        timestampMs
      );
      return {
        live: {
          phase: this.phase,
          trackingOk: true,
          elbowAngleDeg,
          hipStraightnessDeg: hipStraightnessDeg ?? 0,
          cue: null,
          startPosition,
          framing,
        },
        completedRep: null,
        discardedRep,
        trace: this.takeTrace(),
      };
    }

    // Weiterprüfen, ob die Stützhaltung überhaupt noch steht. Muss VOR die
    // Zustandsmaschine, sonst liefe noch ein Frame in eine Wiederholung hinein, die in
    // einer bereits verlassenen Haltung begonnen hat.
    discardedRep = this.trackPosture(timestampMs, true, hipStraightnessDeg, elbowFlareDeg) ?? discardedRep;
    if (this.gate) {
      return {
        live: {
          phase: this.phase,
          trackingOk: true,
          elbowAngleDeg,
          hipStraightnessDeg: hipStraightnessDeg ?? 0,
          cue: null,
          startPosition: this.pushToGate(
            { elbowAngleDeg, hipStraightnessDeg, neckAngleDeg, elbowFlareDeg, torsoHorizontalRatio },
            timestampMs
          ),
          framing,
        },
        completedRep: null,
        discardedRep,
        trace: this.takeTrace(),
      };
    }

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
          if (this.acc) this.acc.peakElbowSinceBottom = elbowAngleDeg;
        }
        break;

      case 'ascending': {
        const peak = Math.max(this.acc?.peakElbowSinceBottom ?? -Infinity, elbowAngleDeg);
        if (this.acc) this.acc.peakElbowSinceBottom = peak;

        // Zwei Wege, eine Wiederholung abzuschließen:
        //   1. Der Arm ist wieder gestreckt (`elbowUpDeg`) - der saubere Normalfall.
        //   2. Es geht vom höchsten erreichten Punkt wieder spürbar abwärts, ohne dass
        //      `elbowUpDeg` je erreicht wurde. Dann hat die Person oben nicht ganz
        //      durchgestreckt und beginnt bereits die nächste Wiederholung.
        //
        // Es gibt hier bewusst KEINEN Rückweg nach 'down' mehr. Der wäre in genau dem
        // Fall, um den es geht, immer zuerst dran: Wer bei 148° umkehrt, unterschreitet
        // die Versuchsschwelle (140°) schon nach 8° - lange bevor die 15°-Umkehr bei
        // 133° erkannt wäre. Der Rückweg hat die Umkehrerkennung damit vollständig
        // ausgehebelt und die Wiederholungen weiter verschmelzen lassen. Ein echtes
        // Nachwippen am tiefsten Punkt kommt hier gar nicht an: Dafür müsste der Winkel
        // erst über 140° steigen, sonst bleibt die Zustandsmaschine in 'down'.
        const reversed = elbowAngleDeg <= peak - t.repReversalToleranceDeg;
        if (elbowAngleDeg >= t.elbowUpDeg || reversed) {
          const outcome = this.finishRep(timestampMs);
          completedRep = outcome.rep;
          // Ein bereits gesetztes `discardedRep` (Zeitablauf) kann hier nicht mehr
          // stehen: Der Zeitablauf hat `this.acc` geleert, dann gäbe es keine laufende
          // Wiederholung mehr abzuschließen.
          if (outcome.discarded) discardedRep = outcome.discarded;
          if (elbowAngleDeg < t.elbowUpDeg) {
            // Die Abwärtsbewegung der *nächsten* Wiederholung läuft bereits - sie hier
            // beginnen zu lassen statt in 'up' zu warten, kostet sonst genau diese
            // Wiederholung. Die Seite bleibt dabei festgelegt (nicht auf null zurück):
            // Sie wird sonst mitten in der neuen Wiederholung neu gewählt, und genau das
            // soll `lockedSide` verhindern.
            this.phase = 'descending';
            this.lockedSide = side;
            this.acc = freshAccumulator(timestampMs);
          } else {
            this.phase = 'up';
            this.lockedSide = null;
          }
        }
        break;
      }
    }

    if (this.acc && this.phase !== 'up') {
      this.acc.trackedFrames += 1;
      // Der Verlauf: index-gleich und mit Zeitstempel, im Unterschied zu den
      // Kennzahl-Arrays darunter, die einzeln gefiltert werden. Warum es das gibt, steht
      // bei `RepTrace`.
      const shoulderImage = imageLandmarks?.[idx.shoulder];
      const wristImage = imageLandmarks?.[idx.wrist];
      const per1000 = (v: number | undefined) => (v === undefined ? null : Math.round(v * 1000));
      // Eigener Helfer statt `roundOrNull`: Der behandelt NaN ("nie gemessen"), hier geht
      // es um bereits als `null` markierte Werte ("in diesem Frame nicht messbar").
      const deg = (v: number | null) => (v === null ? null : Math.round(v));
      this.acc.samples.push({
        tMs: Math.round(timestampMs - this.acc.startTimeMs),
        elbow: Math.round(elbowAngleDeg),
        hip: deg(hipStraightnessDeg),
        flare: deg(elbowFlareDeg),
        neck: deg(neckAngleDeg),
        horiz: torsoHorizontalRatio === null ? null : Math.round(torsoHorizontalRatio * 100),
        sx: per1000(shoulderImage?.x),
        sy: per1000(shoulderImage?.y),
        wx: per1000(wristImage?.x),
        wy: per1000(wristImage?.y),
      });
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
      live: {
        phase: this.phase,
        trackingOk: true,
        elbowAngleDeg,
        hipStraightnessDeg: hipStraightnessDeg ?? 0,
        cue,
        startPosition: null,
        framing,
      },
      completedRep,
      discardedRep,
      trace: this.takeTrace(),
    };
  }

  /**
   * Reicht einen Frame an die Startpositions-Prüfung weiter. Liefert den Fortschritt für
   * die Anzeige, oder `null` sobald scharf geschaltet wurde - dann sind die persönlichen
   * Schwellwerte bereits gesetzt.
   */
  private pushToGate(
    measured: Omit<StartPositionFrame, 'timeMs'> | null,
    timestampMs: number
  ): StartPositionProgress | null {
    const outcome = this.gate!.push({
      timeMs: timestampMs,
      elbowAngleDeg: measured?.elbowAngleDeg ?? null,
      hipStraightnessDeg: measured?.hipStraightnessDeg ?? null,
      neckAngleDeg: measured?.neckAngleDeg ?? null,
      elbowFlareDeg: measured?.elbowFlareDeg ?? null,
      torsoHorizontalRatio: measured?.torsoHorizontalRatio ?? null,
    });
    if (!outcome.ready) return outcome.progress;
    this.gate = null;
    this.armedBefore = true;
    // Nach dem erneuten Einnehmen darf die Uhr nicht mit einem alten Stand weiterlaufen.
    this.postureLostSinceMs = null;
    // Die Grundhaltung wird nur beim **ersten** Mal übernommen. Wer die Position mitten in
    // der Sitzung verliert und neu einnimmt, behält die Schwellwerte der ersten Messung.
    //
    // Zwei Gründe. Erstens die Bewertung: Eine Sitzung, in der sich die Maßstäbe zwischen
    // Wiederholung 12 und 13 verschieben, lässt sich hinterher nicht mehr deuten - die
    // Formnoten davor und danach wären nicht vergleichbar. Zweitens, und wichtiger:
    // `personalThresholds` lockert nur (nie umgekehrt). Ein zweites Kalibrieren wäre damit
    // ein Weg, sich durch absichtlich schlechte Haltung mildere Schwellwerte zu holen -
    // und die Position zu verlieren wäre plötzlich ein Vorteil.
    if (this.baseline === null) {
      this.baseline = outcome.baseline;
      if (outcome.baseline) {
        this.thresholds = { ...this.baseThresholds, ...personalThresholds(outcome.baseline, this.baseThresholds) };
      }
    }
    return null;
  }

  /**
   * Bricht die laufende Wiederholung ab, ohne sie zu zählen oder zu bewerten. Der
   * Wiederholungszähler wird bewusst nicht erhöht - eine verworfene Wiederholung darf
   * keine Nummer verbrauchen, sonst klaffen später Lücken in der Historie.
   */
  /**
   * Baut den Verlauf der gerade abgeschlossenen Bewegung. Muss aufgerufen werden, **bevor**
   * `this.acc` geleert wird.
   *
   * Bewusst parallele Reihen statt einer Liste von Objekten: Das Ergebnis geht als JSON
   * durch den Teilen-Dialog, und Android deckelt dessen Größe. `{"t":[0,33,66],...}` ist
   * rund ein Drittel so lang wie `[{"t":0,...},{"t":33,...}]`, ohne dass ein Mensch es
   * anders lesen müsste - ausgewertet wird es ohnehin am PC.
   */
  /**
   * Prüft nach dem Scharfschalten weiter, ob die Stützhaltung überhaupt noch eingenommen
   * ist - und schaltet zurück, wenn sie zu lange verlassen wurde.
   *
   * Bewusst **nicht** der Ellbogenwinkel: Der geht in jeder Wiederholung auf rund 100°
   * herunter, das ist ja der Sinn der Übung. Geprüft wird nur, was während eines echten
   * Liegestützes durchgehend gilt - Körper gestreckt und Oberarm quer zum Rumpf. Beides
   * hält in den aufgezeichneten Sätzen jede einzelne Wiederholung ein (Hüfte 121-175°,
   * Flare 54-88°), und beides verlässt jede der nachgestellten Trickhaltungen.
   *
   * `null` als Messwert heißt "diesen Frame nicht messbar" und zählt bewusst **nicht**
   * gegen die Haltung: Ein aus dem Bild ragender Unterkörper ist eine Frage der
   * Kameraposition, keine Aussage über die Haltung. Nur ein Frame ganz ohne Pose zählt
   * dagegen (`posed: false`) - wer gar nicht mehr zu sehen ist, trainiert auch nicht.
   */
  private trackPosture(
    timestampMs: number,
    posed: boolean,
    hipStraightnessDeg: number | null,
    elbowFlareDeg: number | null
  ): DiscardedRep | null {
    const t = this.thresholds;
    const inPosition =
      posed &&
      !(hipStraightnessDeg !== null && hipStraightnessDeg < t.minPlankHipStraightnessDeg) &&
      !(elbowFlareDeg !== null && elbowFlareDeg < this.gateCriteria.minTorsoArmAngleDeg!) &&
      !(elbowFlareDeg !== null && elbowFlareDeg > t.notAPushUpFlareDeg);

    if (inPosition) {
      this.postureLostSinceMs = null;
      return null;
    }
    if (this.postureLostSinceMs === null) {
      this.postureLostSinceMs = timestampMs;
      return null;
    }
    if (timestampMs - this.postureLostSinceMs < t.postureLostMs) return null;

    // Zurück zur Startposition. Die laufende Bewegung wird verworfen statt bewertet: Sie
    // wurde in einer Haltung begonnen, die inzwischen nachweislich keine Stützposition
    // mehr ist. Der Verwurf wird zurückgegeben und nicht stillschweigend geschluckt -
    // sonst bliebe der Zähler stehen, ohne dass irgendwo stünde warum.
    const discarded = this.acc ? this.discardRep('NOT_A_PLANK', timestampMs) : null;
    this.postureLostSinceMs = null;
    this.phase = 'up';
    this.lockedSide = null;
    this.gate = new StartPositionGate(this.gateCriteria, true);
    return discarded;
  }

  /** Gibt den zuletzt aufgezeichneten Verlauf heraus und vergisst ihn - genau einmal. */
  private takeTrace(): RepTrace | null {
    const trace = this.pendingTrace;
    this.pendingTrace = null;
    return trace;
  }

  private buildTrace(outcome: RepTrace['outcome']): RepTrace {
    const samples = this.acc?.samples ?? [];
    return {
      outcome,
      t: samples.map((f) => f.tMs),
      elbow: samples.map((f) => f.elbow),
      hip: samples.map((f) => f.hip),
      flare: samples.map((f) => f.flare),
      neck: samples.map((f) => f.neck),
      horiz: samples.map((f) => f.horiz),
      sx: samples.map((f) => f.sx),
      sy: samples.map((f) => f.sy),
      wx: samples.map((f) => f.wx),
      wy: samples.map((f) => f.wy),
    };
  }

  private discardRep(reason: RepDiscardReason, timestampMs: number): DiscardedRep {
    const acc = this.acc!;
    this.pendingTrace = this.buildTrace(reason);
    const discarded: DiscardedRep = {
      reason,
      durationMs: timestampMs - acc.startTimeMs,
      trackedFrames: acc.trackedFrames,
      untrackedFrames: acc.untrackedFrames,
      outOfFrameFrames: acc.outOfFrameFrames,
      minElbowAngleDeg: acc.elbowAngles.length ? Math.round(Math.min(...acc.elbowAngles)) : null,
      maxElbowAngleDeg: acc.elbowAngles.length ? Math.round(Math.max(...acc.elbowAngles)) : null,
      maxElbowFlareDeg: acc.elbowFlare.length ? Math.round(Math.max(...acc.elbowFlare)) : null,
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
    // Der obere Umkehrpunkt: die eigene kalibrierte Streckung, mindestens aber das, was in
    // dieser Wiederholung wirklich erreicht wurde. Das `Math.max` schützt den Fall, dass
    // beim Kalibrieren flacher gemessen wurde als beim Trainieren - sonst käme der
    // Bewegungsumfang zu klein heraus und eine echte Wiederholung fiele durch.
    const calibratedTopDeg = this.baseline?.topElbowAngleDeg ?? t.elbowUpDeg;
    const topDeg = Math.max(calibratedTopDeg, nthLargest(acc.elbowAngles, t.depthOutlierFrames));
    const elbowRangeDeg = topDeg - elbowDepthDeg;
    const hipStraightnessDeg = percentile(acc.hipStraightness, lowP);
    const elbowFlareDeg = percentile(acc.elbowFlare, highP);
    const neckAngleDeg = percentile(acc.neckAngles, lowP);

    // Der Arm hat sich kaum gebeugt: Das war keine Wiederholung, sondern - im
    // nachgestellten Fall vom 10.09.2026 - eine Kopfbewegung, die MediaPipe in die
    // geschätzte Schulterposition durchschlagen lässt. Warum der Bewegungsumfang und nicht
    // der Tiefpunkt darüber entscheidet, steht bei `minRepRangeDeg`.
    //
    // Bewusst nach `TOO_SHORT`/`TRACKING_LOST`, aber vor der Bewertung: Wer sich nicht
    // bewegt hat, soll nicht wegen "zu wenig Tiefe" und "Hüfte durchgehängt" Punkte
    // verlieren, sondern gar nicht erst gezählt werden.
    if (elbowRangeDeg < t.minRepRangeDeg) {
      return { rep: null, discarded: this.discardRep('TOO_SHALLOW', timestampMs) };
    }

    // Der Oberarm lag in der Rumpflinie statt quer dazu: Dann hat der Arm den Körper nicht
    // getragen. Im nachgestellten Fall vom 10.09.2026 war das Knien mit in der Luft
    // gebeugten Armen - eine echte Armbeugung, die `minRepRangeDeg` deshalb passiert.
    // `NaN > x` ist false, eine nie gemessene Hüfte führt also nie zum Verwerfen.
    if (elbowFlareDeg >= t.notAPushUpFlareDeg) {
      return { rep: null, discarded: this.discardRep('ARMS_NOT_SUPPORTING', timestampMs) };
    }

    // Weder Stützposition noch Tiefe: Das war der Weg in die Position hinein oder wieder
    // heraus, kein Liegestütz. Bewusst erst hier, nach der Kennzahlberechnung - vorher
    // stehen die Werte noch nicht fest. `NaN < x` ist false, eine nie gemessene Hüfte
    // führt also nie zum Verwerfen (Zweifel für den Sportler).
    if (hipStraightnessDeg < t.minPlankHipStraightnessDeg && elbowDepthDeg > t.notAPlankDepthDeg) {
      return { rep: null, discarded: this.discardRep('NOT_A_PLANK', timestampMs) };
    }

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
      elbowRangeDeg: Math.round(elbowRangeDeg),
    };

    this.pendingTrace = this.buildTrace('rep');
    this.acc = null;
    return { rep, discarded: null };
  }
}
