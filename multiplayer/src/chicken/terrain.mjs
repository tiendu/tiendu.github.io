export function groundHeight(hills, x) {
  const hill = hills?.find(h => x > h.x && x < h.x + h.width);
  if (!hill) return 0;
  const phase = (x - hill.x) / hill.width;
  return hill.h * (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

// The first solid landing surface below a vertical dive, in world coordinates.
export function strikeSurface(track, x) {
  const ground = groundHeight(track.hills, x);
  let height = ground;
  for (const roof of track.roofs) {
    if (x >= roof.x && x <= roof.x + roof.width) height = Math.max(height, roof.h);
  }
  return { height, raised: height > ground };
}
