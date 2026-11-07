import { shape } from "./chicken-sprite-shape";

export { paintCoyote } from "./chicken-coyote";

const ink = "#382831", rust = "#b14a32", copper = "#e87b43", cream = "#ffe5bb";

function foxLeg(c: CanvasRenderingContext2D, hip: number, phase: number, far: boolean, tuck: number) {
  const reach = Math.cos(phase) * 8;
  const lift = Math.max(0, Math.sin(phase)) * 6 + tuck;
  const knee = hip + (hip < 0 ? 4 : -2);
  const toe = hip + reach;
  shape(c, far ? "#824336" : rust, [hip-3,-11,hip+3,-12,knee+2,-7-lift/3,
    toe+1,-3-lift,toe-2,-3-lift,knee-2,-6-lift/3]);
  shape(c, far ? "#493238" : ink, [knee,-6-lift/3,toe+1,-4-lift,toe+4,-2-lift,
    toe+4,-lift,toe-2,-lift,toe-2,-3-lift]);
}

export function paintFox(c: CanvasRenderingContext2D, x: number, floor: number,
  frame: number, turn = 0, hop = 0) {
  const facing = Math.cos(turn * Math.PI);
  const stride = frame * Math.PI / 2 * (facing < 0 ? -1 : 1);
  c.save();
  c.translate(x, floor);
  if (Math.abs(facing) < 0.45) {
    c.save();
    c.globalAlpha *= Math.min(1, (0.45 - Math.abs(facing)) * 8);
    shape(c, ink, [-7,-18,5,-18,7,-11,4,-6,5,0,1,0,0,-7,-2,0,-6,0,-4,-8,-7,-11]);
    shape(c, rust, [-6,-21,-2,-18,2,-18,6,-21,5,-11,3,-7,4,0,1,0,0,-7,-2,0,-5,0,-4,-9]);
    shape(c, cream, [-4,-14,0,-12,4,-14,2,-10,0,-8]);
    shape(c, ink, [-7,-23,-2,-19,2,-19,7,-23,6,-15,3,-12,0,-10,-4,-13,-6,-15]);
    shape(c, copper, [-6,-21,-2,-17,2,-17,6,-21,4,-15,0,-12,-4,-15]);
    c.fillStyle = cream; c.fillRect(-4,-15,2,1); c.fillRect(2,-15,2,1);
    c.restore();
  }
  c.scale(facing, 1);
  foxLeg(c, -8, stride + 0.7, true, hop / 2);
  foxLeg(c, 6, stride + 3.8, true, hop / 3);
  c.save();
  c.translate(0, Math.sin(stride) - hop * 0.18);
  c.save();
  c.translate(-9, -11);
  c.rotate(0.18 * Math.sin(stride - 0.6) + 0.3 * Math.sin(turn * Math.PI));
  shape(c, ink, [2,0,-4,-3,-10,-4,-17,-3,-23,-6,-22,-1,-19,3,-11,6,-4,5,2,2]);
  shape(c, copper, [0,0,-7,-2,-16,-2,-20,-3,-17,1,-10,4,-5,4]);
  shape(c, cream, [-23,-6,-16,-3,-13,-2,-15,-1,-13,2,-19,1]);
  c.restore();
  shape(c, ink, [-13,-8,-11,-14,-5,-16,4,-15,8,-17,8,-24,13,-20,
    17,-23,16,-17,18,-15,23,-13,22,-10,16,-9,12,-6,6,-8,-4,-8,-10,-5]);
  shape(c, copper, [-12,-9,-9,-14,-3,-15,5,-14,10,-18,10,-21,14,-18,
    16,-20,15,-16,18,-14,21,-13,17,-11,10,-10,6,-9,-3,-10,-10,-7]);
  shape(c, cream, [7,-12,11,-14,14,-12,20,-12,17,-10,13,-9,10,-6,10,-9,6,-8]);
  c.fillStyle = ink;
  c.fillRect(14,-15,2,1); c.fillRect(20,-13,3,2);
  c.restore();
  foxLeg(c, -8, stride, false, hop / 2);
  foxLeg(c, 6, stride + Math.PI, false, hop / 3);
  c.restore();
}

