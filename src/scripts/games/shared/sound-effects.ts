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

  // Chicken movement and fox chase.
  hop(tone) { tone(350, 650, 0.065, 0, 0.07); },
  land(tone) { tone(130, 65, 0.05, 0, 0.055); },
  yip(tone) {
    tone(620, 1120, 0.09, 0, 0.07, "triangle");
    tone(910, 490, 0.16, 0.12, 0.065, "triangle");
  },
  bark(tone) {
    tone(380, 135, 0.09, 0, 0.055, "sawtooth");
    tone(290, 110, 0.07, 0.16, 0.035, "triangle");
  },
  alarm(tone) {
    tone(660, 480, 0.12);
    tone(780, 500, 0.12, 0.15);
  },
  pulse(tone, pressure) {
    tone(110, 60, 0.12, 0, 0.18, "triangle");
    tone(150, 80, 0.08, 0.14 - pressure * 0.055, 0.06 + pressure * 0.05, "triangle");
  },

  // Crane release, tower collapse and motor under load.
  drop(tone) { tone(220, 110, 0.06); },
  fall(tone) { tone(300, 35, 0.4, 0, 0.18); },
  strain(tone, load) {
    tone(95 - 35 * load, 65 - 25 * load, 0.2, 0, 0.045 + 0.045 * load, "sawtooth");
    if (load > 0.45) {
      tone(280 + 160 * load, 180, 0.09, 0.08, 0.035, "sawtooth");
      tone(204, 268, 0.075, 0.17, 0.035, "triangle");
      tone(211, 275, 0.075, 0.17, 0.03, "triangle");
    }
  },
} satisfies Record<string, Effect>;

export type GameSound = keyof typeof effects;
