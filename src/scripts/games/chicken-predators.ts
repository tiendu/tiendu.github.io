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

export function paintFox(ctx: CanvasRenderingContext2D, x: number, floor: number, frame: number) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(floor));
  const stretched = Math.floor(frame) % 2 === 0;
  pixels(ctx, stretched ? ["  bb     dd", " bb       dd", "ddd        dd"] :
    ["    bb  dd", "     bbdd", "    ddd dd"], -11, -6);
  pixels(ctx, [
    "                 d  d",
    "                drddrd",
    " ww            drrrrrd",
    " wwwr   dfffffrrrrred",
    "  wrrrffrrrrrrrrrrrwwdd",
    "   rffffrrrrrrrrrwwwwd",
    "     dffffrrrrffwww",
    "        dffffffdd",
  ], -24, -20);
  ctx.restore();
}

export function paintEagle(ctx: CanvasRenderingContext2D, x: number, y: number, diving: boolean, climb = 0) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (climb > 0) {
    ctx.rotate(-0.32);
    // Invert the wing tips around the shoulders on each downstroke.
    const stroke = Math.cos(climb * 13);
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side, 1);
      for (let i = 0; i < 5; i++) {
        const y = Math.round(-4 - stroke * (i + 1) * 2);
        ctx.fillStyle = "#392c31";
        ctx.fillRect(4 + i * 4, y, 7, 6);
        ctx.fillStyle = "#94694e";
        ctx.fillRect(4 + i * 4, y, 6, 2);
      }
      ctx.restore();
    }
    pixels(ctx, ["ddbbwwd", " dbbwwgg", " dbbd  g", "dd gg"], -7, -5);
    ctx.restore();
    return;
  }
  pixels(ctx, diving ? [
    "dd",
    " dbbd    d",
    "  dbbbd dbd",
    "   dbbbbdbd",
    "    ddbbbwwd",
    "      dbbwwgg",
    "      dbbdd g",
    "        gg",
    "        g g",
  ] : [
    "dd                     dd",
    "dbbdd               ddbbd",
    "  dbbbdd         ddbbbd",
    "  ddbbbbbdd   ddbbbbbdd",
    "     ddbbbbdbbbbdd",
    "        dbbbwwd",
    "         dbbwwgg",
    "         dbbd  g",
    "        dd gg",
  ], diving ? -12 : -24, -10);
  ctx.restore();
}
