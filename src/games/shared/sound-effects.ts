// Frequencies are in Hz. Duration and delay are in seconds.
type Tone = (from: number, to: number, duration: number, delay?: number, volume?: number, wave?: OscillatorType) => void;
type Effect = (tone: Tone, intensity: number, noiseBurst: () => void) => void;

export const effects = {
  // Interface and rewards shared across games.
  confirm(tone) {
    tone(660, 660, 0.06);
    tone(990, 990, 0.09, 0.07);
  },
  pickup(tone) {
    tone(880, 1175, 0.045, 0, 0.08);
    tone(1568, 1760, 0.055, 0.035, 0.045, "triangle");
  },
  impact(tone) {
    tone(120, 45, 0.12, 0, 0.2, "triangle");
    tone(380, 100, 0.035, 0, 0.06);
  },
  bonus(tone) {
    tone(660, 880, 0.08);
    tone(1100, 1100, 0.12, 0.09);
    tone(1320, 1320, 0.1, 0.12, 0.045, "triangle");
  },
  clear(tone) {
    tone(440, 440, 0.07);
    tone(660, 660, 0.07, 0.08);
    tone(880, 990, 0.13, 0.16);
  },

  // SIX: the roll is a few quiet clacks, not a looping sound effect.
  // A D6 sounds heavier; a D20 rattles with more, lighter contacts.
  diceRoll(tone, intensity) {
    const count = 5 + Math.round(intensity * 4);
    for (let i = 0; i < count; i++) {
      const frequency = 210 + intensity * 150 + (i % 3) * 65;
      tone(frequency, 90 + intensity * 90, 0.027, i * 0.055, 0.09 - intensity * 0.02, "triangle");
    }
  },
  diceLand(tone) {
    tone(250, 70, 0.11, 0, 0.2, "triangle");
    tone(800, 220, 0.03, 0.015, 0.055);
  },

  // Number keypad and explosion.
  tap(tone) { tone(720, 480, 0.035); },
  delete(tone) { tone(300, 160, 0.045); },
  enter(tone) { tone(540, 760, 0.07); },
  leave(tone) {
    tone(440, 440, 0.06);
    tone(220, 180, 0.07, 0.07);
  },
  explode(tone, _intensity, noiseBurst) {
    tone(125, 28, 0.4, 0, 0.5, "triangle");
    noiseBurst();
  },
} satisfies Record<string, Effect>;

export type GameSound = keyof typeof effects;