const flightInk = "#352d38", mantle = "#705044", bronze = "#aa7750", ivory = "#fff0ca";
function eagleHead(c: CanvasRenderingContext2D) {
  shape(c, flightInk, [1,-7,4,-10,10,-10,13,-7,17,-6,16,-2,13,-3,8,-2,3,1,-1,-1]);
  shape(c, ivory, [1,-6,5,-9,10,-9,12,-6,10,-3,6,-3,2,0,3,-3,-1,-2]);
  shape(c, "#efb54f", [11,-6,15,-6,17,-5,16,-2,15,-4,11,-4]);
  c.fillStyle = flightInk; c.fillRect(9,-7,3,1);
}

function wing(c: CanvasRenderingContext2D, stroke: number, tuck: number, far: boolean) {
  c.save();
  c.translate(far ? 2 : -2, -2);
  c.scale(far ? 0.79 : 1, far ? 0.87 : 1);
  c.rotate(tuck * -0.46);
  const wrist = -10 + stroke * 2;
  const height = -12 + stroke * 13 + tuck * 8;
  const tip = height - 6 + stroke * 9;
  const span = -30 + tuck * 14;
  shape(c, far ? flightInk : mantle, [4,1,1,-5,wrist,height,span+4,tip-2,
    span,tip,span+6,tip+3,span+1,tip+3,span+7,tip+6,span+3,tip+7,span+12,tip+9,
    wrist-2,height+9,-4,5]);
  shape(c, far ? "#745846" : bronze, [2,-3,wrist,height+1,span+5,tip,
    wrist-3,height+4,wrist-5,height+5,-4,0]);
  if (!far) shape(c, "#d0a276", [0,-3,wrist,height+1,wrist-4,height+1,wrist,height-1]);
  c.restore();
}

export function paintEagle(c: CanvasRenderingContext2D, x: number, y: number,
  fold: number, climb: number, time: number) {
  const flare = Math.min(1, climb / 0.22);
  const tuck = fold * (1 - flare);
  const stroke = (1 - flare) * Math.sin(time * 5) * 0.52 + flare * Math.sin(climb * 10);
  c.save();
  c.translate(x, y);
  c.rotate(tuck * 0.86 - flare * 0.32);
  c.save();
  c.scale(-0.72, 1);
  wing(c, stroke - 0.22, tuck, true);
  c.restore();
  shape(c, flightInk, [-5,-1,-11,0,-21,5,-19,7,-22,9,-11,8,-3,4]);
  shape(c, ivory, [-10,1,-19,5,-16,5,-19,7,-11,6,-6,3]);
  shape(c, flightInk, [-12,1,-9,-4,0,-6,8,-5,10,-1,6,4,-1,6,-8,5]);
  shape(c, mantle, [-10,1,-7,-3,1,-5,7,-3,5,2,-2,5,-7,4]);
  const grip = 2 + 3 * tuck + flare;
  for (const foot of [-3, 2]) {
    shape(c, "#efb54f", [foot,3,foot+2,3,foot+1,grip+3,foot+4,grip+3,
      foot+3,grip+5,foot+2,grip+4,foot-2,grip+4]);
  }
  wing(c, stroke, tuck, false);
  eagleHead(c);
  c.restore();
}

export function paintPerchedEagle(c: CanvasRenderingContext2D, x: number, rail: number, time = 0) {
  c.save();
  c.translate(x, rail);
  shape(c, flightInk, [-6,-13,-1,-16,6,-14,7,-7,3,-3,-2,-3,-9,0,-7,-5,-12,-2]);
  shape(c, mantle, [-5,-13,1,-15,5,-12,3,-6,-3,-5,-9,-2]);
  shape(c, bronze, [-4,-13,1,-14,-1,-10,-7,-6]);
  c.fillStyle = "#e7b354"; c.fillRect(-3,-3,2,3); c.fillRect(1,-3,3,3);
  c.translate(-2, -9 + 0.65 * Math.sin(time * 3));
  eagleHead(c);
  c.restore();
}
