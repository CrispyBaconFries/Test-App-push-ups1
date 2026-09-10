import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { RankFrame } from '../components/RankFrame';
import { FrameEffectLayer } from '../components/FrameEffectLayer';
import { Slider } from '../components/Slider';
import {
  DEFAULT_EFFECT_SETTINGS,
  FRAME_EFFECTS,
  SIZE_RANGE,
  describeSelection,
  frameEffectById,
  type EffectSettings,
  type FrameEffectId,
} from '../ranking/frameEffects';
import { resolveFrameGradient } from '../ranking/rankFrameStyle';
import { FRAME_THEME_IDS, frameThemeById, type FrameThemeId } from '../ranking/frameThemes';
import { RANK_TIERS, type RankTier } from '../ranking/ranks';
import { DEFAULT_AVATAR } from '../ranking/avatar';
import { colors } from '../theme/colors';
import { font, radius, space, PILL_RADIUS } from '../theme/layout';
import { fonts } from '../theme/typography';

/**
 * Effekt-Werkstatt: alle Rahmen-Effekte nebeneinander, mit Reglern.
 *
 * # Wofür
 *
 * Bis hierher lief jede optische Änderung so: Ich baue etwas, chris baut die App neu,
 * schaut es an, beschreibt in Worten was ihm nicht passt, ich rate, was gemeint ist.
 * Eine Runde kostet einen Build und einen Abend.
 *
 * Dieser Bildschirm dreht das um. chris sieht alle Varianten **gleichzeitig auf seinem
 * Handy**, schiebt an Stärke, Tempo und Größe, und liest unten eine Zeile ab wie
 * `Aura · Stärke 70 % · Tempo 40 % · Größe 96 px · Rang Challenger`. Die schickt er mir,
 * und ich setze genau das ein. Kein Raten mehr.
 *
 * # Warum nicht hinter `__DEV__`
 *
 * Aus demselben Grund wie der Kalibrier-Knopf auf dem Startbildschirm: chris hat nur
 * **eine** Installation, und das ist der Release-Build. Alles hinter `__DEV__` existiert
 * dort nicht (siehe CLAUDE.md). Ein Werkzeug, das genau die Person nicht erreicht, für
 * die es gebaut wurde, wäre sinnlos.
 */

type Props = NativeStackScreenProps<RootStackParamList, 'EffectWorkshop'>;

/** Einstellungen für die kleinen Kacheln in der Auswahl. */
const TILE_SIZE = 52;
const TILE_INTENSITY = 0.55;

