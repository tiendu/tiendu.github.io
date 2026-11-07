// Small, repeated landmarks occupy a slower layer behind the playable lane.
export function drawFarmDetails(ctx: CanvasRenderingContext2D, width: number, floor: number,
  camera: number, finish: number, time: number, night: number) {
  const parallax = 0.52;
  const spacing = 340;
  const first = Math.max(0, Math.floor((camera - 90 / parallax) / spacing));
  ctx.save();
  ctx.globalAlpha = 0.73 - night * 0.27;
  const rect = (color: string, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  const wood = "#85664e", rail = "#b09368", iron = "#516267", straw = "#c69b58";
  for (let cell = first; cell * spacing <= Math.min(finish, camera + (width + 70) / parallax); cell++) {
    const progress = cell * spacing / finish;
    ctx.save();
    ctx.translate((cell * spacing - camera) * parallax, floor - 19 - (cell % 3) * 3);
    if (progress < 0.32) {
      rect(rail, -34, -8, 38, 2);
      rect(rail, -34, -4, 38, 2);
      rect(wood, -33, -12, 3, 13);
      rect(wood, -14, -10, 3, 11);
      rect(wood, 3, -12, 3, 13);
      // Grazing cow, with a head that dips independently of its planted hooves.
      rect("#e4d6b5", 18, -12, 18, 8);
      rect("#60534c", 21, -12, 5, 5);
      rect("#60534c", 30, -9, 4, 4);
      rect(wood, 19, -5, 2, 5);
      rect(wood, 32, -5, 2, 5);
      const dip = 2 * Math.sin(time * 1.2 + cell);
      rect("#d5c3a2", 35, -9 + dip, 6, 6);
      rect(wood, 39, -5 + dip, 4, 3);
      for (let i = 0; i < 5; i++) {
        rect("#718853", -28 + i * 9, 2 + i % 2, 4, 2);
        rect("#c6b08b", -27 + i * 9, 1 + i % 2, 2, 1);
      }
    } else if (progress < 0.75) {
      if (cell % 2) {
        rect(wood, -3, -27, 6, 27);
        rect(rail, -5, -6, 10, 6);
        ctx.save();
        ctx.translate(0, -26);
        ctx.rotate(time * 0.55 + cell);
        for (let blade = 0; blade < 4; blade++) {
          ctx.rotate(Math.PI / 2);
          rect(wood, 0, -1, 15, 2);
          rect("#cab994", 6, -4, 9, 3);
        }
        ctx.restore();
      } else {
        rect(iron, -13, -5, 6, 6);
        rect(iron, 8, -5, 6, 6);
        rect(wood, -17, -8, 34, 4);
        rect(straw, -15, -16, 29, 8);
        rect("#d4b274", -9, -23, 17, 7);
        rect(rail, 15, -7, 12, 2);
      }
      for (let row = 0; row < 3; row++) rect(rail, 30 + row * 4, -row * 2, 17, 1);
    } else {
      rect(wood, -25, -5, 3, 6);
      rect(wood, -8, -5, 3, 6);
      rect(iron, -28, -9, 25, 6);
      rect("#99b4ad", -26, -10, 21, 2);
      rect("#d1d3b4", -19 + 3 * Math.sin(time * 2), -10, 5, 1);
      for (let sack = 0; sack < 3; sack++) {
        const x = 7 + sack * 8, y = sack === 1 ? -3 : 0;
        rect("#aa875e", x, y - 8, 9, 8);
        rect(rail, x + 2, y - 11, 5, 4);
        rect(wood, x + 2, y - 9, 5, 1);
      }
      rect(wood, 30, -13, 3, 14);
      rect(rail, 33, -10, 15, 2);
      rect(rail, 47, -9, 12, 2);
      rect(iron, 32, -8, 3, 2);
    }
    ctx.restore();
  }
  ctx.restore();
}
