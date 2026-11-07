import { shape } from "./chicken-sprite-shape";

// The legs are keyed by distance. During contact each paw sweeps backwards by
// the distance the body advances, then folds under the belly on recovery.
type LegPose = readonly [number, number, number, number, number, number];
const hind: readonly LegPose[] = [
  [5, -11, -7, -8, -15, -6], [6, -12, -3, -9, -6, -9],
  [8, -11, 4, -7, 6, -5], [9, -10, 7, -5, 11, 0],
  [6, -9, 0, -4, 5, 0], [3, -10, -7, -4, -1, 0],
  [0, -12, -11, -5, -7, 0], [-3, -13, -13, -7, -13, -1],
];
const fore: readonly LegPose[] = [
  [-3, -12, 5, -5, 10, 0], [-4, -10, 1, -4, 4, 0],
  [-5, -10, -4, -4, -2, 0], [-6, -12, -9, -5, -8, 0],
  [-6, -12, -10, -9, -12, -5], [-5, -12, 2, -11, -2, -8],
  [-2, -14, 9, -11, 7, -8], [2, -13, 11, -7, 14, -3],
];

const ink = "#332c30", saddle = "#594f52", ochre = "#ac8561", buff = "#d4b18a";

let coat: HTMLCanvasElement | undefined;
function body() {
  if (coat) return coat;
  coat = document.createElement("canvas");
  coat.width = 64;
  coat.height = 40;
  const c = coat.getContext("2d")!;
  c.translate(25, 34);
  // Sloping croup, raised hackles and forward-reaching muzzle.
  shape(c, ink, [-20,-7,-18,-15,-14,-19,-5,-20,2,-22,7,-26,8,-23,
    12,-25,10,-33,17,-27,20,-32,22,-24,24,-21,24,-19,32,-16,33,-13,
    28,-12,24,-12,25,-10,18,-9,13,-6,9,-4,1,-8,-7,-8,-13,-4,-18,-4]);
  shape(c, ochre, [-18,-10,-15,-17,-6,-18,3,-20,9,-24,14,-23,16,-25,
    20,-27,21,-22,24,-19,30,-16,24,-14,17,-14,13,-9,8,-6,0,-10,-8,-9,-15,-5]);
  shape(c, saddle, [-17,-12,-13,-17,-4,-18,5,-22,8,-23,6,-20,12,-22,
    9,-18,13,-19,8,-15,4,-16,0,-14,-4,-15,-8,-14,-11,-15]);
  shape(c, buff, [10,-14,15,-17,20,-17,23,-15,29,-15,23,-13,17,-13,
    19,-12,14,-10,12,-8,13,-12,8,-9]);
  shape(c, "#775751", [12,-30,16,-26,15,-24]);
  shape(c, ink, [16,-21,23,-19,20,-17,16,-18]);
  c.fillStyle = "#ffcd63"; c.fillRect(19,-19,2,1);
  c.fillStyle = ink; c.fillRect(29,-16,4,2);
  c.fillStyle = "#f6e6c6"; c.fillRect(24,-13,2,2);
  return coat;
}

function leg(c: CanvasRenderingContext2D, poses: readonly LegPose[], phase: number,
  hip: number, back: number, far: boolean, leap: number) {
  const frame = Math.floor(phase);
  const a = poses[frame % 8], b = poses[(frame + 1) % 8];
  const mix = phase - frame;
  const at = (i: number) => a[i] + (b[i] - a[i]) * mix;
  const knee = hip + at(0), ky = at(1) + back * 0.45;
  const wrist = hip + at(2), wy = at(3);
  const extension = poses === fore ? leap : -leap;
  const paw = hip + at(4) + extension;
  const py = at(5) - leap * (poses === hind ? 0.95 : 0.45);
  const thigh = poses === hind ? 5 : 3;
  const top = -17 + back;
  shape(c, far ? saddle : ochre, [hip-thigh,top-1,hip+thigh,top-2,knee+2,ky,
    wrist+1.5,wy+1,wrist-1.5,wy,knee-2,ky+1,hip-thigh,top+4]);
  shape(c, far ? "#716268" : buff, [knee-1,ky,knee+2,ky,wrist+1.5,wy,paw+1,py-2,
    paw-1,py-1,wrist-1.5,wy+1]);
  shape(c, ink, [paw-1.5,py-2,paw+1,py-3,paw+4,py-1,paw+4,py,paw-2,py]);
}

export function paintCoyote(c: CanvasRenderingContext2D, x: number, floor: number,
  turn: number, distance: number, hop: number) {
  const facing = Math.cos(turn * Math.PI);
  const travel = facing < 0 ? -distance : distance;
  const phase = ((travel / 6) % 8 + 8) % 8;
  const angle = phase * Math.PI / 4;
  const back = 1.6 * Math.sin(angle - 0.4);
  c.save();
  c.translate(x, floor);
  if (Math.abs(facing) < 0.55) {
    c.save();
    c.globalAlpha *= Math.min(1, (0.55 - Math.abs(facing)) * 7);
    shape(c, ink, [-9,-24,-6,-26,4,-27,9,-22,10,-14,7,-9,8,-2,9,0,4,0,2,-9,-2,-9,-4,0,-9,0,-7,-10,-10,-17]);
    shape(c, ochre, [-8,-23,6,-24,8,-18,5,-12,1,-9,-4,-12,-8,-17]);
    shape(c, buff, [-6,-20,6,-20,4,-16,1,-13,0,-11,-2,-15]);
    shape(c, ink, [-8,-33,-2,-28,3,-28,8,-33,7,-25,9,-21,5,-19,2,-15,-2,-15,-5,-19,-9,-21,-6,-25]);
    shape(c, ochre, [-6,-29,-2,-26,3,-26,6,-29,5,-25,7,-22,3,-21,1,-17,-1,-17,-4,-21,-7,-22,-4,-24]);
    c.fillStyle = "#ffcd63"; c.fillRect(-5,-23,2,1); c.fillRect(3,-23,2,1);
    c.fillStyle = ink; c.fillRect(-2,-19,4,2);
    c.restore();
  }
  c.scale(facing, 1);
  leg(c, hind, phase + 0.95, -13, back, true, hop);
  leg(c, fore, phase + 0.85, 7, back, true, hop);
  c.save();
  c.translate(-15, -13 + back);
  c.rotate(0.12 * Math.sin(angle - 0.65) - 0.12 * hop / 7);
  shape(c, ink, [2,-3,-4,-3,-11,0,-20,5,-24,5,-20,10,-14,10,-6,7,2,2]);
  shape(c, "#8d7665", [1,-2,-4,-2,-12,2,-19,5,-14,7,-7,6,1,1]);
  c.restore();
  c.save();
  c.translate(0, back);
  c.rotate(0.045 * Math.cos(angle) - hop * 0.018);
  c.imageSmoothingEnabled = false;
  c.drawImage(body(), -25, -34);
  c.restore();
  leg(c, hind, phase, -11, back, false, hop);
  leg(c, fore, phase, 10, back, false, hop);
  c.restore();
}
