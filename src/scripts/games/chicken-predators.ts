const fur: Record<string, string> = {
  d: "#38292f", f: "#bd5136", r: "#ed8745", w: "#fff0cd", e: "#ffe399",
  b: "#6e4739", g: "#dea34f",
};

// Sprites face right. The origin is the centre of the animal.
function pixels(ctx: CanvasRenderingContext2D, rows: string[], x: number, y: number) {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const color = fur[row[i]];
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(x + i * 2, y + j * 2, 2, 2);
      }
    }
  });
}

const foxBody = [
  "            d  d",
  "           drddrd",
  "          drrrrrd",
  "  dfffffffrrrrred",
  " drrrrrrrrrrrrwwwdd",
  " fffffrrrrrrwwwwwd",
  " dffffrrrffwwww",
  "   dffffffdd",
];
const tail = ["ww", "wwwrr", " wrrrrff", "   rfffff", "     dffff"];
const eagleBody = ["    dwww", "  dbbwwwgg", " dbbbwwd g", "dbbbbbd", "dbbbbd", "dd  gg"];

export function paintFox(ctx: CanvasRenderingContext2D, x: number, floor: number,
  frame: number, turn = 0) {
  const angle = frame * Math.PI * 0.5;
  const gather = Math.cos(angle);
  const brace = Math.sin(turn * Math.PI);
  ctx.save();
  ctx.translate(x, floor);
  // Foreshorten through the pivot so all four paws stay visible during the turn.
  const facing = Math.cos(turn * Math.PI);
  if (Math.abs(facing) < 0.35) {
    // Front view bridges the profile silhouettes while the fox plants its paws.
    pixels(ctx, ["d   d", "rdddr", "rrerr", " wrw ", "  d  "], -5, -16);
  }
  ctx.scale(facing, 1);
  const back = -14 - 1.5 * Math.sin(angle) + brace * 2;
  for (let leg = 0; leg < 4; leg++) {
    const rear = leg < 2;
    const hip = rear ? -7 : 7;
    const phase = angle + (leg % 2) * 0.7 + (rear ? 0 : Math.PI);
    const reach = Math.cos(phase) * (7 - 4 * brace);
    const toe = hip + reach;
    const pawY = -2 - Math.max(0, Math.sin(phase)) * 4;
    ctx.fillStyle = leg % 2 ? fur.f : fur.b;
    ctx.fillRect(hip + reach * 0.25, back + 8, 4, 5);
    ctx.fillRect(Math.min(toe, hip + reach * 0.25), pawY - 3, 3 + Math.abs(reach * 0.75), 3);
    ctx.fillStyle = fur.d;
    ctx.fillRect(toe, pawY, 5, 2);
  }
  ctx.save();
  ctx.translate(-7, back + 6);
  ctx.rotate(0.14 * Math.sin(angle - 0.7) + brace * 0.35);
  pixels(ctx, tail, -20, -9);
  ctx.restore();
  ctx.translate(0, back);
  ctx.scale(1 + gather * 0.045, 1 - gather * 0.05);
  pixels(ctx, foxBody, -13, -7);
  ctx.restore();
}

export function paintEagle(ctx: CanvasRenderingContext2D, x: number, y: number,
  fold: number, climb: number, time: number) {
  const flare = Math.min(1, climb / 0.18);
  const tucked = fold * (1 - flare);
  const cruising = 0.34 * Math.sin(time * 5);
  const stroke = climb > 0 ? cruising * (1 - flare) + flare * Math.cos(climb * 8.5) : cruising;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tucked * 0.72 - flare * 0.30);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side, 1);
    for (let feather = 0; feather < 5; feather++) {
      const span = 4 + feather * (4 - tucked * 2.7);
      const tip = -4 - (feather + 1) * (stroke * 2 + tucked * 1.8);
      ctx.fillStyle = fur.d;
      ctx.fillRect(span, tip, 7, 9 - feather);
      ctx.fillStyle = fur.b;
      ctx.fillRect(span, tip, 6, 4 - feather * 0.4);
      ctx.fillStyle = "#ad8260";
      ctx.fillRect(span + 2, tip, 4, 1.5);
    }
    ctx.restore();
  }
  pixels(ctx, eagleBody, -7, -5);
  ctx.restore();
}

export function paintPerchedEagle(ctx: CanvasRenderingContext2D, x: number, rail: number) {
  pixels(ctx, ["    wwwd", "   bwwwgg", "  dbbww", "  dbbbd", " dbbbbd",
    "dbbbbd", "dd dbd", "   g g"], x - 8, rail - 16);
}

export { paintCoyote } from "./chicken-coyote";
