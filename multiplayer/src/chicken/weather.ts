export type WeatherPhase = "clear" | "cloudy" | "rain" | "clearing";

export interface RunWeatherState {
  phase: WeatherPhase;
  phaseProgress: number;
  cycleIndex: number;
  rainIntensity: number;
  cloudFactor: number;
  wetness: number;
  /** Signed value: negative is a headwind, positive is a tailwind. */
  wind: number;
  windStrength: number;
  speedMultiplier: number;
}

interface WeatherDurations {
  clear: number;
  cloudy: number;
  rain: number;
  clearing: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function hashUnit(index: number, salt: number): number {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function weatherDurationsForCycle(cycleIndex: number): WeatherDurations {
  const safeIndex = Math.max(0, Math.floor(cycleIndex));
  return {
    clear: 9 + hashUnit(safeIndex, 1) * 8,
    cloudy: 5 + hashUnit(safeIndex, 2) * 3,
    rain: 13 + hashUnit(safeIndex, 3) * 8,
    clearing: 6 + hashUnit(safeIndex, 4) * 4,
  };
}

export function weatherCycleDuration(cycleIndex: number): number {
  const duration = weatherDurationsForCycle(cycleIndex);
  return duration.clear + duration.cloudy + duration.rain + duration.clearing;
}

function windForElapsed(
  elapsedSeconds: number,
  cycleIndex: number,
  phase: WeatherPhase,
  rainIntensity: number,
): number {
  const broad = Math.sin(elapsedSeconds * 0.17 + cycleIndex * 1.31) * 0.54;
  const gust = Math.sin(elapsedSeconds * 0.47 + 0.9) * 0.31;
  const phaseScale = phase === "rain" ? 1 : phase === "cloudy" ? 0.78 : 0.55;
  return clamp((broad + gust) * phaseScale + rainIntensity * 0.12, -1, 1);
}

export function weatherStateForElapsed(elapsedSeconds: number): RunWeatherState {
  const elapsed = Math.max(0, elapsedSeconds);
  let remaining = elapsed;
  let cycleIndex = 0;
  let durations = weatherDurationsForCycle(cycleIndex);
  let total = weatherCycleDuration(cycleIndex);

  while (remaining >= total) {
    remaining -= total;
    cycleIndex += 1;
    durations = weatherDurationsForCycle(cycleIndex);
    total = weatherCycleDuration(cycleIndex);
  }

  let phase: WeatherPhase;
  let phaseProgress: number;
  let rainIntensity = 0;
  let cloudFactor = 0.18;
  let wetness = 0;

  if (remaining < durations.clear) {
    phase = "clear";
    phaseProgress = clamp01(remaining / durations.clear);
    cloudFactor = 0.12 + Math.sin(phaseProgress * Math.PI) * 0.12;
    wetness = cycleIndex > 0
      ? (1 - smoothstep(phaseProgress / 0.28)) * 0.38
      : 0;
  } else {
    remaining -= durations.clear;
    if (remaining < durations.cloudy) {
      phase = "cloudy";
      phaseProgress = clamp01(remaining / durations.cloudy);
      cloudFactor = 0.3 + smoothstep(phaseProgress) * 0.7;
      wetness = smoothstep((phaseProgress - 0.72) / 0.28) * 0.15;
    } else {
      remaining -= durations.cloudy;
      if (remaining < durations.rain) {
        phase = "rain";
        phaseProgress = clamp01(remaining / durations.rain);
        rainIntensity = smoothstep(phaseProgress / 0.16);
        cloudFactor = 1;
        wetness = 0.15 + rainIntensity * 0.85;
      } else {
        remaining -= durations.rain;
        phase = "clearing";
        phaseProgress = clamp01(remaining / durations.clearing);
        rainIntensity = 1 - smoothstep(phaseProgress);
        cloudFactor = 1 - smoothstep(phaseProgress) * 0.72;
        wetness = 1 - smoothstep(phaseProgress) * 0.62;
      }
    }
  }

  const wind = windForElapsed(elapsed, cycleIndex, phase, rainIntensity);
  const windStrength = clamp01(Math.abs(wind) * 0.82 + rainIntensity * 0.28);
  const speedMultiplier = clamp(1 + wind * 0.042 - rainIntensity * 0.012, 0.94, 1.055);

  return {
    phase,
    phaseProgress,
    cycleIndex,
    rainIntensity,
    cloudFactor,
    wetness,
    wind,
    windStrength,
    speedMultiplier,
  };
}

export function courseGapMultiplierForWeather(weather: RunWeatherState): number {
  return 1 + weather.rainIntensity * 0.1 + weather.windStrength * 0.035;
}

export function mudPatternWeightMultiplier(weather: RunWeatherState): number {
  return 1 + weather.rainIntensity * 2.25 + weather.wetness * 0.45;
}

export function logPatternWeightMultiplier(weather: RunWeatherState): number {
  return 0.72 + weather.rainIntensity * 2.1 + weather.windStrength * 0.35;
}

export function foxWeatherMultiplier(weather: RunWeatherState): number {
  return clamp(1 - weather.rainIntensity * 0.22 - Math.max(0, -weather.wind) * 0.04, 0.72, 1.04);
}
