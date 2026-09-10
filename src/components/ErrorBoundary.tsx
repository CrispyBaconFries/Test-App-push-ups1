import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { recordError, shareErrorLog } from '../diagnostics/errorLog';
import { colors } from '../theme/colors';
import { font, radius, space } from '../theme/layout';
import { fonts } from '../theme/typography';

/**
 * Fängt Fehler beim Zeichnen ab und zeigt statt eines weißen Bildschirms etwas, mit dem
 * sich arbeiten lässt.
 *
 * # Warum
 *
 * Ohne Fehlergrenze reißt ein einziger Fehler in irgendeiner Komponente den kompletten
 * Baum ab — React hängt dann bewusst nichts mehr ein, und übrig bleibt eine leere Fläche.
 * Für chris heißt das: weißer Bildschirm, keine Meldung, kein Log (Release-Build, kein
 * Metro, kein Logcat — siehe CLAUDE.md). Was bei mir ankommt, ist „die App geht nicht",
 * und die Suche beginnt bei null.
 *
 * Mit Fehlergrenze steht dort stattdessen, **was** passiert ist, es gibt einen Knopf, der
 * den Bericht teilt, und einen, der es noch einmal versucht. Aus einem toten Abend wird
 * eine Nachricht, mit der ich sofort etwas anfangen kann.
 *
 * # Was sie NICHT abfängt
 *
 * Nur Fehler beim Zeichnen. Ein Fehler in einem Knopf-Handler, in einer Zeitgeber-
 * Rückrufaktion oder im Kamera-Frame-Pfad geht an ihr vorbei — dafür gibt es
 * `installGlobalErrorHandler()` (siehe `src/diagnostics/globalErrorHandler.ts`). Erst
 * beide zusammen decken das Feld ab.
 *
 * # Warum eine Klasse
 *
 * `componentDidCatch` und `getDerivedStateFromError` gibt es nur an Klassenkomponenten.
 * Das ist die einzige Stelle im Projekt, an der das gilt — und der Grund steht hier, damit
 * niemand sie „modernisiert".
 */

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
  /** Zählt hoch, wenn „Nochmal versuchen" gedrückt wird - erzwingt einen frischen Unterbaum. */
  attempt: number;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Der Komponentenpfad aus React sagt oft mehr als die Aufrufliste - er nennt den
    // Bildschirm, in dem es passiert ist, statt nur die Hilfsfunktion ganz unten.
    const where = info.componentStack?.trim().split('\n')[0]?.trim() ?? 'Anzeige';
    void recordError(error, `Anzeige · ${where}`, { fatal: true });
  }

  private retry = () => {
    // `attempt` als Schlüssel des Unterbaums: Ohne das würde React den kaputten Baum
    // wiederverwenden, und derselbe Fehler käme im selben Moment zurück.
    this.setState((prev) => ({ error: null, attempt: prev.attempt + 1 }));
  };

  render() {
    const { error } = this.state;
    if (!error) {
      return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
    }

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Da ist etwas schiefgelaufen</Text>
          <Text style={styles.subtitle}>
            Die App konnte diesen Bildschirm nicht anzeigen. Dein Trainingsverlauf ist davon nicht
            betroffen – gespeichert ist gespeichert.
          </Text>

          <View style={styles.errorCard}>
            <Text style={styles.errorLabel}>Fehlermeldung</Text>
            <Text style={styles.errorMessage}>{error.message || 'Unbekannter Fehler'}</Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            onPress={() => {
              shareErrorLog().catch(() => undefined);
            }}
          >
            <Text style={styles.primaryButtonText}>Fehlerbericht teilen</Text>
          </Pressable>
          <Text style={styles.hint}>
            Schick mir den Bericht – da steht drin, wo es geknallt ist. Ohne ihn kann ich nur raten.
            Persönliche Daten sind nicht enthalten, und du siehst vor dem Abschicken, was drinsteht.
          </Text>

          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            onPress={this.retry}
          >
            <Text style={styles.secondaryButtonText}>Nochmal versuchen</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: space(24),
    paddingTop: space(60),
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: font(24),
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: font(14),
    color: colors.textSecondary,
    lineHeight: font(21),
    marginTop: space(8),
  },
  errorCard: {
    marginTop: space(24),
    backgroundColor: colors.surface,
    borderRadius: radius(16),
    borderWidth: 1,
    borderColor: colors.border,
    padding: space(16),
  },
  errorLabel: {
    fontFamily: fonts.semiBold,
    fontSize: font(11),
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  errorMessage: {
    fontFamily: fonts.regular,
    fontSize: font(13),
    color: colors.danger,
    marginTop: space(8),
    lineHeight: font(19),
  },
  primaryButton: {
    marginTop: space(24),
    backgroundColor: colors.primary,
    borderRadius: radius(16),
    paddingVertical: space(14),
    alignItems: 'center',
  },
  primaryButtonText: {
    fontFamily: fonts.bold,
    fontSize: font(15),
    color: '#0B0F14',
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: font(12),
    color: colors.textSecondary,
    lineHeight: font(18),
    marginTop: space(10),
  },
  secondaryButton: {
    marginTop: space(20),
    alignItems: 'center',
    paddingVertical: space(12),
  },
  secondaryButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: font(14),
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.7,
  },
});
