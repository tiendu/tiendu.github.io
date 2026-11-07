// Two world pixels per cell. All bodies are anchored at the top of the legs.
const plumage = {
  rooster: {
    colors: ["#e8a345", "#c34d35", "#185355", "#328079", "#ff5942"],
    rows: [
      "..............r.r....",
      ".............rrrrr...",
      ".............aaaar...",
      "............aawaia...",
      ".tt.........aaaaaabb.",
      "ttttt.......aaaaar...",
      "t..ttt.....aaaaarr...",
      "..uuuutt..aaacaa.r...",
      ".uu..uut.cccacaa.....",
      ".u....ttccccccca.....",
      "...tttttccaaaccc.....",
      "....tttccccacccc.....",
      "......tcccccccc......",
      ".......tcccccc.......",
      "........ccccc........",
    ],
  },
  hen: {
    colors: ["#5a5765", "#393944", "#252634", "#e5d4b4", "#c46d62"],
    rows: [
      "..............rr.....",
      ".............aaaar...",
      "............aawica...",
      "............caaaacbb.",
      ".tt........ccauac....",
      ".ttt......ccaacca....",
      "..ttttcggccccacc.....",
      "...ttcccccuccucc.....",
      "....tccaucccccccc....",
      "....cccccauccccc.....",
      ".....tccccccuccc.....",
      "......ttccccccc......",
      "........ttcccc.......",
    ],
  },
  round: {
    colors: ["#fff1d2", "#e1ceae", "#ada093", "#ffffff", "#d47c69"],
    rows: [
      "..........uuu........",
      ".........uauuu.......",
      ".......uuuauaaur.....",
      "......uaaaaaaaiau....",
      "....uuuaaaaaaaaaabb..",
      "...uuauaaaaaaacaa....",
      "..cuuaaaaauaaaacc....",
      ".ccauaaaaauuaaacc....",
      ".cauaaacaaaauaaacc...",
      "..caaaaccaaaaaaaac...",
      "..ccaaaaaccaaaaac....",
      "...ccaaaaaaaaaac.....",
      "....cccaaaaaaccc.....",
      "......cccccccc.......",
    ],
  },
  chick: {
    colors: ["#ffda55", "#efa839", "#b97d36", "#fff397", "#ffe683"],
    rows: [
      "..........uu.........",
      "...........uu.u......",
      ".........uuuuuua.....",
      "........uaaaaaaaa....",
      "........uaaawiaa....",
      "........uaaaaaaaabb..",
      "........uaaaaccaa....",
      "......uuuaaaaaaa.....",
      ".....uaaaaaaaac......",
      ".....uaauuaaaac......",
      "......caaacccc.......",
      ".......cccccc........",
    ],
  },
  bantam: {
    colors: ["#aaa4ee", "#6465aa", "#34335f", "#d8b7f3", "#e08d83"],
    rows: [
      "....tu........rr.....",
      "...tuut......raar....",
      "..ttuutt.....awia...",
      "..tuttu.....aaaaabb..",
      ".ttutt......auaa.....",
      ".ttutt.....auuac.....",
      "..ttutc...auuacc.....",
      "...ttutccccaccc......",
      "....tttccaacccc......",
      ".....tccaauaccc......",
      "......ccauaccc.......",
      ".......ccaccc........",
    ],
  },
} as const;

// One transparent sprite per outfit/expression, reused by every runner and portrait.
const sprites = new Map<string, HTMLCanvasElement>();
export function drawPlumage(ctx: CanvasRenderingContext2D, shape: string, bob: number, shocked: boolean) {
  const spriteKey = shape + (shocked ? "-caught" : "");
  let sprite = sprites.get(spriteKey);
  if (!sprite) {
    sprite = document.createElement("canvas");
    sprite.width = 48;
    sprite.height = 40;
    const brush = sprite.getContext("2d");
    if (!brush) return;
    paintPlumage(brush, shape, shocked);
    sprites.set(spriteKey, sprite);
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite, 0, bob);
}

function paintPlumage(ctx: CanvasRenderingContext2D, shape: string, shocked: boolean) {
  const key = shape as keyof typeof plumage;
  const { colors, rows } = plumage[key] ?? plumage.round;
  const [a, c, t, u, r] = colors;
  const ink: Record<string, string> = { a, c, t, u, r, g: "#85818d", i: "#211d26", w: "#fffae5", b: "#f4ac44" };
  const top = 36 - rows.length * 2;
  for (const [row, pixels] of rows.entries()) {
    for (let x = 0; x < pixels.length;) {
      const pixel = pixels[x];
      let end = x + 1;
      while (pixels[end] === pixel) end++;
      if (pixel !== ".") {
        ctx.fillStyle = ink[pixel];
        ctx.fillRect(x * 2, top + row * 2, (end - x) * 2, pixel === "i" && shocked ? 4 : 2);
      }
      x = end;
    }
  }
}

// Scatter body, wing and tail colors. The fifth swatch belongs to the comb.
export const featherDuration = 1.45;
export function drawCaughtFeathers(ctx: CanvasRenderingContext2D, shape: string, x: number, y: number, age: number, count = 26) {
  if (age < 0 || age >= featherDuration) return;
  const colors = (plumage[shape as keyof typeof plumage] ?? plumage.round).colors;
  ctx.save();
  ctx.globalAlpha = Math.min(1, (featherDuration - age) * 3);
  for (let i = 0; i < count; i++) {
    const angle = i * 2.4;
    const speed = 40 + (i * 37) % 90;
    const flutter = Math.sin(age * 9 + angle) * age * 5;
    const dx = Math.cos(angle) * speed * (1 - Math.exp(-age * 2)) / 2 + flutter;
    const dy = (Math.sin(angle) * speed - 63) * age + 66 * age * age;
    ctx.save();
    ctx.translate(Math.round(x + dx), Math.round(y + dy));
    ctx.rotate(angle + age * ((i % 5) - 2) * 3);
    ctx.fillStyle = colors[3];
    ctx.fillRect(-4, -1, 8, 2);
    ctx.fillStyle = colors[i % 4];
    ctx.fillRect(-3, -2, 6, 3);
    ctx.fillRect(-1, -3, 3, 2);
    ctx.restore();
  }
  ctx.restore();
}
