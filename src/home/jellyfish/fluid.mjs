import { clamp, invLerp, lerp, smoothstep, TAU } from "./math.mjs";

// A small always-on eddy field keeps calm water alive. It is deliberately
// weaker and slower than the weather/current field, and spatially coherent so
// nearby tissue feels related motion instead of independent noise.
export function ambientEddyAt(nx, ny, time) {
  const slow = time * 0.11;
  return {
    x:
      Math.sin(ny * 5.1 + slow * 0.83) * 1.35
      + Math.sin((nx + ny) * 3.7 - slow * 0.47) * 0.75,
    y:
      Math.cos(nx * 4.3 - slow * 0.61) * 0.90
      + Math.sin(nx * 2.6 - ny * 3.1 + slow * 0.39) * 0.55,
  };
}

// Every appendage samples the same water, but tissue determines how much of it
// becomes motion. Thin strands react most at their tips. Oral arms keep heavier
// roots and a lively middle while long arms ease only slightly at the far tip.
export function fluidSensitivityFor(item, along) {
  const t = clamp(along, 0, 1);
  const forceScale = item?.forceScale ?? (item?.arm ? 0.76 : 1);

  if (item?.arm) {
    const lengthBias = clamp(item.lengthBias ?? 0, 0, 1);
    const distalScale = forceScale * lerp(1.12, 1.04, lengthBias);
    return lerp(
      0.15,
      distalScale,
      Math.pow(t, lerp(0.96, 1.12, lengthBias)),
    );
  }

  return lerp(0.20, forceScale, Math.pow(t, 1.40));
}

// Broad oral-arm movement should remain alive even when the macro current is
// calm. The envelope keeps both attachment and tip quiet while a very slow wave
// travels through the body of the sheet.
export function oralArmBillowAt(item, time, along, anatomyScale = 1) {
  if (!item?.arm) return 0;
  const t = clamp(along, 0, 1);
  const envelope = Math.sin(Math.PI * t);
  const lengthBias = clamp(item.lengthBias ?? 0, 0, 1);
  const amplitude = lerp(4.5, 7.0, lengthBias) * anatomyScale;
  const primary = Math.sin(time * 0.18 + (item.phase ?? 0) + t * 1.35);
  const secondary =
    Math.sin(time * 0.11 + (item.memoryPhase ?? 0) - t * 2.1) * 0.32;
  return amplitude * envelope * (primary + secondary);
}

// Ribbon faces should never look frozen just because the centerline is briefly
// still. This tiny roll is much weaker than chain-driven motion and only keeps
// the membrane breathing between larger fluid events.
export function ribbonSurfaceBreathAt(item, time, along) {
  const t = clamp(along, 0, 1);
  const body = smoothstep(invLerp(0.08, 0.90, t));
  const tipFade = 1 - smoothstep(invLerp(0.92, 1, t)) * 0.55;
  const lengthBias = clamp(item?.lengthBias ?? 0, 0, 1);
  const amplitude = lerp(0.065, 0.105, lengthBias);
  return (
    Math.sin(time * 0.19 + (item?.phase ?? 0) + t * 2.45)
    * amplitude
    * body
    * tipFade
  );
}

// The local water field is still an acceleration proxy. Prefer real
// simulated flow when it is active; retain a small elastic motion in calm water.
export function proceduralMotionWeight(flow) {
  const activity = smoothstep(Math.hypot(flow.x, flow.y) / 10);
  const wake = clamp(flow.wakeWeight ?? 0, 0, 1);
  return (1 - 0.20 * activity) * (1 - 0.30 * wake);
}

// Passive shape bias remains separate from local water acceleration.
export function appendageShapeForce(item, time, along, anatomyScale, localFlow, motion) {
  const armLengthBias = item.arm ? (item.lengthBias ?? 0) : 0;
  const loosen = along * along;
  const waterDominance = item.arm ? smoothstep(Math.abs(localFlow.x) / 4.5) : 0;
  const shapeWeight = 1 - 0.78 * waterDominance;

  // Water is the primary driver; retain quiet-water motion and elasticity.
  const distalEase = item.arm
    ? 1 - armLengthBias * smoothstep(invLerp(0.72, 1, along)) * 0.08
    : 1;
  const wake = Math.sin(
    time * (item.arm ? 0.44 : 0.68)
      + item.phase
      + along * (item.arm ? 3.4 : 5.6),
  ) * (item.arm ? 4.0 : 4.7) * loosen * anatomyScale * distalEase
    * 0.80 * motion;
  const billow = oralArmBillowAt(item, time, along, anatomyScale) * 0.90 * motion;

  // Thin tentacles keep a stable broad memory curve. Oral arms instead carry
  // that memory slowly downstream, so their whole body billows rather than
  // holding one leaf-like pose indefinitely.
  const memoryPhase = item.memoryPhase + (item.arm ? time * 0.20 : 0);
  const memory = Math.sin(memoryPhase + along * item.memoryWaves * TAU)
    * item.memoryStrength
    * smoothstep(along)
    * (0.30 + along * 0.50)
    * (item.arm ? lerp(1, 0.96, armLengthBias * smoothstep(along)) : 1);
  const expressiveShape = item.expressiveTentacle
    ? Math.sin((along - 0.18) * Math.PI * 1.55 + item.memoryPhase * 0.18)
      * item.expressiveShape * Math.sin(Math.PI * along)
    : 0;
  const tip = smoothstep(clamp((along - 0.72) / 0.28, 0, 1));
  const tipHook = item.tipHook * tip * tip;
  const curl = item.curl * Math.sin(along * Math.PI) * (item.arm ? 4.3 : 2.2) * anatomyScale;
  return (wake + billow + memory + expressiveShape + tipHook + curl) * shapeWeight;
}
