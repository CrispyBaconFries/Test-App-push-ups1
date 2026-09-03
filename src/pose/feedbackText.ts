import type { FormIssue, LiveFeedback } from './formAnalysis';

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