export function EffectWorkshopScreen({ navigation }: Props) {
  const [effectId, setEffectId] = useState<FrameEffectId>('aura');
  const [settings, setSettings] = useState<EffectSettings>(DEFAULT_EFFECT_SETTINGS);
  const [tier, setTier] = useState<RankTier>('CHALLENGER');
  const [themeId, setThemeId] = useState<FrameThemeId>('default');

  const gradient = useMemo(() => resolveFrameGradient(tier, themeId), [tier, themeId]);
  const tierLabel = RANK_TIERS.find((t) => t.tier === tier)?.label ?? tier;
  const recipe = describeSelection(effectId, settings, tierLabel);

  const update = (patch: Partial<EffectSettings>) => setSettings((prev) => ({ ...prev, ...patch }));

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
            <Text style={styles.backText}>Zurück</Text>
          </Pressable>
        </View>

        <Text style={styles.title}>Effekt-Werkstatt</Text>
        <Text style={styles.subtitle}>
          Such dir aus, wie der Rahmen um den Avatar aussehen soll. Unten steht die Auswahl als eine
          Zeile – die schickst du mir, dann baue ich genau das ein.
        </Text>

        {/* Große Vorschau. Fest hohe Fläche, damit die Seite beim Größe-Regler nicht springt. */}
        <View style={styles.stage}>
          <View style={styles.stageInner}>
            <FrameEffectLayer effectId={effectId} settings={settings} colors={gradient} />
            <RankFrame
              avatar={DEFAULT_AVATAR}
              tier={tier}
              lp={2400}
              size={settings.size}
              frameThemeId={themeId}
            />
          </View>
        </View>

        <Text style={styles.effectName}>{frameEffectById(effectId).label}</Text>
        <Text style={styles.effectDescription}>{frameEffectById(effectId).description}</Text>

        <Section title="Effekt">
          <View style={styles.tileGrid}>
            {FRAME_EFFECTS.map((effect) => {
              const selected = effect.id === effectId;
              return (
                <Pressable
                  key={effect.id}
                  onPress={() => setEffectId(effect.id)}
                  style={({ pressed }) => [styles.tile, selected && styles.tileSelected, pressed && styles.pressed]}
                >
                  <View style={styles.tilePreview}>
                    {/* Die Kacheln laufen bewusst mit fester, mittlerer Stärke und kleiner
                        Größe: Sieben Effekte gleichzeitig in voller Stärke wären mehrere
                        Dutzend Animationen auf einmal. Zum Vergleichen reicht das, und die
                        große Vorschau oben zeigt ohnehin die echten Werte. */}
                    <FrameEffectLayer
                      effectId={effect.id}
                      settings={{ intensity: TILE_INTENSITY, speed: settings.speed, size: TILE_SIZE }}
                      colors={gradient}
                    />
                    <RankFrame
                      avatar={DEFAULT_AVATAR}
                      tier={tier}
                      lp={2400}
                      size={TILE_SIZE}
                      frameThemeId={themeId}
                    />
                  </View>
                  <Text style={[styles.tileLabel, selected && styles.tileLabelSelected]} numberOfLines={1}>
                    {effect.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section title="Regler">
          <Slider
            label="Stärke"
            value={settings.intensity}
            onChange={(intensity) => update({ intensity })}
            displayValue={`${Math.round(settings.intensity * 100)} %`}
            tint={gradient[0]}
          />
          <Slider
            label="Tempo"
            value={settings.speed}
            onChange={(speed) => update({ speed })}
            displayValue={`${Math.round(settings.speed * 100)} %`}
            tint={gradient[0]}
          />
          <Slider
            label="Größe"
            value={(settings.size - SIZE_RANGE.min) / (SIZE_RANGE.max - SIZE_RANGE.min)}
            onChange={(ratio) =>
              update({ size: Math.round(SIZE_RANGE.min + ratio * (SIZE_RANGE.max - SIZE_RANGE.min)) })
            }
            displayValue={`${Math.round(settings.size)} px`}
            tint={gradient[0]}
          />
          <Text style={styles.hint}>
            36 px ist die Größe in der Rangliste, 140 px die im Profil. Ein Effekt muss in beiden
            wirken – deshalb der Regler.
          </Text>
        </Section>

        <Section title="Rang">
          <View style={styles.chipRow}>
            {RANK_TIERS.map((definition) => (
              <Chip
                key={definition.tier}
                label={definition.label}
                selected={definition.tier === tier}
                color={definition.color}
                onPress={() => setTier(definition.tier)}
              />
            ))}
          </View>
        </Section>

        <Section title="Rahmen-Theme">
          <View style={styles.chipRow}>
            {FRAME_THEME_IDS.map((id) => (
              <Chip
                key={id}
                label={frameThemeById(id).label}
                selected={id === themeId}
                color={frameThemeById(id).gradientColors?.[0] ?? colors.primary}
                onPress={() => setThemeId(id)}
              />
            ))}
          </View>
        </Section>

        <View style={styles.recipeCard}>
          <Text style={styles.recipeLabel}>Deine Auswahl</Text>
          <Text style={styles.recipeText}>{recipe}</Text>
          <Pressable
            style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}
            onPress={() => Share.share({ message: recipe }).catch(() => undefined)}
          >
            <Ionicons name="share-outline" size={16} color="#0B0F14" />
            <Text style={styles.shareButtonText}>Auswahl teilen</Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}
          onPress={() => setSettings(DEFAULT_EFFECT_SETTINGS)}
        >
          <Text style={styles.resetButtonText}>Regler zurücksetzen</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Chip({
  label,
  selected,
  color,
  onPress,
}: {
  label: string;
  selected: boolean;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && { borderColor: color, backgroundColor: 'rgba(255,255,255,0.08)' },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.chipDot, { backgroundColor: color }]} />
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: space(20),
    paddingBottom: space(48),
  },
  headerRow: {
    flexDirection: 'row',
    marginBottom: space(12),
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space(6),
    paddingRight: space(12),
  },
  backText: {
    fontFamily: fonts.semiBold,
    fontSize: font(14),
    color: colors.textPrimary,
    marginLeft: space(2),
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: font(26),
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: font(14),
    color: colors.textSecondary,
    lineHeight: font(20),
    marginTop: space(6),
    marginBottom: space(18),
  },
  // Feste Höhe: Ohne sie würde die ganze Seite bei jeder Bewegung des Größe-Reglers
  // nach oben und unten springen.
  stage: {
    height: 240,
    borderRadius: radius(20),
    backgroundColor: '#05080B',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stageInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  effectName: {
    fontFamily: fonts.bold,
    fontSize: font(18),
    color: colors.textPrimary,
    marginTop: space(16),
  },
  effectDescription: {
    fontFamily: fonts.regular,
    fontSize: font(13),
    color: colors.textSecondary,
    lineHeight: font(19),
    marginTop: space(4),
  },
  section: {
    marginTop: space(24),
  },
  sectionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: font(12),
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: space(12),
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space(10),
  },
  tile: {
    width: 96,
    borderRadius: radius(16),
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: space(12),
    alignItems: 'center',
  },
  tileSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
  },
  tilePreview: {
    height: 78,
    width: 78,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontFamily: fonts.semiBold,
    fontSize: font(11),
    color: colors.textSecondary,
    marginTop: space(4),
  },
  tileLabelSelected: {
    color: colors.textPrimary,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: font(12),
    color: colors.textSecondary,
    lineHeight: font(17),
    marginTop: space(2),
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space(8),
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space(8),
    paddingHorizontal: space(12),
    borderRadius: PILL_RADIUS,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipDot: {
    width: 10,
    height: 10,
    borderRadius: radius(5),
    marginRight: space(8),
  },
  chipText: {
    fontFamily: fonts.semiBold,
    fontSize: font(12),
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.textPrimary,
  },
  recipeCard: {
    marginTop: space(28),
    backgroundColor: colors.surface,
    borderRadius: radius(18),
    borderWidth: 1,
    borderColor: colors.border,
    padding: space(16),
  },
  recipeLabel: {
    fontFamily: fonts.semiBold,
    fontSize: font(11),
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  recipeText: {
    fontFamily: fonts.semiBold,
    fontSize: font(14),
    color: colors.textPrimary,
    lineHeight: font(21),
    marginTop: space(8),
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(8),
    backgroundColor: colors.primary,
    borderRadius: radius(14),
    paddingVertical: space(12),
    marginTop: space(14),
  },
  shareButtonText: {
    fontFamily: fonts.bold,
    fontSize: font(14),
    color: '#0B0F14',
  },
  resetButton: {
    marginTop: space(14),
    alignItems: 'center',
    paddingVertical: space(12),
  },
  resetButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: font(13),
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.7,
  },
});
