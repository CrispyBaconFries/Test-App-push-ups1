import type { FormIssue, FramingIssue, LiveFeedback, RepDiscardReason } from './formAnalysis';

export const ISSUE_LABELS_DE: Record<FormIssue, string> = {
  INSUFFICIENT_DEPTH: 'Tiefer gehen',
  HIPS_SAGGING: 'Hüfte anspannen – Rumpf sackt durch',
  HIPS_PIKING: 'Po senken – Körper bildet ein Dach',
  ELBOWS_FLARED: 'Ellenbogen näher am Körper führen',
  HEAD_MISALIGNED: 'Kopf in Verlängerung der Wirbelsäule halten',
};

export const ISSUE_SHORT_LABELS_DE: Record<FormIssue, string> = {
  INSUFFICIENT_DEPTH: 'Zu wenig Tiefe',
  HIPS_SAGGING: 'Hüfte sackt durch',
  HIPS_PIKING: 'Po zu hoch',
  ELBOWS_FLARED: 'Ellenbogen abgespreizt',
  HEAD_MISALIGNED: 'Kopfhaltung',
};

export function liveCueLabelDe(cue: LiveFeedback['cue']): string {
  if (cue === null) return '';
  if (cue === 'GOOD_FORM') return 'Saubere Haltung';
  return ISSUE_LABELS_DE[cue];
}

/**
 * Was auf dem Bildschirm steht, wenn ein Körperteil aus dem Bild ragt.
 *
 * Bewusst zwei verschiedene Sätze statt eines allgemeinen "nicht vollständig im Bild":
 * Der erste Fall heißt "es zählt gerade nicht", der zweite "es zählt, aber die Haltung
 * wird nicht bewertet". Wer beim zweiten zurücktritt, macht es schlimmer statt besser -
 * denn dann ragen womöglich die Arme raus, und es zählt gar nichts mehr.
 */
export const FRAMING_LABELS_DE: Record<FramingIssue, string> = {
  ARMS_OUT_OF_FRAME: 'Arme nicht im Bild – es wird gerade nicht gezählt',
  LOWER_BODY_OUT_OF_FRAME: 'Beine nicht im Bild – Haltung wird nicht bewertet',
};

export function framingLabelDe(framing: FramingIssue | null): string {
  return framing === null ? '' : FRAMING_LABELS_DE[framing];
}

/**
 * Was auf dem Bildschirm steht, wenn eine Bewegung **nicht** gezählt wurde.
 *
 * # Warum es das gibt (10.09.2026)
 *
 * Ein Verwurf war bisher stumm: Der Zähler blieb einfach stehen. Für jemanden, der eine
 * Wiederholung gemacht zu haben glaubt, ist das die schlechteste aller Rückmeldungen -
 * dieselbe Sackgasse wie beim Ruhighalten ("man kommt nie zu den Liegestützen"), nur eine
 * Ebene später. Wer nicht erfährt, *warum* nichts passiert, kann es auch nicht besser
 * machen.
 *
 * # Warum nicht für jeden Grund
 *
 * Hier stehen nur die Gründe, gegen die jemand etwas tun kann. `TRACKING_LOST` deckt der
 * HUD bereits mit "Pose nicht erkannt" ab, und `TOO_LONG` heißt "der Zähler hing" - das
 * ist unser Problem, nicht seins. Ein Hinweis, der keine Handlung nahelegt, ist Rauschen
 * und trainiert einen nur darauf, die Zeile zu übersehen.
 */
export const DISCARD_NOTICE_DE: Partial<Record<RepDiscardReason, string>> = {
  TOO_SHALLOW: 'Nicht gezählt – der Arm muss sich deutlich beugen',
  ARMS_NOT_SUPPORTING: 'Nicht gezählt – die Arme müssen dich tragen, Hände unter die Schultern',
  TOO_SHORT: 'Nicht gezählt – zu schnell für eine Wiederholung',
  NOT_A_PLANK: 'Nicht gezählt – Körper strecken und tiefer gehen',
};

export function discardNoticeDe(reason: RepDiscardReason): string | null {
  return DISCARD_NOTICE_DE[reason] ?? null;
}
