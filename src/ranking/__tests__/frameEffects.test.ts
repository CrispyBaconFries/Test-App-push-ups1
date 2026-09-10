import {
  DEFAULT_EFFECT_SETTINGS,
  FRAME_EFFECTS,
  FRAME_EFFECT_IDS,
  SIZE_RANGE,
  cycleDurationMs,
  describeSelection,
  effectOpacity,
  frameEffectById,
  haloRadius,
  particleCount,
} from '../frameEffects';

describe('Effekt-Katalog', () => {
  it('hat zu jeder Kennung genau eine Beschreibung', () => {
    expect(FRAME_EFFECTS).toHaveLength(FRAME_EFFECT_IDS.length);
    for (const id of FRAME_EFFECT_IDS) {
      const definition = frameEffectById(id);
      expect(definition.id).toBe(id);
      expect(definition.label.length).toBeGreaterThan(0);
      expect(definition.description.length).toBeGreaterThan(0);
    }
  });

  it('führt "Ohne" als ersten Eintrag - das ist der Vergleichsmaßstab', () => {
    expect(FRAME_EFFECTS[0].id).toBe('none');
  });

  it('startet mit Einstellungen innerhalb der Regler-Grenzen', () => {
    expect(DEFAULT_EFFECT_SETTINGS.intensity).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_EFFECT_SETTINGS.intensity).toBeLessThanOrEqual(1);
    expect(DEFAULT_EFFECT_SETTINGS.speed).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_EFFECT_SETTINGS.speed).toBeLessThanOrEqual(1);
    expect(DEFAULT_EFFECT_SETTINGS.size).toBeGreaterThanOrEqual(SIZE_RANGE.min);
    expect(DEFAULT_EFFECT_SETTINGS.size).toBeLessThanOrEqual(SIZE_RANGE.max);
  });
});

describe('cycleDurationMs', () => {
  it('macht mehr Tempo zu kürzerer Dauer, nicht zu längerer', () => {
    // Der Regler läuft andersherum als die Zahl. Ein Regler, bei dem "nach rechts"
    // langsamer bedeutet, verwirrt beim Ausprobieren mehr, als die Umrechnung kostet.
    expect(cycleDurationMs(0, 3000, 800)).toBe(3000);
    expect(cycleDurationMs(1, 3000, 800)).toBe(800);
    expect(cycleDurationMs(0.5, 3000, 800)).toBe(1900);
  });

  it('bleibt auch bei Werten außerhalb von 0..1 in den Grenzen', () => {
    expect(cycleDurationMs(-3, 3000, 800)).toBe(3000);
    expect(cycleDurationMs(9, 3000, 800)).toBe(800);
  });
});

describe('effectOpacity', () => {
  it('lässt einen Effekt bei Stärke 0 noch sichtbar', () => {
    // Ein Effekt, der bei 0 komplett verschwindet, ist im Werkstatt-Bildschirm nicht von
    // "Ohne" zu unterscheiden - man weiß dann nicht, ob man ihn leise gestellt oder etwas
    // kaputt gemacht hat.
    expect(effectOpacity(0)).toBeGreaterThan(0);
    expect(effectOpacity(0)).toBeLessThan(0.3);
  });

  it('erreicht bei voller Stärke die volle Deckkraft', () => {
    expect(effectOpacity(1)).toBe(1);
  });

  it('wächst durchgehend mit der Stärke', () => {
    const steps = [0, 0.25, 0.5, 0.75, 1].map(effectOpacity);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]).toBeGreaterThan(steps[i - 1]);
    }
  });
});

describe('haloRadius', () => {
  it('wächst mit der Avatar-Größe', () => {
    // Derselbe Effekt muss neben einem 36-px-Ranglisteneintrag und einem 140-px-Profilbild
    // gleich wirken - dafür muss er mitwachsen statt eine feste Zahl zu sein.
    expect(haloRadius(140, 0.6)).toBeGreaterThan(haloRadius(36, 0.6));
  });

  it('wächst mit der Stärke', () => {
    expect(haloRadius(96, 1)).toBeGreaterThan(haloRadius(96, 0));
  });

  it('bleibt auch bei Stärke 0 sichtbar größer als null', () => {
    expect(haloRadius(96, 0)).toBeGreaterThan(0);
  });
});

describe('particleCount', () => {
  it('bleibt zwischen Unter- und Obergrenze', () => {
    expect(particleCount(0, 3, 9)).toBe(3);
    expect(particleCount(1, 3, 9)).toBe(9);
    expect(particleCount(0.5, 3, 9)).toBe(6);
  });

  it('deckelt auch bei absurder Stärke', () => {
    // Jedes Teilchen ist eine eigene laufende Animation - bei einem Bildschirm voller
    // Ranglisteneinträge summiert sich das.
    expect(particleCount(50, 3, 9)).toBe(9);
    expect(particleCount(-50, 3, 9)).toBe(3);
  });

  it('liefert immer eine ganze Zahl', () => {
    for (const intensity of [0.1, 0.33, 0.47, 0.86]) {
      expect(Number.isInteger(particleCount(intensity, 2, 7))).toBe(true);
    }
  });
});

describe('describeSelection', () => {
  it('fasst die Auswahl in einer Zeile zusammen, die sich vorlesen lässt', () => {
    // Das ist der eigentliche Zweck des Bildschirms: chris probiert aus, liest diese Zeile
    // ab und schickt sie mir.
    const line = describeSelection('aura', { intensity: 0.7, speed: 0.4, size: 96 }, 'Challenger');

    expect(line).toBe('Aura · Stärke 70 % · Tempo 40 % · Größe 96 px · Rang Challenger');
  });

  it('rundet krumme Reglerwerte auf ganze Prozent und Pixel', () => {
    const line = describeSelection('glow', { intensity: 0.333, speed: 0.666, size: 87.4 }, 'Gold');

    expect(line).toBe('Leuchten · Stärke 33 % · Tempo 67 % · Größe 87 px · Rang Gold');
  });
});
